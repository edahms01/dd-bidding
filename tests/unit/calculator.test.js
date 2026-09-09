import { describe, it, expect } from 'vitest';
import {
  calculateWallCosts,
  calculateCeilingCosts,
  calculateLogistics,
  disposalMonthsFor,
  buildCostSummary,
  applyMarkup,
  computeWeightedWastePct,
  applyRateEscalation
} from '../../js/calculator.js';
import seedData from '../../data/seed.json';

function sampleRates(overrides = {}) {
  return {
    framing: 4.20, hanging: 0.95, extwall: 1.90,
    finish: { 1: 0.55, 2: 0.75, 3: 1.10, 4: 1.55, 5: 2.40 },
    stud: { '3-5/8"': 0.52 },
    board: { Standard: 0.48 },
    tape: 0.14, insul: 0.32, fasten: 0.11,
    delivery: 380, lift: 650, disposal: 420,
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

describe('calculateWallCosts — Exterior wall rate swap', () => {
  // An assembly flagged Exterior (assemblies[].exteriorWall === 'Yes')
  // costs its hanging labor at rates.extwall instead of rates.hanging.
  // Straight swap, Wall-category only, nothing else in the formula moves.
  const rates = sampleRates({ hanging: 0.95, extwall: 1.90 });
  const conditions = sampleConditions({ wastePct: 10 });

  it('an Exterior-flagged wall assembly uses rates.extwall for hanging labor', () => {
    const [row] = calculateWallCosts(
      [sampleWall()], [sampleAssembly({ exteriorWall: 'Yes' })], rates, conditions
    );
    expect(row.hangingLabor).toBeCloseTo(row.netSF * 1 * 1.90, 6);
  });

  it('a non-Exterior wall assembly is unaffected by rates.extwall (flag "No" or absent)', () => {
    const [noFlag] = calculateWallCosts(
      [sampleWall()], [sampleAssembly({ exteriorWall: 'No' })], rates, conditions
    );
    const [keyAbsent] = calculateWallCosts(
      [sampleWall()], [sampleAssembly()], rates, conditions
    );
    expect(noFlag.hangingLabor).toBeCloseTo(noFlag.netSF * 1 * 0.95, 6);
    expect(keyAbsent.hangingLabor).toBeCloseTo(keyAbsent.netSF * 1 * 0.95, 6);
  });

  it('the swap replaces the hanging rate, it does not stack — every other component is identical to a normal wall', () => {
    const spec = { studSize: '3-5/8"', boardType: 'Standard', finishLevel: 3, layers: 2, acoustic: 'No' };
    const [normal] = calculateWallCosts(
      [sampleWall()], [sampleAssembly({ ...spec, exteriorWall: 'No' })], rates, conditions
    );
    const [exterior] = calculateWallCosts(
      [sampleWall()], [sampleAssembly({ ...spec, exteriorWall: 'Yes' })], rates, conditions
    );

    // Only hangingLabor differs, and by exactly (extwall - hanging) * netSF * layers.
    expect(exterior.hangingLabor).toBeCloseTo(normal.netSF * 2 * 1.90, 6);
    expect(exterior.laborTotal - normal.laborTotal).toBeCloseTo(normal.netSF * 2 * (1.90 - 0.95), 6);

    for (const k of ['framingLabor', 'finishingLabor', 'studMaterial',
      'boardMaterialBase', 'boardMaterial', 'tapeMaterial', 'fastenMaterial',
      'insulMaterial', 'materialTotal']) {
      expect(exterior[k]).toBeCloseTo(normal[k], 6);
    }
  });

  it('calculateCeilingCosts ignores exteriorWall entirely — Exterior is Wall-only', () => {
    const [withFlag] = calculateCeilingCosts(
      [sampleCeiling()], [sampleAssembly({ id: 'C1', category: 'Ceiling', exteriorWall: 'Yes' })], rates, conditions
    );
    const [without] = calculateCeilingCosts(
      [sampleCeiling()], [sampleAssembly({ id: 'C1', category: 'Ceiling' })], rates, conditions
    );
    expect(withFlag.hangingLabor).toBeCloseTo(without.hangingLabor, 6);
    expect(withFlag.hangingLabor).toBeCloseTo(without.netSF * 1 * 0.95, 6);
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
    // 0% burden / 0% supervision — directCostTotal must be identical to the
    // pre-burden-fix behavior (raw labor + material + logistics).
    const summary = buildCostSummary(walls, ceilings, logistics, 10, 0, 0, 0, 0, 0, 0);

    expect(summary.laborTotal).toBeCloseTo(walls[0].laborTotal, 6);
    expect(summary.materialTotal).toBeCloseTo(walls[0].materialTotal, 6);
    expect(summary.burden).toBe(0);
    expect(summary.supervision).toBe(0);
    expect(summary.laborWithBurden).toBeCloseTo(summary.laborTotal, 6);
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
    const summary = buildCostSummary(wallCosts, [], calculateLogistics(conditions, sampleRates()), conditions.wastePct, 0, 0, 0, 0, 0, 0);

    // Both rows have identical boardMaterialBase (same netSF/layers/boardType),
    // one at 0% waste and one at 10% waste -> blended average is 5%, not a
    // naive average of "0 and 10" applied to unequal dollar weights (here
    // the weights happen to be equal, so 5% is also the naive average --
    // covered distinctly by the computeWeightedWastePct blend test below).
    expect(summary.weightedWastePct).toBeCloseTo(5, 6);
  });
});

describe('buildCostSummary — labor burden + supervision (applyLaborBurden wired in)', () => {
  function setup(burdenPct, superPct) {
    const conditions = sampleConditions({ wastePct: 10 });
    const walls    = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), conditions);
    const logistics = calculateLogistics(conditions, sampleRates());
    const summary  = buildCostSummary(walls, [], logistics, 10, burdenPct, superPct, 0, 0, 0, 0);
    return { walls, logistics, summary };
  }

  it('computes burden / supervision off the given rates and folds them into directCostTotal before markup', () => {
    const { walls, logistics, summary } = setup(32, 8);
    const raw = walls[0].laborTotal;

    expect(summary.laborTotal).toBeCloseTo(raw, 6);            // raw stays raw
    expect(summary.burden).toBeCloseTo(raw * 0.32, 6);
    expect(summary.supervision).toBeCloseTo(raw * 0.08, 6);
    expect(summary.laborWithBurden).toBeCloseTo(raw * 1.40, 6);
    expect(summary.directCostTotal).toBeCloseTo(
      summary.laborWithBurden + summary.materialTotal + logistics.total, 6);
    // directCostTotal is built on laborWithBurden, not raw laborTotal
    expect(summary.directCostTotal).toBeGreaterThan(
      summary.laborTotal + summary.materialTotal + logistics.total);
  });

  it('0% / 0% leaves directCostTotal identical to the pre-fix (raw) behavior', () => {
    const { walls, logistics, summary } = setup(0, 0);
    expect(summary.burden).toBe(0);
    expect(summary.supervision).toBe(0);
    expect(summary.directCostTotal).toBeCloseTo(
      walls[0].laborTotal + summary.materialTotal + logistics.total, 6);
  });

  it('coerces a missing / empty-string rate to 0 rather than NaN', () => {
    const { summary } = setup(undefined, '');
    expect(summary.burden).toBe(0);
    expect(summary.supervision).toBe(0);
    expect(Number.isFinite(summary.directCostTotal)).toBe(true);
  });
});

describe('buildCostSummary — height adders (Above 12 ft / Above 20 ft)', () => {
  function setup({ a12 = 0, a20 = 0, sf12 = 0, sf20 = 0, burdenPct = 0, superPct = 0 } = {}) {
    const conditions = sampleConditions({ wastePct: 10 });
    const walls    = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), conditions);
    const logistics = calculateLogistics(conditions, sampleRates());
    const summary  = buildCostSummary(walls, [], logistics, 10, burdenPct, superPct, a12, a20, sf12, sf20);
    const totalSF  = walls.reduce((s, r) => s + (r.netSF || 0), 0);
    const avg      = summary.laborTotal / totalSF;
    return { walls, logistics, summary, avg };
  }

  it('applies only the 12 ft adder when sfAbove20 is 0', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 100, sf20: 0 });
    expect(summary.heightUplift12).toBeCloseTo(100 * avg * 0.15, 6);
    expect(summary.heightUplift20).toBe(0);
    expect(summary.laborWithHeightUplift).toBeCloseTo(summary.laborTotal + summary.heightUplift12, 6);
    expect(summary.laborTotal).toBeCloseTo(summary.laborWithHeightUplift - summary.heightUplift12, 6); // raw unchanged
  });

  it('stacks both adders on the sfAbove20 band', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 0, sf20: 100 });
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBeCloseTo(100 * avg * 0.45, 6); // (15 + 30) / 100
  });

  it('both bands non-zero: 12 ft band gets a12 only, 20 ft band gets a12+a20', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 200, sf20: 100 });
    expect(summary.heightUplift12).toBeCloseTo(200 * avg * 0.15, 6);
    expect(summary.heightUplift20).toBeCloseTo(100 * avg * 0.45, 6);
    expect(summary.laborWithHeightUplift).toBeCloseTo(
      summary.laborTotal + summary.heightUplift12 + summary.heightUplift20, 6);
  });

  it('both adders 0 -> identical to pre-fix (additive change only)', () => {
    const { summary, logistics, walls } = setup({ a12: 0, a20: 0, sf12: 500, sf20: 500 });
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBe(0);
    expect(summary.directCostTotal).toBeCloseTo(
      walls[0].laborTotal + summary.materialTotal + logistics.total, 6);
  });

  it('burden loads on top of the height uplift, not the other way around', () => {
    const { summary } = setup({ a12: 20, a20: 0, sf12: 300, sf20: 0, burdenPct: 30, superPct: 10 });
    expect(summary.burden).toBeCloseTo(summary.laborWithHeightUplift * 0.30, 6);
    expect(summary.supervision).toBeCloseTo(summary.laborWithHeightUplift * 0.10, 6);
    expect(summary.laborWithBurden).toBeCloseTo(summary.laborWithHeightUplift * 1.40, 6);
    expect(summary.directCostTotal).toBeCloseTo(
      summary.laborWithBurden + summary.materialTotal + summary.logisticsTotal, 6);
  });

  it('coerces missing / empty-string adder + SF args to 0', () => {
    const conditions = sampleConditions({ wastePct: 10 });
    const walls = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), conditions);
    const logistics = calculateLogistics(conditions, sampleRates());
    const summary = buildCostSummary(walls, [], logistics, 10, 0, 0, undefined, '', undefined, '');
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBe(0);
    expect(Number.isFinite(summary.directCostTotal)).toBe(true);
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

describe('applyRateEscalation', () => {
  function rates() {
    return {
      stud:  { '1-5/8"': 0.38, '2-1/2"': 0.44, '3-5/8"': 0.52, '4"': 0.61, '6"': 0.78 },
      board: { Standard: 0.48, 'Type-X': 0.58, Moisture: 0.64, Impact: 0.72 },
      tape: 0.14, insul: 0.32, fasten: 0.11,
      framing: 4.20, hanging: 0.95, burdenPct: 34, superPct: 9
    };
  }

  it('with no escalation set anywhere, every material rate is unchanged', () => {
    const r = rates();
    const result = applyRateEscalation(r, {});
    expect(result.stud).toEqual(r.stud);
    expect(result.board).toEqual(r.board);
    expect(result.tape).toBe(r.tape);
    expect(result.insul).toBe(r.insul);
    expect(result.fasten).toBe(r.fasten);
  });

  it('escalates a single stud size and a single board type, leaving every other material line untouched', () => {
    const r = rates();
    const result = applyRateEscalation(r, { stud: { '2-1/2"': 5 }, board: { 'Type-X': 10 } });

    expect(result.stud['2-1/2"']).toBeCloseTo(0.44 * 1.05, 6);
    expect(result.board['Type-X']).toBeCloseTo(0.58 * 1.10, 6);

    // Every other stud size and board type is unaffected.
    expect(result.stud['1-5/8"']).toBe(r.stud['1-5/8"']);
    expect(result.stud['3-5/8"']).toBe(r.stud['3-5/8"']);
    expect(result.stud['4"']).toBe(r.stud['4"']);
    expect(result.stud['6"']).toBe(r.stud['6"']);
    expect(result.board.Standard).toBe(r.board.Standard);
    expect(result.board.Moisture).toBe(r.board.Moisture);
    expect(result.board.Impact).toBe(r.board.Impact);

    // Non-material lines are untouched.
    expect(result.tape).toBe(r.tape);
    expect(result.insul).toBe(r.insul);
    expect(result.fasten).toBe(r.fasten);
    expect(result.framing).toBe(r.framing);
    expect(result.hanging).toBe(r.hanging);
  });

  it('does not mutate its input rates object', () => {
    const r = rates();
    const snapshot = JSON.parse(JSON.stringify(r));
    applyRateEscalation(r, { stud: { '2-1/2"': 5 }, board: { 'Type-X': 10 }, tape: 8, insul: 3, fasten: 2 });
    expect(r).toEqual(snapshot);
  });

  it('a totally absent rateEscalation argument is treated the same as no escalation set', () => {
    const r = rates();
    const result = applyRateEscalation(r, undefined);
    expect(result.stud).toEqual(r.stud);
    expect(result.board).toEqual(r.board);
  });
});

describe('golden-bid regression — Harborview Plaza (data/seed.json), current shipped rate/escalation values', () => {
  // These numbers were captured by running the current (Tier 5, Part 2)
  // calculator.js -- with applyRateEscalation() wired in exactly the way
  // js/ui.js's runCalculation()/submitBid() call it -- against the current
  // data/seed.json fixture, then pinned here as a fixed regression target,
  // not hand-derived. The fixture is no longer "no overrides anywhere":
  // seed.json now carries a real 5% escalation on 2-1/2" stud and Type-X
  // board (see Seed data, Tier 5 Part 2 plan), so these numbers reflect
  // that escalation actually being applied, same as the live app would
  // compute for this exact fixture.
  it('produces byte-for-byte identical totals to the pinned baseline', () => {
    const seed = seedData.project_state;
    const escalatedRates = applyRateEscalation(seed.rates, seed.rateEscalation);
    const wallCosts  = calculateWallCosts(seed.walls, seed.assemblies, escalatedRates, seed.conditions);
    const ceilCosts  = calculateCeilingCosts(seed.ceilings, seed.assemblies, escalatedRates, seed.conditions);
    const logistics  = calculateLogistics(seed.conditions, seed.rates);
    const summary    = buildCostSummary(wallCosts, ceilCosts, logistics, seed.conditions.wastePct,
      seed.rates.burdenPct, seed.rates.superPct,
      seed.rates.adder12Pct, seed.rates.adder20Pct,
      seed.conditions.sfAbove12, seed.conditions.sfAbove20);
    const markup     = applyMarkup(summary, seed.markupInputs);

    expect(summary.laborTotal).toBeCloseTo(76956, 3);
    expect(summary.materialTotal).toBeCloseTo(21490.6168, 3);
    // Height adders now load onto raw labor before burden (seed: adder12Pct 18,
    // adder20Pct 35, sfAbove12 3200, sfAbove20 0; job totalSF 17520):
    //   avgLaborPerSF          = 76956 / 17520           = 4.392465753424657
    //   heightUplift12         = 3200 × avg × 0.18       = 2530.0602739726028
    //   heightUplift20         = 0 (sfAbove20 = 0)
    //   laborWithHeightUplift                            = 79486.0602739726
    expect(summary.heightUplift12).toBeCloseTo(2530.0602739726028, 3);
    expect(summary.heightUplift20).toBe(0);
    expect(summary.laborWithHeightUplift).toBeCloseTo(79486.0602739726, 3);
    // Labor burden + supervision then load onto the height-adjusted labor
    // (seed rates: burdenPct 34, superPct 9):
    //   burden       = 79486.0602739726 × 0.34 = 27025.260493150683
    //   supervision  = 79486.0602739726 × 0.09 =  7153.7454246575335
    //   laborWithBurden                        = 113665.06619178082
    expect(summary.burden).toBeCloseTo(27025.260493150683, 3);
    expect(summary.supervision).toBeCloseTo(7153.7454246575335, 3);
    expect(summary.laborWithBurden).toBeCloseTo(113665.06619178082, 3);
    // directCostTotal / finalBidPrice re-pinned: laborWithBurden (113665.06619178082)
    // + materialTotal (21490.6168) + logistics.total (13060.00) = 148215.6829917808;
    // markup is a flat ×1.3 (30%), so finalBidPrice = 192680.38788931505.
    // effectiveMargin is unchanged — a uniform markup scale preserves it.
    expect(summary.directCostTotal).toBeCloseTo(148215.6829917808, 3);
    expect(markup.finalBidPrice).toBeCloseTo(192680.38788931505, 3);
    expect(markup.effectiveMargin).toBeCloseTo(23.076923076923084, 6);

    // No waste override on any seed assembly -> weighted average must
    // equal the job-wide conditions.wastePct exactly (float noise aside).
    expect(summary.weightedWastePct).toBeCloseTo(seed.conditions.wastePct, 6);
  });
});

describe('calculateLogistics — waste disposal costed per month (2026-09-08)', () => {
  const rates = { delivery: 0, lift: 0, disposal: 420 }; // isolate disposal

  it('floors at 1 month for 0-4 weeks', () => {
    for (const wk of [0, 1, 2, 3, 4]) {
      const r = calculateLogistics({ trips: 0, sfAbove12: 0, durationWeeks: wk }, rates);
      expect(r.disposalMonths).toBe(1);
      expect(r.disposalCost).toBe(420);
    }
  });

  it('rounds up to whole months at 4 weeks/month', () => {
    const cases = [[5, 2], [8, 2], [9, 3], [12, 3], [13, 4], [14, 4], [52, 13]];
    for (const [wk, months] of cases) {
      const r = calculateLogistics({ trips: 0, sfAbove12: 0, durationWeeks: wk }, rates);
      expect(r.disposalMonths, `${wk}wk`).toBe(months);
      expect(r.disposalCost).toBe(months * 420);
    }
  });

  it('disposalCost is included in total alongside delivery and lift', () => {
    const r = calculateLogistics(
      { trips: 2, sfAbove12: 1, durationWeeks: 14 },
      { delivery: 100, lift: 50, disposal: 420 }
    );
    // delivery 2*100=200, lift 14*50=700, disposal 4*420=1680
    expect(r.total).toBe(200 + 700 + 1680);
  });

  it('unconditional — applies even when sfAbove12 is 0 (no lift-style gate)', () => {
    const r = calculateLogistics({ trips: 0, sfAbove12: 0, durationWeeks: 6 }, rates);
    expect(r.liftWeeks).toBe(0);
    expect(r.disposalCost).toBe(2 * 420);
  });

  it('disposalMonthsFor matches OutputPage.jsx\'s inline copy for every week value 0..60', () => {
    // OutputPage.jsx recomputes the month count inline (classic-script /
    // ESM boundary — it cannot import js/calculator.js). This pins the two
    // formulas together so a change to disposalMonthsFor that isn't
    // mirrored in OutputPage is caught here.
    const outputPageInline = (weeks) => Math.max(1, Math.ceil((weeks || 0) / 4));
    for (let wk = 0; wk <= 60; wk++) {
      expect(disposalMonthsFor(wk), `${wk}wk`).toBe(outputPageInline(wk));
    }
    // and the degenerate inputs both guard
    expect(disposalMonthsFor(undefined)).toBe(outputPageInline(undefined));
    expect(disposalMonthsFor(null)).toBe(outputPageInline(null));
  });
});
