import { describe, it, expect } from 'vitest';
import {
  calculateWallCosts,
  calculateCeilingCosts,
  calculateLogistics,
  buildCostSummary,
  applyMarkup,
  computeWeightedWastePct
} from '../../js/calculator.js';
import seedData from '../../data/seed.json';

function sampleRates(overrides = {}) {
  return {
    framing: 4.20, hanging: 0.95,
    finish: { 1: 0.55, 2: 0.75, 3: 1.10, 4: 1.55, 5: 2.40 },
    stud: { '3-5/8"': 0.52 },
    board: { Standard: 0.48 },
    tape: 0.14, insul: 0.32, fasten: 0.11,
    delivery: 380, lift: 650,
    ...overrides
  };
}

function sampleConditions(overrides = {}) {
  return { wastePct: 10, trips: 1, sfAbove12: 0, durationWeeks: 1, ...overrides };
}

function sampleAssembly(overrides = {}) {
  return {
    id: 'W1', category: 'Wall', studSize: '3-5/8"', spacing: '16"',
    layers: 1, boardType: 'Standard', fireRating: 'None',
    acoustic: 'No', finishLevel: 3, notes: '',
    ...overrides
  };
}

function sampleWall(overrides = {}) {
  return { location: 'Test wall', typeId: 'W1', lf: 100, netSF: 1000, ...overrides };
}

function sampleCeiling(overrides = {}) {
  return { location: 'Test ceiling', typeId: 'C1', netSF: 1000, ...overrides };
}

describe('calculateWallCosts — per-assembly waste override', () => {
  it('with no override on the assembly, uses conditions.wastePct (today\'s behavior)', () => {
    const [row] = calculateWallCosts(
      [sampleWall()], [sampleAssembly()], sampleRates(), sampleConditions({ wastePct: 10 })
    );
    expect(row.boardMaterial).toBeCloseTo(row.boardMaterialBase * 1.10, 6);
  });

  it('with an override set, uses the override instead of conditions.wastePct', () => {
    const [row] = calculateWallCosts(
      [sampleWall()],
      [sampleAssembly({ wastePctOverride: 25 })],
      sampleRates(),
      sampleConditions({ wastePct: 10 })
    );
    expect(row.boardMaterial).toBeCloseTo(row.boardMaterialBase * 1.25, 6);
  });

  it('an explicit wastePctOverride of 0 produces zero waste — distinct from unset', () => {
    const [zeroRow] = calculateWallCosts(
      [sampleWall()],
      [sampleAssembly({ wastePctOverride: 0 })],
      sampleRates(),
      sampleConditions({ wastePct: 10 })
    );
    const [unsetRow] = calculateWallCosts(
      [sampleWall()],
      [sampleAssembly({ wastePctOverride: null })],
      sampleRates(),
      sampleConditions({ wastePct: 10 })
    );
    expect(zeroRow.boardMaterial).toBeCloseTo(zeroRow.boardMaterialBase, 6); // no waste added
    expect(unsetRow.boardMaterial).toBeCloseTo(unsetRow.boardMaterialBase * 1.10, 6); // falls back to 10%
    expect(zeroRow.boardMaterial).not.toBeCloseTo(unsetRow.boardMaterial, 2);
  });

  it('mixed assemblies in one call each resolve their own effective rate independently', () => {
    const assemblies = [
      sampleAssembly({ id: 'W1', wastePctOverride: 30 }),
      sampleAssembly({ id: 'W2' }) // no override -> falls back to conditions.wastePct
    ];
    const walls = [
      sampleWall({ typeId: 'W1', location: 'Overridden' }),
      sampleWall({ typeId: 'W2', location: 'Default' })
    ];
    const [overriddenRow, defaultRow] = calculateWallCosts(walls, assemblies, sampleRates(), sampleConditions({ wastePct: 10 }));
    expect(overriddenRow.boardMaterial).toBeCloseTo(overriddenRow.boardMaterialBase * 1.30, 6);
    expect(defaultRow.boardMaterial).toBeCloseTo(defaultRow.boardMaterialBase * 1.10, 6);
  });
});

describe('calculateCeilingCosts — per-assembly waste override (parity with walls)', () => {
  it('with no override on the assembly, uses conditions.wastePct', () => {
    const [row] = calculateCeilingCosts(
      [sampleCeiling()], [sampleAssembly({ id: 'C1', category: 'Ceiling' })], sampleRates(), sampleConditions({ wastePct: 10 })
    );
    expect(row.boardMaterial).toBeCloseTo(row.boardMaterialBase * 1.10, 6);
  });

  it('with an override set, uses the override instead of conditions.wastePct', () => {
    const [row] = calculateCeilingCosts(
      [sampleCeiling()],
      [sampleAssembly({ id: 'C1', category: 'Ceiling', wastePctOverride: 25 })],
      sampleRates(),
      sampleConditions({ wastePct: 10 })
    );
    expect(row.boardMaterial).toBeCloseTo(row.boardMaterialBase * 1.25, 6);
  });

  it('an explicit wastePctOverride of 0 produces zero waste on ceilings too', () => {
    const [row] = calculateCeilingCosts(
      [sampleCeiling()],
      [sampleAssembly({ id: 'C1', category: 'Ceiling', wastePctOverride: 0 })],
      sampleRates(),
      sampleConditions({ wastePct: 10 })
    );
    expect(row.boardMaterial).toBeCloseTo(row.boardMaterialBase, 6);
  });
});

describe('buildCostSummary — unaffected by the new boardMaterialBase field / 4th argument', () => {
  it('laborTotal/materialTotal/directCostTotal still sum correctly with no overrides present', () => {
    const walls    = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), sampleConditions({ wastePct: 10 }));
    const ceilings = calculateCeilingCosts([], [], sampleRates(), sampleConditions({ wastePct: 10 }));
    const logistics = calculateLogistics(sampleConditions({ wastePct: 10 }), sampleRates());
    const summary = buildCostSummary(walls, ceilings, logistics, 10);

    expect(summary.laborTotal).toBeCloseTo(walls[0].laborTotal, 6);
    expect(summary.materialTotal).toBeCloseTo(walls[0].materialTotal, 6);
    expect(summary.directCostTotal).toBeCloseTo(summary.laborTotal + summary.materialTotal + logistics.total, 6);
  });

  it('returns the correct weightedWastePct for a mix of overridden and non-overridden assemblies', () => {
    const assemblies = [
      sampleAssembly({ id: 'W1', wastePctOverride: 0 }),
      sampleAssembly({ id: 'W2' }) // falls back to conditions.wastePct (10)
    ];
    const walls = [
      sampleWall({ typeId: 'W1', netSF: 1000 }),
      sampleWall({ typeId: 'W2', netSF: 1000 })
    ];
    const conditions = sampleConditions({ wastePct: 10 });
    const wallCosts = calculateWallCosts(walls, assemblies, sampleRates(), conditions);
    const summary = buildCostSummary(wallCosts, [], calculateLogistics(conditions, sampleRates()), conditions.wastePct);

    // Both rows have identical boardMaterialBase (same netSF/layers/boardType),
    // one at 0% waste and one at 10% waste -> blended average is 5%, not a
    // naive average of "0 and 10" applied to unequal dollar weights (here
    // the weights happen to be equal, so 5% is also the naive average --
    // covered distinctly by the computeWeightedWastePct blend test below).
    expect(summary.weightedWastePct).toBeCloseTo(5, 6);
  });
});

describe('computeWeightedWastePct', () => {
  it('returns the single rate when every row shares the same effective waste', () => {
    const rows = [
      { boardMaterialBase: 100, boardMaterial: 110 },
      { boardMaterialBase: 200, boardMaterial: 220 }
    ];
    expect(computeWeightedWastePct(rows, 0)).toBeCloseTo(10, 6);
  });

  it('blends by dollar weight, not a naive average of each row\'s own rate', () => {
    const rows = [
      { boardMaterialBase: 900, boardMaterial: 900 },   // 0% waste, big dollar weight
      { boardMaterialBase: 100, boardMaterial: 140 }    // 40% waste, small dollar weight
    ];
    // naive average of (0, 40) would be 20% -- the correct dollar-weighted
    // answer is total waste ($40) / total base ($1000) = 4%.
    expect(computeWeightedWastePct(rows, 0)).toBeCloseTo(4, 6);
  });

  it('falls back to fallbackPct when there is no board material to weight against', () => {
    expect(computeWeightedWastePct([], 12)).toBe(12);
    expect(computeWeightedWastePct([{ error: 'Assembly not found' }], 12)).toBe(12);
  });

  it('rows with .error (no boardMaterial/boardMaterialBase fields) contribute nothing, valid rows still average correctly', () => {
    const rows = [
      { error: 'Assembly not found: X' },
      { boardMaterialBase: 100, boardMaterial: 115 }
    ];
    expect(computeWeightedWastePct(rows, 0)).toBeCloseTo(15, 6);
  });
});

describe('golden-bid regression — Harborview Plaza (data/seed.json), no overrides set anywhere', () => {
  // These numbers were captured by running the pre-Tier-3 calculator.js
  // against this exact fixture before any change in this phase was made,
  // then pinned here as a fixed regression target -- not hand-derived.
  // See the Tier 3 plan's Step 0 finding #10 for why hand-deriving these
  // would be unsafe (several rate fields, e.g. burdenPct/superPct, look
  // relevant but have zero consumer in these functions).
  it('produces byte-for-byte identical totals to the pre-change baseline', () => {
    const seed = seedData.project_state;
    const wallCosts  = calculateWallCosts(seed.walls, seed.assemblies, seed.rates, seed.conditions);
    const ceilCosts  = calculateCeilingCosts(seed.ceilings, seed.assemblies, seed.rates, seed.conditions);
    const logistics  = calculateLogistics(seed.conditions, seed.rates);
    const summary    = buildCostSummary(wallCosts, ceilCosts, logistics, seed.conditions.wastePct);
    const markup     = applyMarkup(summary, seed.markupInputs);

    expect(summary.laborTotal).toBeCloseTo(76956, 3);
    expect(summary.materialTotal).toBeCloseTo(21089.164, 3);
    expect(summary.directCostTotal).toBeCloseTo(109425.164, 3);
    expect(markup.finalBidPrice).toBeCloseTo(145535.46812, 3);
    expect(markup.effectiveMargin).toBeCloseTo(24.81203007518797, 6);

    // No override on any seed assembly -> weighted average must equal the
    // job-wide conditions.wastePct exactly (float noise aside).
    expect(summary.weightedWastePct).toBeCloseTo(seed.conditions.wastePct, 6);
  });
});
