import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAllRateTemplates, saveRateTemplate, deleteRateTemplate } from '../../src/state/rateTemplates.js';

// First dedicated coverage for this client-side fetch wrapper (Migration
// Phase 5, Bucket 1, Step B) — it had none before porting, only exercised
// via Playwright. netlify/functions/lib/rate-templates-core.js (the
// server-side record-shaping counterpart) already has its own test file,
// tests/unit/rate-templates-core.test.js; this mirrors that file's shape
// for the client side, mocking global.fetch instead of hitting a real
// endpoint.

const ENDPOINT = '/.netlify/functions/rate-templates';

function mockFetch(response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAllRateTemplates', () => {
  it('GETs the endpoint with cache: no-store and returns the parsed JSON', async () => {
    const templates = [{ id: 'rt_1', name: 'Standard commercial', rates: { framing: 4.5 } }];
    mockFetch(okJson(templates));

    const result = await getAllRateTemplates();

    expect(fetch).toHaveBeenCalledWith(ENDPOINT, { cache: 'no-store' });
    expect(result).toEqual(templates);
  });

  it('throws with the status code on a non-ok response', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(getAllRateTemplates()).rejects.toThrow('getAllRateTemplates failed: 500');
  });
});

describe('saveRateTemplate', () => {
  it('POSTs name/rates/rateEscalation as JSON and returns the parsed response', async () => {
    const saved = { id: 'rt_2', name: 'Steel up 5%' };
    mockFetch(okJson(saved));

    const rates = { framing: 4.5, hanging: 2.1 };
    const rateEscalation = { stud: { '2-1/2"': 5 } };
    const result = await saveRateTemplate('Steel up 5%', rates, rateEscalation);

    expect(fetch).toHaveBeenCalledWith(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      cache:   'no-store',
      body:    JSON.stringify({ name: 'Steel up 5%', rates, rateEscalation })
    });
    expect(result).toEqual(saved);
  });

  it('throws with the status code on a non-ok response', async () => {
    mockFetch({ ok: false, status: 400 });
    await expect(saveRateTemplate('X', {}, null)).rejects.toThrow('saveRateTemplate failed: 400');
  });
});

describe('deleteRateTemplate', () => {
  it('DELETEs the endpoint with the id URL-encoded as a query param', async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({}) });

    await deleteRateTemplate('rt_1 with space');

    expect(fetch).toHaveBeenCalledWith(
      ENDPOINT + '?id=' + encodeURIComponent('rt_1 with space'),
      { method: 'DELETE', cache: 'no-store' }
    );
  });

  it('throws with the status code on a non-ok response', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(deleteRateTemplate('missing')).rejects.toThrow('deleteRateTemplate failed: 404');
  });
});
