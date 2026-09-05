import { describe, it, expect } from 'vitest';
import { computeGcScorecard } from '../../src/state/gcScorecard.js';

function bid(overrides = {}) {
  return {
    gc: 'Acme GC',
    outcome: 'won',
    final_bid: 100000,
    direct_cost: 80000, // 20% margin
    cost_variance: null,
    ...overrides
  };
}

describe('computeGcScorecard', () => {
  it('returns an empty array for no bids', () => {
    expect(computeGcScorecard([])).toEqual([]);
    expect(computeGcScorecard(undefined)).toEqual([]);
  });

  it('omits bids with no gc rather than bucketing them', () => {
    const rows = computeGcScorecard([
      bid({ gc: '' }),
      bid({ gc: '   ' }),
      bid({ gc: null }),
      bid({ gc: 'Real GC' })
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].gc).toBe('Real GC');
    expect(rows[0].bidCount).toBe(1);
  });

  it('groups case-insensitively and keeps the first-seen casing for the label', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'Turner Construction' }),
      bid({ gc: 'turner construction' }),
      bid({ gc: 'TURNER CONSTRUCTION' })
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].gc).toBe('Turner Construction');
    expect(rows[0].bidCount).toBe(3);
  });

  it('win rate counts only decided bids; pending bids count toward bidCount only', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'won' }),
      bid({ gc: 'GC', outcome: 'lost' }),
      bid({ gc: 'GC', outcome: 'pending' })
    ]);
    expect(rows[0].bidCount).toBe(3);
    expect(rows[0].decidedCount).toBe(2);
    expect(rows[0].winRate).toBe(50);
  });

  it('winRate is null when a GC has no decided bids', () => {
    const rows = computeGcScorecard([bid({ gc: 'GC', outcome: 'pending' })]);
    expect(rows[0].winRate).toBeNull();
  });

  it('avg margin averages only won bids with both final_bid and direct_cost > 0', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'won', final_bid: 100000, direct_cost: 75000 }), // 25%
      bid({ gc: 'GC', outcome: 'won', final_bid: 100000, direct_cost: 85000 }), // 15%
      bid({ gc: 'GC', outcome: 'won', final_bid: 0, direct_cost: 50000 }),       // excluded
      bid({ gc: 'GC', outcome: 'lost', final_bid: 100000, direct_cost: 10000 }) // excluded (not won)
    ]);
    expect(rows[0].avgMarginPct).toBe(20); // (25 + 15) / 2, rounded to 1 dp
  });

  it('avg margin is null when a GC has no won bids with valid figures', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'lost' }),
      bid({ gc: 'GC', outcome: 'pending' })
    ]);
    expect(rows[0].avgMarginPct).toBeNull();
  });

  it('avg margin rounds to one decimal place', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'won', final_bid: 100000, direct_cost: 66667 }) // 33.333%
    ]);
    expect(rows[0].avgMarginPct).toBe(33.3);
  });

  it('avg cost variance averages won bids with a non-null cost_variance, and rounds', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'won', cost_variance: 3000 }),
      bid({ gc: 'GC', outcome: 'won', cost_variance: -2000 }),
      bid({ gc: 'GC', outcome: 'won', cost_variance: null }),   // excluded
      bid({ gc: 'GC', outcome: 'lost', cost_variance: 99999 })  // excluded (not won)
    ]);
    expect(rows[0].avgCostVariance).toBe(500); // (3000 - 2000) / 2
  });

  it('avg cost variance is null when no won bid carries one', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'GC', outcome: 'won', cost_variance: null }),
      bid({ gc: 'GC', outcome: 'lost', cost_variance: 1000 })
    ]);
    expect(rows[0].avgCostVariance).toBeNull();
  });

  it('sorts by bid count desc, then alphabetically by GC name', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'Zeta' }),
      bid({ gc: 'Alpha' }), bid({ gc: 'Alpha' }),
      bid({ gc: 'Beta' }), bid({ gc: 'Beta' }),
      bid({ gc: 'Gamma' })
    ]);
    expect(rows.map((r) => r.gc)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zeta']);
  });

  it('a realistic mixed set produces the expected per-GC rollup', () => {
    const rows = computeGcScorecard([
      bid({ gc: 'Cianbro Corporation', outcome: 'won', final_bid: 189500, direct_cost: 148200, cost_variance: 3200 }),
      bid({ gc: 'PC Construction', outcome: 'lost', final_bid: 119700, direct_cost: 92400 }),
      bid({ gc: 'Consigli Construction Co.', outcome: 'pending', final_bid: 229600, direct_cost: 177600 })
    ]);
    const byGc = Object.fromEntries(rows.map((r) => [r.gc, r]));

    expect(byGc['Cianbro Corporation']).toMatchObject({
      bidCount: 1, decidedCount: 1, winRate: 100, avgCostVariance: 3200
    });
    expect(byGc['Cianbro Corporation'].avgMarginPct).toBeCloseTo(21.8, 1);
    expect(byGc['PC Construction']).toMatchObject({ winRate: 0, avgMarginPct: null, avgCostVariance: null });
    expect(byGc['Consigli Construction Co.']).toMatchObject({ winRate: null, avgMarginPct: null });
  });
});
