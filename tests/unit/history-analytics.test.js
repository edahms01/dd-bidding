import { describe, it, expect } from 'vitest';
import {
  MIN_BIDS_FOR_MARGIN_CURVE,
  computeMarginOutcomeCurve,
  computeSeasonality,
  computeCostVariances
} from '../../js/history-analytics.js';

function decidedBid(overrides = {}) {
  return {
    outcome: 'won',
    final_bid: 100000,
    direct_cost: 80000, // 20% margin
    bid_date: '2025-04-15',
    ...overrides
  };
}

describe('computeMarginOutcomeCurve', () => {
  it('returns available:false with the eligible count below the threshold', () => {
    const bids = Array.from({ length: MIN_BIDS_FOR_MARGIN_CURVE - 1 }, () => decidedBid());
    const result = computeMarginOutcomeCurve(bids);
    expect(result).toEqual({ available: false, count: MIN_BIDS_FOR_MARGIN_CURVE - 1, minRequired: MIN_BIDS_FOR_MARGIN_CURVE });
  });

  it('returns a curve exactly at the threshold', () => {
    const bids = Array.from({ length: MIN_BIDS_FOR_MARGIN_CURVE }, () => decidedBid());
    const result = computeMarginOutcomeCurve(bids);
    expect(result.available).toBe(true);
    expect(result.bands.length).toBeGreaterThan(0);
  });

  it('gates on decided (won/lost) bids, not raw submission count — pending bids never count toward the threshold', () => {
    const decided = Array.from({ length: 3 }, () => decidedBid());
    const pending = Array.from({ length: 20 }, () => decidedBid({ outcome: 'pending' }));
    const result = computeMarginOutcomeCurve([...decided, ...pending]);
    // 23 total bids, but only 3 decided — must still read as insufficient
    expect(result).toEqual({ available: false, count: 3, minRequired: MIN_BIDS_FOR_MARGIN_CURVE });
  });

  it('buckets bids into correct 5-point margin bands with per-band win rate', () => {
    const bids = [
      ...Array.from({ length: 10 }, () => decidedBid({ final_bid: 100000, direct_cost: 78000, outcome: 'won' })),  // 22% margin -> 20-25%
      ...Array.from({ length: 5 },  () => decidedBid({ final_bid: 100000, direct_cost: 78000, outcome: 'lost' })), // same band
      ...Array.from({ length: 5 },  () => decidedBid({ final_bid: 100000, direct_cost: 65000, outcome: 'won' }))   // 35% margin -> 35-40%
    ];
    const result = computeMarginOutcomeCurve(bids);
    expect(result.available).toBe(true);

    const lowBand = result.bands.find(b => b.low === 20);
    expect(lowBand).toBeTruthy();
    expect(lowBand.count).toBe(15);
    expect(lowBand.wins).toBe(10);
    expect(lowBand.winRate).toBe(Math.round((10 / 15) * 100));

    const highBand = result.bands.find(b => b.low === 35);
    expect(highBand).toBeTruthy();
    expect(highBand.count).toBe(5);
    expect(highBand.wins).toBe(5);
    expect(highBand.winRate).toBe(100);
  });

  it('excludes bids with invalid final_bid/direct_cost from the eligible count', () => {
    const bids = [
      ...Array.from({ length: MIN_BIDS_FOR_MARGIN_CURVE }, () => decidedBid()),
      decidedBid({ final_bid: 0 }),
      decidedBid({ direct_cost: 0 })
    ];
    const result = computeMarginOutcomeCurve(bids);
    expect(result.available).toBe(true);
    const totalCounted = result.bands.reduce((s, b) => s + b.count, 0);
    expect(totalCounted).toBe(MIN_BIDS_FOR_MARGIN_CURVE);
  });
});

describe('computeSeasonality', () => {
  it('groups decided bids by quarter of bid_date', () => {
    const bids = [
      decidedBid({ bid_date: '2025-01-15', outcome: 'won' }),  // Q1
      decidedBid({ bid_date: '2025-02-20', outcome: 'lost' }), // Q1
      decidedBid({ bid_date: '2025-07-01', outcome: 'won' })   // Q3
    ];
    const result = computeSeasonality(bids);
    const q1 = result.find(r => r.quarter === '2025-Q1');
    const q3 = result.find(r => r.quarter === '2025-Q3');

    expect(q1).toEqual({ quarter: '2025-Q1', totalBids: 2, wins: 1, winRate: 50 });
    expect(q3).toEqual({ quarter: '2025-Q3', totalBids: 1, wins: 1, winRate: 100 });
  });

  it('a quarter with zero decided bids is simply absent, not a zero-filled entry', () => {
    const bids = [decidedBid({ bid_date: '2025-01-15' })];
    const result = computeSeasonality(bids);
    expect(result.find(r => r.quarter === '2025-Q2')).toBeUndefined();
    expect(result.length).toBe(1);
  });

  it('excludes pending bids and bids with no bid_date', () => {
    const bids = [
      decidedBid({ outcome: 'pending' }),
      decidedBid({ bid_date: null })
    ];
    expect(computeSeasonality(bids)).toEqual([]);
  });

  it('returns an empty array for an empty bid list', () => {
    expect(computeSeasonality([])).toEqual([]);
  });
});

describe('computeCostVariances', () => {
  const recordWithBaseline = { estimated_labor_cost: 50000, estimated_material_cost: 30000, direct_cost: 80000 };
  const legacyRecord       = { direct_cost: 80000 };

  it('post-phase record: computes both variances independently and sums them into cost_variance', () => {
    const result = computeCostVariances({ record: recordWithBaseline, actualLabor: 52000, actualMaterial: 29000 });
    expect(result).toEqual({
      actual_cost: 81000,
      labor_cost_variance: 2000,
      material_cost_variance: -1000,
      cost_variance: 1000
    });
  });

  it('post-phase record with only one actual entered: only that variance computes, combined stays null', () => {
    const result = computeCostVariances({ record: recordWithBaseline, actualLabor: 52000, actualMaterial: null });
    expect(result.labor_cost_variance).toBe(2000);
    expect(result.material_cost_variance).toBeNull();
    expect(result.cost_variance).toBeNull();
    expect(result.actual_cost).toBeNull();
  });

  it('legacy record with both actuals entered: falls back to the old combined formula', () => {
    const result = computeCostVariances({ record: legacyRecord, actualLabor: 50000, actualMaterial: 34000 });
    expect(result).toEqual({
      actual_cost: 84000,
      labor_cost_variance: null,
      material_cost_variance: null,
      cost_variance: 4000 // 84000 - 80000
    });
  });

  it('legacy record with only one actual entered: cost_variance stays null, not a 0-filled sum', () => {
    const result = computeCostVariances({ record: legacyRecord, actualLabor: 50000, actualMaterial: null });
    expect(result.cost_variance).toBeNull();
    expect(result.actual_cost).toBeNull();
    expect(result.labor_cost_variance).toBeNull();
    expect(result.material_cost_variance).toBeNull();
  });

  it('partial baseline (only estimated_labor_cost present): treated as no baseline, legacy path applies', () => {
    const partial = { estimated_labor_cost: 50000, direct_cost: 80000 };
    const result = computeCostVariances({ record: partial, actualLabor: 51000, actualMaterial: 30000 });
    expect(result.labor_cost_variance).toBeNull();
    expect(result.material_cost_variance).toBeNull();
    expect(result.cost_variance).toBe(1000); // (51000+30000) - 80000, legacy formula
  });

  it('no actuals entered at all: everything stays null', () => {
    const result = computeCostVariances({ record: recordWithBaseline, actualLabor: null, actualMaterial: null });
    expect(result).toEqual({
      actual_cost: null,
      labor_cost_variance: null,
      material_cost_variance: null,
      cost_variance: null
    });
  });
});
