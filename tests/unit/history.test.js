import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveBid, getAllBids, updateBid, deleteBid, getHistorySummary } from '../../src/state/history.js';

// First dedicated Vitest coverage for this client-side fetch wrapper
// (Migration Phase 5, Bucket 1, Step C) — it had none before porting,
// only exercised via Playwright. Mirrors tests/unit/rateTemplates.test.js's
// shape: mocks global.fetch, asserts request shape and response
// passthrough. getHistorySummary()'s aggregation is exercised against
// the real computeMarginOutcomeCurve/computeSeasonality/
// computeCompetitorPatterns (src/state/historyAnalytics.js, already
// covered by its own test file) rather than mocked — it's a thin
// composition of those plus getAllBids(), so testing the real
// composition is more honest than stubbing out what it composes.

const ENDPOINT = '/.netlify/functions/bids';

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveBid', () => {
  it('POSTs the record as JSON and returns the parsed response', async () => {
    const record = { bid_id: 'b1', gc: 'Acme' };
    fetch.mockResolvedValue(okJson(record));

    const result = await saveBid(record);

    expect(fetch).toHaveBeenCalledWith(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      cache:   'no-store',
      body:    JSON.stringify(record)
    });
    expect(result).toEqual(record);
  });

  it('throws with the status code on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(saveBid({})).rejects.toThrow('saveBid failed: 500');
  });
});

describe('getAllBids', () => {
  it('GETs the endpoint with cache: no-store and returns the parsed JSON', async () => {
    const bids = [{ bid_id: 'b1' }, { bid_id: 'b2' }];
    fetch.mockResolvedValue(okJson(bids));

    const result = await getAllBids();

    expect(fetch).toHaveBeenCalledWith(ENDPOINT, { cache: 'no-store' });
    expect(result).toEqual(bids);
  });

  it('throws (never falls back to []) on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(getAllBids()).rejects.toThrow('getAllBids failed: 500');
  });
});

describe('updateBid', () => {
  it('PATCHes the bid_id-scoped endpoint with the patch as JSON', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await updateBid('b1', { outcome: 'won' });

    expect(fetch).toHaveBeenCalledWith(ENDPOINT + '?bid_id=b1', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache:   'no-store',
      body:    JSON.stringify({ outcome: 'won' })
    });
    expect(result).toBe(true);
  });

  it('returns false (not a throw) on a 404 — record already gone', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await updateBid('missing', {})).toBe(false);
  });

  it('throws with the status code on any other non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(updateBid('b1', {})).rejects.toThrow('updateBid failed: 500');
  });
});

describe('deleteBid', () => {
  it('DELETEs the bid_id-scoped endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    await deleteBid('b1 with space');
    expect(fetch).toHaveBeenCalledWith(
      ENDPOINT + '?bid_id=' + encodeURIComponent('b1 with space'),
      { method: 'DELETE', cache: 'no-store' }
    );
  });

  it('throws with the status code on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(deleteBid('b1')).rejects.toThrow('deleteBid failed: 500');
  });
});

describe('getHistorySummary', () => {
  it('returns a zeroed summary (with real empty-input analytics) when there are no bids', async () => {
    fetch.mockResolvedValue(okJson([]));

    const summary = await getHistorySummary('Acme', 'Office');

    expect(summary.totalBids).toBe(0);
    expect(summary.winRate).toBe(0);
    expect(summary.winsWithThisGC).toBe(0);
    expect(summary.lossesWithThisGC).toBe(0);
    expect(summary.winRateByBuildingType).toBe(0);
    expect(summary.avgCostVariance).toBeNull();
    // Real historyAnalytics output for an empty bid list, not a stub.
    expect(summary.marginOutcomeCurve).toEqual({ available: false, count: 0, minRequired: expect.any(Number) });
    expect(summary.seasonality).toBeDefined();
    expect(summary.competitorPatterns).toBeDefined();
  });

  it('aggregates win rate, GC-specific record, and building-type win rate from real bids', async () => {
    const bids = [
      { bid_id: '1', gc: 'Acme', building_type: 'Office', outcome: 'won', cost_variance: 500 },
      { bid_id: '2', gc: 'Acme', building_type: 'Office', outcome: 'lost', cost_variance: null },
      { bid_id: '3', gc: 'Other', building_type: 'Retail', outcome: 'won', cost_variance: null }
    ];
    fetch.mockResolvedValue(okJson(bids));

    const summary = await getHistorySummary('Acme', 'Office');

    expect(summary.totalBids).toBe(3);
    expect(summary.winRate).toBe(Math.round((2 / 3) * 100));
    expect(summary.winsWithThisGC).toBe(1);
    expect(summary.lossesWithThisGC).toBe(1);
    expect(summary.winRateByBuildingType).toBe(50); // 1 of 2 Office bids won
    expect(summary.avgCostVariance).toBe(500); // only won bid with a non-null cost_variance
  });

  it('is case-insensitive on gc matching and treats an unmatched buildingType as zero bids of that type', async () => {
    const bids = [{ bid_id: '1', gc: 'ACME CONSTRUCTION', building_type: 'Office', outcome: 'won', cost_variance: null }];
    fetch.mockResolvedValue(okJson(bids));

    const summary = await getHistorySummary('acme construction', 'Retail');

    expect(summary.winsWithThisGC).toBe(1);
    expect(summary.winRateByBuildingType).toBe(0);
  });
});
