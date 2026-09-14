import { describe, it, expect, vi } from 'vitest';
import {
  callAnthropicWithRetry, isRetryableStatus, MAX_ATTEMPTS, BACKOFF_MS, PER_ATTEMPT_TIMEOUT_MS
} from '../../netlify/functions/lib/bid-agent-call.js';

// A fake fetch that resolves/rejects per a scripted queue of outcomes —
// each call consumes the next entry. Each entry is either
// { status, body } (a Response-shaped resolve) or { throwName } (a
// rejection, e.g. simulating AbortError/network failure).
function scriptedFetch(outcomes) {
  let i = 0;
  return vi.fn(async () => {
    const outcome = outcomes[i++];
    if (!outcome) throw new Error('scriptedFetch: ran out of scripted outcomes');
    if (outcome.throwName) {
      const err = new Error(outcome.throwName);
      err.name = outcome.throwName;
      throw err;
    }
    return {
      ok: outcome.status >= 200 && outcome.status < 300,
      status: outcome.status,
      json: async () => outcome.body || {}
    };
  });
}

// Instant, no real waiting — records the delays it was asked to sleep for.
function fakeSleep(record) {
  return async (ms) => { record.push(ms); };
}

describe('isRetryableStatus', () => {
  it('retries 429 and every 5xx', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });
  it('does not retry 400/401/403/404', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe('callAnthropicWithRetry', () => {
  it('succeeds on the first attempt with no retry/backoff at all', async () => {
    const fetchImpl = scriptedFetch([{ status: 200, body: { ok: 1 } }]);
    const delays = [];
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep(delays) });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('a retryable 500 then a success on attempt 2 — one backoff wait, correct duration', async () => {
    const fetchImpl = scriptedFetch([{ status: 500, body: {} }, { status: 200, body: { ok: 1 } }]);
    const delays = [];
    const retrying = vi.fn();
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep(delays), log: { retrying } });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([BACKOFF_MS[0]]);
    expect(retrying).toHaveBeenCalledWith(1, 'HTTP 500', BACKOFF_MS[0]);
  });

  it('a non-retryable 400 fails on attempt 1 — zero backoff, zero retry', async () => {
    const fetchImpl = scriptedFetch([{ status: 400, body: { error: 'bad request' } }]);
    const delays = [];
    const retrying = vi.fn();
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep(delays), log: { retrying } });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.resp.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
    expect(retrying).not.toHaveBeenCalled();
  });

  it('a non-retryable 401 fails immediately, same as 400', async () => {
    const fetchImpl = scriptedFetch([{ status: 401, body: {} }]);
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep([]) });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('exhausts all 3 attempts on a persistent 429, correct backoff sequence', async () => {
    const fetchImpl = scriptedFetch([{ status: 429 }, { status: 429 }, { status: 429 }]);
    const delays = [];
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep(delays) });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.resp.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(delays).toEqual(BACKOFF_MS);
  });

  it('a network-level failure (fetch throws / our own abort) retries and can exhaust', async () => {
    const fetchImpl = scriptedFetch([
      { throwName: 'AbortError' },
      { throwName: 'AbortError' },
      { throwName: 'AbortError' }
    ]);
    const delays = [];
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep(delays) });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.err).toBeInstanceOf(Error);
    expect(result.resp).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(delays).toEqual(BACKOFF_MS);
  });

  it('a network failure that then succeeds on attempt 2 recovers cleanly', async () => {
    const fetchImpl = scriptedFetch([{ throwName: 'TypeError' }, { status: 200, body: { ok: 1 } }]);
    const result = await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep([]) });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('passes an AbortSignal on every attempt (per-attempt timeout wiring)', async () => {
    const fetchImpl = vi.fn(async (_url, opts) => {
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      return { ok: true, status: 200, json: async () => ({}) };
    });
    await callAnthropicWithRetry(fetchImpl, {}, 'sk-ant-x', { sleep: fakeSleep([]) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('exports the documented constants', () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect(BACKOFF_MS).toEqual([2000, 5000]);
    expect(PER_ATTEMPT_TIMEOUT_MS).toBe(60000);
  });
});
