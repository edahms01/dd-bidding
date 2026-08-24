import { describe, it, expect } from 'vitest';
import { stampNewBid, mergePatch, removeBid } from '../../netlify/functions/lib/bids-core.js';

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

describe('mergePatch', () => {
  it('merges a patch into the matching record and returns it', () => {
    const bids = [{ bid_id: 'a', outcome: 'pending' }, { bid_id: 'b', outcome: 'pending' }];
    const { bids: next, updated } = mergePatch(bids, 'a', { outcome: 'won' });

    expect(updated).toEqual({ bid_id: 'a', outcome: 'won' });
    expect(next.find(b => b.bid_id === 'a').outcome).toBe('won');
    expect(next.find(b => b.bid_id === 'b').outcome).toBe('pending');
  });

  it('returns updated: null and the array unchanged when bid_id has no match', () => {
    const bids = [{ bid_id: 'a', outcome: 'pending' }];
    const { bids: next, updated } = mergePatch(bids, 'nope', { outcome: 'won' });

    expect(updated).toBeNull();
    expect(next).toEqual(bids);
  });

  it('does not mutate the input array or its records', () => {
    const bids = [{ bid_id: 'a', outcome: 'pending' }];
    mergePatch(bids, 'a', { outcome: 'won' });
    expect(bids[0].outcome).toBe('pending');
  });
});

describe('removeBid', () => {
  it('filters out the matching record', () => {
    const bids = [{ bid_id: 'a' }, { bid_id: 'b' }];
    expect(removeBid(bids, 'a')).toEqual([{ bid_id: 'b' }]);
  });

  it('returns the array unchanged when bid_id has no match', () => {
    const bids = [{ bid_id: 'a' }];
    expect(removeBid(bids, 'nope')).toEqual(bids);
  });

  it('does not mutate the input array', () => {
    const bids = [{ bid_id: 'a' }, { bid_id: 'b' }];
    removeBid(bids, 'a');
    expect(bids).toEqual([{ bid_id: 'a' }, { bid_id: 'b' }]);
  });
});
