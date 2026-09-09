// ─────────────────────────────────────────────────────────────────────
// calculator.js — Pure calculation engine (Phase 3)
// Takes state objects from collectFormData() as input.
// Returns result objects. Zero DOM access — no side effects.
//
// Future: moves to a backend API endpoint unchanged. The function
//         signatures are the stable API contract between the data
//         layer and the render layer.
// ─────────────────────────────────────────────────────────────────────

function calculateWallCosts(walls, assemblies, rates, conditions) {
  const asmMap = Object.fromEntries(assemblies.map(a => [a.id, a]));

  return walls.map(w => {
    const asm = asmMap[w.typeId];
    if (!asm) return {
      location: w.location, typeId: w.typeId, lf: w.lf, netSF: w.netSF,
      error: 'Assembly not found: ' + (w.typeId || '(empty)'),
      laborTotal: 0, materialTotal: 0, total: 0
    };

    // Per-assembly waste override (Tier 3) falls back to the job-wide
    // default — ?? not || so an explicit 0% override isn't mistaken
    // for "not set" (see js/state.js's collectFormData()).
    const effectiveWaste = asm.wastePctOverride ?? conditions.wastePct;
    const wasteMult       = 1 + effectiveWaste / 100;

    // An assembly flagged Exterior (Assemblies tab) uses the External wall
    // rate in place of the standard drywall-hanging rate — a straight
    // swap, not stacked, and it touches nothing else in the wall formula.
    // Wall-category only; calculateCeilingCosts() never reads this flag.
    const hangingRate       = asm.exteriorWall === 'Yes' ? rates.extwall : rates.hanging;
    const framingLabor      = w.lf    * rates.framing;
    const hangingLabor      = w.netSF * asm.layers * hangingRate;
    const finishingLabor    = w.netSF * (rates.finish[asm.finishLevel] || 0);
    const studMaterial      = w.lf    * (rates.stud[asm.studSize] || 0);
    const boardMaterialBase = w.netSF * asm.layers * (rates.board[asm.boardType] || 0);
    const boardMaterial     = boardMaterialBase * wasteMult;
    const tapeMaterial      = w.netSF * rates.tape;
    const fastenMaterial    = w.netSF * rates.fasten;
    const insulMaterial     = asm.acoustic === 'Yes' ? w.netSF * rates.insul : 0;

    const laborTotal    = framingLabor + hangingLabor + finishingLabor;
    const materialTotal = studMaterial + boardMaterial + tapeMaterial + fastenMaterial + insulMaterial;

    return {
      location: w.location, typeId: w.typeId, lf: w.lf, netSF: w.netSF,
      layers: asm.layers, finishLevel: asm.finishLevel,
      framingLabor, hangingLabor, finishingLabor,
      studMaterial, boardMaterialBase, boardMaterial, tapeMaterial, fastenMaterial, insulMaterial,
      laborTotal, materialTotal, total: laborTotal + materialTotal
    };
  });
}

function calculateCeilingCosts(ceilings, assemblies, rates, conditions) {
  const asmMap = Object.fromEntries(assemblies.map(a => [a.id, a]));

  return ceilings.map(c => {
    const asm = asmMap[c.typeId];
    if (!asm) return {
      location: c.location, typeId: c.typeId, netSF: c.netSF,
      error: 'Assembly not found: ' + (c.typeId || '(empty)'),
      laborTotal: 0, materialTotal: 0, total: 0
    };

    // Per-assembly waste override (Tier 3) — see calculateWallCosts() above.
    const effectiveWaste = asm.wastePctOverride ?? conditions.wastePct;
    const wasteMult       = 1 + effectiveWaste / 100;

    const framingLabor      = c.netSF * rates.framing; // ceilings use SF-based framing rate
    const hangingLabor      = c.netSF * asm.layers * rates.hanging;
    const finishingLabor    = c.netSF * (rates.finish[asm.finishLevel] || 0);
    const boardMaterialBase = c.netSF * asm.layers * (rates.board[asm.boardType] || 0);
    const boardMaterial     = boardMaterialBase * wasteMult;
    const tapeMaterial      = c.netSF * rates.tape;
    const fastenMaterial    = c.netSF * rates.fasten;
    const insulMaterial     = asm.acoustic === 'Yes' ? c.netSF * rates.insul : 0;

    const laborTotal    = framingLabor + hangingLabor + finishingLabor;
    const materialTotal = boardMaterial + tapeMaterial + fastenMaterial + insulMaterial;

    return {
      location: c.location, typeId: c.typeId, netSF: c.netSF,
      layers: asm.layers, finishLevel: asm.finishLevel,
      framingLabor, hangingLabor, finishingLabor,
      boardMaterialBase, boardMaterial, tapeMaterial, fastenMaterial, insulMaterial,
      laborTotal, materialTotal, total: laborTotal + materialTotal
    };
  });
}

// burdenRate and supervisionRate are percentages (e.g. 32 means 32%)
function applyLaborBurden(laborSubtotal, burdenRate, supervisionRate) {
  const burden      = laborSubtotal * (burdenRate     / 100);
  const supervision = laborSubtotal * (supervisionRate / 100);
  return {
    laborSubtotal,
    burden,
    supervision,
    laborWithBurden: laborSubtotal + burden + supervision
  };
}

// Job duration (weeks) → whole months for the per-month waste-disposal
// rate. 4 weeks/month is a deliberate simplification (not the calendar
// 4.33); minimum 1 month, mirroring liftWeeks' Math.max(1, ...) floor.
function disposalMonthsFor(durationWeeks) {
  return Math.max(1, Math.ceil((durationWeeks || 0) / 4));
}

function calculateLogistics(conditions, rates) {
  const deliveryCost   = conditions.trips * rates.delivery;
  const liftWeeks      = conditions.sfAbove12 > 0 ? Math.max(1, conditions.durationWeeks) : 0;
  const liftCost       = liftWeeks * rates.lift;
  // Disposal is a per-month rental, same shape as the lift (rate × count,
  // min 1) — always applies, no sfAbove12-style gate.
  const disposalMonths = disposalMonthsFor(conditions.durationWeeks);
  const disposalCost   = disposalMonths * rates.disposal;
  return {
    deliveryCost,
    liftWeeks,
    liftCost,
    disposalMonths,
    disposalCost,
    total: deliveryCost + liftCost + disposalCost
  };
}

// Weighted-average waste percentage actually applied across board
// material in the given wall/ceiling cost rows — total waste dollars
// over total base (pre-waste) board dollars, NOT a naive average of
// each row's own rate (Tier 3: per-assembly waste overrides mean rows
// can carry different effective rates, and a big low-waste run should
// outweigh a small high-waste run in the displayed blend). Falls back
// to fallbackPct when there's no board material to weight against
// (every row errored, or zero net SF everywhere) to avoid a 0/0 divide.
function computeWeightedWastePct(rows, fallbackPct) {
  let base = 0, waste = 0;
  rows.forEach(r => {
    const b = r.boardMaterialBase || 0;
    const m = r.boardMaterial     || 0;
    base  += b;
    waste += (m - b);
  });
  return base > 0 ? (waste / base) * 100 : fallbackPct;
}

function buildCostSummary(wallCosts, ceilingCosts, logistics, fallbackWastePct, burdenPct, superPct) {
  const laborTotal    = wallCosts.reduce((s, r)    => s + (r.laborTotal    || 0), 0)
                      + ceilingCosts.reduce((s, r) => s + (r.laborTotal    || 0), 0);
  const materialTotal = wallCosts.reduce((s, r)    => s + (r.materialTotal || 0), 0)
                      + ceilingCosts.reduce((s, r) => s + (r.materialTotal || 0), 0);

  // Labor burden (payroll tax / workers comp / benefits) and supervision
  // (foreman cost) load onto raw labor BEFORE markup — they're part of
  // directCostTotal, the figure overhead/contingency/profit are computed on
  // top of (applyMarkup below), not a separate never-marked-up line.
  // laborTotal stays raw on purpose — buildBidRecord() persists it as the
  // pre-burden split. Number(x) || 0 guards a missing/'' rate (see
  // src/state/store.jsx's empty-string initial values).
  const { burden, supervision, laborWithBurden } =
    applyLaborBurden(laborTotal, Number(burdenPct) || 0, Number(superPct) || 0);

  return {
    laborTotal,
    burden,
    supervision,
    laborWithBurden,
    materialTotal,
    logisticsTotal:  logistics.total,
    directCostTotal: laborWithBurden + materialTotal + logistics.total,
    weightedWastePct: computeWeightedWastePct([...wallCosts, ...ceilingCosts], fallbackWastePct)
  };
}

// markupInputs: { overheadPct, contingencyPct, profitPct }
// No escalationPct — escalation (Tier 5, Part 2) is purely optional and
// per-material-rate-line now, resolved by applyRateEscalation() below,
// before calculateWallCosts()/calculateCeilingCosts() ever run. There is
// no whole-job escalation figure left to apply here.
function applyMarkup(summary, markupInputs) {
  const overhead    = summary.directCostTotal * (markupInputs.overheadPct    / 100);
  const contingency = summary.directCostTotal * (markupInputs.contingencyPct / 100);
  const profit      = summary.directCostTotal * (markupInputs.profitPct      / 100);
  const totalMarkup   = overhead + contingency + profit;
  const finalBidPrice = summary.directCostTotal + totalMarkup;
  const effectiveMargin = finalBidPrice > 0
    ? ((finalBidPrice - summary.directCostTotal) / finalBidPrice) * 100
    : 0;
  return {
    directCostTotal: summary.directCostTotal,
    overhead, contingency, profit,
    totalMarkup, finalBidPrice, effectiveMargin
  };
}

// Resolves escalation once, before any row-level calculation — every
// existing rates.board[x]/rates.stud[x] lookup inside calculateWallCosts()/
// calculateCeilingCosts() picks up the escalated value automatically, with
// zero changes to either function's internals. Material lines only (stud,
// board, tape, insul, fasten) — labor rates, burden/supervision %, and
// logistics (delivery/disposal/lift) don't have commodity-price risk the
// way material rates do; escalating them would be conceptually confused,
// not just out of scope. Does not mutate its input rates object.
function applyRateEscalation(rates, rateEscalation) {
  const esc = rateEscalation || {};
  const scaled = (base, pct) => (pct ? base * (1 + pct / 100) : base);

  const stud = {};
  Object.keys(rates.stud).forEach(k => { stud[k] = scaled(rates.stud[k], esc.stud?.[k]); });
  const board = {};
  Object.keys(rates.board).forEach(k => { board[k] = scaled(rates.board[k], esc.board?.[k]); });

  return {
    ...rates,
    stud, board,
    tape:   scaled(rates.tape,   esc.tape),
    insul:  scaled(rates.insul,  esc.insul),
    fasten: scaled(rates.fasten, esc.fasten)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateWallCosts, calculateCeilingCosts, calculateLogistics, disposalMonthsFor,
    applyLaborBurden, buildCostSummary, applyMarkup, computeWeightedWastePct,
    applyRateEscalation
  };
}
