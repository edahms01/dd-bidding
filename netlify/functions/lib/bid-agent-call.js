// ─────────────────────────────────────────────────────────────────────
// bid-agent-call.js — Retry-wrapped Anthropic call for the async
// bid-agent flow (Phase 1 Step 1C).
//
// bid-agent-background.js is a Netlify *background* function (15-min
// budget, MUST NOT throw — see that file's header) — real headroom for
// a retry loop, unlike the old synchronous path. Wraps fetch + the
// HTTP-status check only, not the response-parse step: retryability
// (429/5xx/timeout vs 400/401) is a transport-level property decided at
// the status check; a parse failure happens only after a 200 OK, on a
// different failure axis (the model produced malformed output, not a
// transport problem) — deliberately NOT retried here, same single-
// attempt behavior as before this step.
//
// fetchImpl/sleep are injected so this is unit-testable without a real
// network call or real multi-second waits — same "inject the I/O
// boundary" shape lib/bid-agent-jobs.js's store param uses.
// ─────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2000, 5000];       // wait before attempt 2, before attempt 3
const PER_ATTEMPT_TIMEOUT_MS = 60000;  // generous above the ~29-44s observed real latency (CLAUDE.md)

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns { ok: true, resp } on a 2xx response, or { ok: false, resp?,
// err?, attempts } once retries are exhausted or a non-retryable status
// is hit. Never throws — a network-level failure (fetch rejecting, or
// our own AbortController firing on a per-attempt timeout) is caught
// and folded into the same retry/exhaust logic as a retryable HTTP
// status.
async function callAnthropicWithRetry(fetchImpl, anthropicReq, apiKey, { sleep = defaultSleep, log } = {}) {
  let lastReason;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const resp = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(anthropicReq),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.ok) return { ok: true, resp, attempts: attempt };

      if (!isRetryableStatus(resp.status) || attempt === MAX_ATTEMPTS) {
        return { ok: false, resp, attempts: attempt };
      }
      lastReason = 'HTTP ' + resp.status;
    } catch (err) {
      clearTimeout(timer);
      // AbortError (our own per-attempt timeout) or a genuine network
      // failure — both count as the "network-timeout" retryable bucket.
      if (attempt === MAX_ATTEMPTS) return { ok: false, err, attempts: attempt };
      lastReason = (err && err.message) || String(err);
    }
    log?.retrying?.(attempt, lastReason, BACKOFF_MS[attempt - 1]);
    await sleep(BACKOFF_MS[attempt - 1]);
  }
}

module.exports = {
  callAnthropicWithRetry,
  isRetryableStatus,
  MAX_ATTEMPTS,
  BACKOFF_MS,
  PER_ATTEMPT_TIMEOUT_MS
};
