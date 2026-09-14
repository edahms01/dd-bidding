import { describe, it, expect } from 'vitest';
import {
  stampNewBid, mergeBidPatch, isValidBidId, readBid, writeBid, deleteBidRecord, readAllBids
} from '../../netlify/functions/lib/bids-core.js';

// Minimal in-memory stand-in for a Netlify Blobs store — same shape as
// bid-agent-jobs.test.js's fakeStore(), extended with list()/delete()
// for the restructured per-record bids store.
function fakeStore() {
  const m = new Map();
  return {
    _m: m,
    get: async (k, opts) => {
      if (!m.has(k)) return null;
      return (opts && opts.type === 'json') ? m.get(k) : JSON.stringify(m.get(k));
    },
    setJSON: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k) => { m.delete(k); },
    list: async () => ({ blobs: Array.from(m.keys()).map((key) => ({ key, etag: 'fake' })), directories: [] })
  };
}

describe('stampNewBid', () => {
  it('assigns a bid_id and date_submitted without dropping existing fields', () => {
    const input  = { project_name: 'Test Project', final_bid: 100000 };
    const record = stampNewBid(input);

    expect(record.project_name).toBe('Test Project');
    expect(record.final_bid).toBe(100000);
    expect(record.bid_id).toMatch(/^bid_\d+_[a-z0-9]+$/);
    expect(record.date_submitted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not mutate the input record', () => {
    const input = { project_name: 'Test Project' };
    stampNewBid(input);
    expect(input).toEqual({ project_name: 'Test Project' });
  });

  it('produces different bid_ids across calls', () => {
    const a = stampNewBid({});
    const b = stampNewBid({});
    expect(a.bid_id).not.toBe(b.bid_id);
  });
});

describe('mergeBidPatch', () => {
  it('merges a patch into the record and returns the result', () => {
    const existing = { bid_id: 'a', outcome: 'pending' };
    const updated  = mergeBidPatch(existing, { outcome: 'won' });

    expect(updated).toEqual({ bid_id: 'a', outcome: 'won' });
  });

  it('does not mutate the existing record or the patch', () => {
    const existing = { bid_id: 'a', outcome: 'pending' };
    const patch    = { outcome: 'won' };
    mergeBidPatch(existing, patch);
    expect(existing).toEqual({ bid_id: 'a', outcome: 'pending' });
    expect(patch).toEqual({ outcome: 'won' });
  });
});

describe('isValidBidId', () => {
  it('accepts server-generated ids', () => {
    expect(isValidBidId('bid_1789370578138_ab3f9')).toBe(true);
  });

  it('accepts seed fixture ids', () => {
    expect(isValidBidId('seed-1')).toBe(true);
  });

  it('rejects junk', () => {
    expect(isValidBidId('')).toBe(false);
    expect(isValidBidId(null)).toBe(false);
    expect(isValidBidId(undefined)).toBe(false);
    expect(isValidBidId(42)).toBe(false);
    expect(isValidBidId('has spaces')).toBe(false);
    expect(isValidBidId('x'.repeat(200))).toBe(false);
  });
});

describe('readBid / writeBid / deleteBidRecord', () => {
  it('writeBid then readBid round-trips the record', async () => {
    const store = fakeStore();
    await writeBid(store, 'bid_1', { bid_id: 'bid_1', project_name: 'A' });
    expect(await readBid(store, 'bid_1')).toEqual({ bid_id: 'bid_1', project_name: 'A' });
  });

  it('readBid returns null for an absent key', async () => {
    expect(await readBid(fakeStore(), 'nope')).toBeNull();
  });

  it('deleteBidRecord removes the record', async () => {
    const store = fakeStore();
    await writeBid(store, 'bid_1', { bid_id: 'bid_1' });
    await deleteBidRecord(store, 'bid_1');
    expect(await readBid(store, 'bid_1')).toBeNull();
  });

  it('deleteBidRecord on a missing key is a harmless no-op', async () => {
    const store = fakeStore();
    await expect(deleteBidRecord(store, 'nope')).resolves.toBeUndefined();
  });
});

describe('readAllBids', () => {
  it('returns an empty array for an empty store', async () => {
    expect(await readAllBids(fakeStore())).toEqual([]);
  });

  it('returns every record, newest bid_id first', async () => {
    const store = fakeStore();
    await writeBid(store, 'bid_100', { bid_id: 'bid_100' });
    await writeBid(store, 'bid_300', { bid_id: 'bid_300' });
    await writeBid(store, 'bid_200', { bid_id: 'bid_200' });

    const all = await readAllBids(store);
    expect(all.map((b) => b.bid_id)).toEqual(['bid_300', 'bid_200', 'bid_100']);
  });
});
