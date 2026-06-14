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
  const wasteMult = 1 + conditions.wastePct / 100;
  const asmMap    = Object.fromEntries(assemblies.map(a => [a.id, a]));

  return walls.map(w => {
    const asm = asmMap[w.typeId];
    if (!asm) return {
      location: w.location, typeId: w.typeId, lf: w.lf, netSF: w.netSF,
      error: 'Assembly not found: ' + (w.typeId || '(empty)'),
      laborTotal: 0, materialTotal: 0, total: 0
    };

    const framingLabor   = w.lf    * rates.framing;
    const hangingLabor   = w.netSF * asm.layers * rates.hanging;
    const finishingLabor = w.netSF * (rates.finish[asm.finishLevel] || 0);
    const studMaterial   = w.lf    * (rates.stud[asm.studSize] || 0);
    const boardMaterial  = w.netSF * asm.layers * (rates.board[asm.boardType] || 0) * wasteMult;
    const tapeMaterial   = w.netSF * rates.tape;
    const fastenMaterial = w.netSF * rates.fasten;
    const insulMaterial  = asm.acoustic === 'Yes' ? w.netSF * rates.insul : 0;

    const laborTotal    = framingLabor + hangingLabor + finishingLabor;
    const materialTotal = studMaterial + boardMaterial + tapeMaterial + fastenMaterial + insulMaterial;

    return {
      location: w.location, typeId: w.typeId, lf: w.lf, netSF: w.netSF,
      layers: asm.layers, finishLevel: asm.finishLevel,
      framingLabor, hangingLabor, finishingLabor,
      studMaterial, boardMaterial, tapeMaterial, fastenMaterial, insulMaterial,
      laborTotal, materialTotal, total: laborTotal + materialTotal
    };
  });
}

function calculateCeilingCosts(ceilings, assemblies, rates, conditions) {
  const wasteMult = 1 + conditions.wastePct / 100;
  const asmMap    = Object.fromEntries(assemblies.map(a => [a.id, a]));

  return ceilings.map(c => {
    const asm = asmMap[c.typeId];
    if (!asm) return {
      location: c.location, typeId: c.typeId, netSF: c.netSF,
      error: 'Assembly not found: ' + (c.typeId || '(empty)'),
      laborTotal: 0, materialTotal: 0, total: 0
    };

    const framingLabor   = c.netSF * rates.framing; // ceilings use SF-based framing rate
    const hangingLabor   = c.netSF * asm.layers * rates.hanging;
    const finishingLabor = c.netSF * (rates.finish[asm.finishLevel] || 0);
    const boardMaterial  = c.netSF * asm.layers * (rates.board[asm.boardType] || 0) * wasteMult;
    const tapeMaterial   = c.netSF * rates.tape;
    const fastenMaterial = c.netSF * rates.fasten;
    const insulMaterial  = asm.acoustic === 'Yes' ? c.netSF * rates.insul : 0;

    const laborTotal    = framingLabor + hangingLabor + finishingLabor;
    const materialTotal = boardMaterial + tapeMaterial + fastenMaterial + insulMaterial;

    return {
      location: c.location, typeId: c.typeId, netSF: c.netSF,
      layers: asm.layers, finishLevel: asm.finishLevel,
      framingLabor, hangingLabor, finishingLabor,
      boardMaterial, tapeMaterial, fastenMaterial, insulMaterial,
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

function calculateLogistics(conditions, rates) {
  const deliveryCost = conditions.trips * rates.delivery;
  const liftWeeks    = conditions.sfAbove12 > 0 ? Math.max(1, conditions.durationWeeks) : 0;
  const liftCost     = liftWeeks * rates.lift;
  return {
    deliveryCost,
    liftWeeks,
    liftCost,
    total: deliveryCost + liftCost
  };
}

function buildCostSummary(wallCosts, ceilingCosts, logistics) {
  const laborTotal    = wallCosts.reduce((s, r)    => s + (r.laborTotal    || 0), 0)
                      + ceilingCosts.reduce((s, r) => s + (r.laborTotal    || 0), 0);
  const materialTotal = wallCosts.reduce((s, r)    => s + (r.materialTotal || 0), 0)
                      + ceilingCosts.reduce((s, r) => s + (r.materialTotal || 0), 0);
  return {
    laborTotal,
    materialTotal,
    logisticsTotal:  logistics.total,
    directCostTotal: laborTotal + materialTotal + logistics.total
  };
}

// markupInputs: { overheadPct, contingencyPct, profitPct, escalationPct }
// escalationPct is already zeroed by collectFormData() if start date < 60 days out.
function applyMarkup(summary, markupInputs) {
  const overhead    = summary.directCostTotal * (markupInputs.overheadPct    / 100);
  const contingency = summary.directCostTotal * (markupInputs.contingencyPct / 100);
  const profit      = summary.directCostTotal * (markupInputs.profitPct      / 100);
  const escalation  = summary.directCostTotal * (markupInputs.escalationPct  / 100);
  const totalMarkup   = overhead + contingency + profit + escalation;
  const finalBidPrice = summary.directCostTotal + totalMarkup;
  const effectiveMargin = finalBidPrice > 0
    ? ((finalBidPrice - summary.directCostTotal) / finalBidPrice) * 100
    : 0;
  return {
    directCostTotal: summary.directCostTotal,
    overhead, contingency, profit, escalation,
    totalMarkup, finalBidPrice, effectiveMargin
  };
}
