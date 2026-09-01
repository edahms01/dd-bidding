// ─────────────────────────────────────────────────────────────────────
// state.js — Data layer
// Owns the STATE object and collectFormData(), the single function
// allowed to read the DOM for form values.
//
// STATE is the canonical in-memory snapshot. All other files read
// or write STATE rather than reaching past it into the DOM or into
// each other.
//
// Future: collectFormData() becomes the API request payload builder.
//         STATE is hydrated from an API response on load.
// ─────────────────────────────────────────────────────────────────────

const STATE = {
  conf: ''
};

function collectFormData() {
  function num(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback !== undefined ? fallback : 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? (fallback !== undefined ? fallback : 0) : v;
  }
  function sel(id) {
    return document.getElementById(id)?.value || '';
  }
  // For the Intelligence tab's judgment-signal fields only (see the 8
  // usages below) — a blank field must reach the agent payload as an
  // explicit "not provided" null, not an ambiguous ''. sel() itself stays
  // untouched: it's also used for project.buildingType/bidDate/startDate,
  // none of which are agent-facing judgment signals, and buildingType
  // specifically feeds getHistorySummary(gc, buildingType) lookups that
  // depend on its existing '' fallback.
  function selOrNull(id) {
    return document.getElementById(id)?.value || null;
  }

  const project = {
    name:          document.getElementById('proj-name')?.value.trim()     || '',
    gc:            document.getElementById('proj-gc')?.value.trim()       || '',
    buildingType:  sel('proj-type'),
    bidDate:       sel('proj-bid'),
    address:       document.getElementById('proj-addr')?.value.trim()     || '',
    drawingsRef:   document.getElementById('proj-drawings')?.value.trim() || '',
    startDate:     sel('proj-start'),
    durationWeeks: num('proj-dur', 1),
    floors:        num('proj-floors', 0),
    scope:         Array.from(document.querySelectorAll('.pills .pill.on')).map(el => el.textContent.trim()),
    exclusions:    document.getElementById('proj-exclusions')?.value.trim() || ''
  };

  const assemblies = [];
  document.querySelectorAll('#asm-body tr').forEach(tr => {
    const inp = tr.querySelectorAll('input');
    const sel = tr.querySelectorAll('select');
    if (!inp[0]) return;
    // Number.isNaN, not ||, since an explicit 0% waste override is a
    // real value distinct from "not set" (Tier 3 per-assembly waste).
    const wasteVal = parseFloat(inp[2]?.value);
    assemblies.push({
      id:          inp[0].value.trim(),
      category:    sel[0]?.value || 'Wall',
      studSize:    sel[1]?.value || '3-5/8"',
      spacing:     sel[2]?.value || '16"',
      layers:      parseInt(sel[3]?.value) || 1,
      boardType:   sel[4]?.value || 'Standard',
      fireRating:  sel[5]?.value || 'None',
      acoustic:    sel[6]?.value || 'No',
      finishLevel: parseInt(sel[7]?.value) || 3,
      notes:       inp[1]?.value || '',
      wastePctOverride: Number.isNaN(wasteVal) ? null : wasteVal
    });
  });

  // 3.1: Type ID converting from a free-text <input> to a <select>
  // (TypeIdSelect.jsx) meant tr.querySelectorAll('input')[n] positional
  // indexing would silently skip it and shift every field after it out
  // of alignment (a <select> isn't an <input>). Both loops below read
  // each field by its own stable className (WallsPage.jsx/
  // CeilingsPage.jsx) instead — column order in either page's JSX no
  // longer has to match this function's field order at all.
  function fieldVal(tr, cls) {
    return tr.querySelector('.' + cls)?.value ?? '';
  }

  const walls = [];
  document.querySelectorAll('#wall-body tr').forEach(tr => {
    if (!tr.querySelector('.wall-location')) return;
    const gross = parseFloat(fieldVal(tr, 'wgsf')) || 0;
    const ded   = parseFloat(fieldVal(tr, 'wded')) || 0;
    walls.push({
      location: fieldVal(tr, 'wall-location'),
      typeId:   fieldVal(tr, 'wall-typeid').trim(),
      height:   parseFloat(fieldVal(tr, 'wall-height')) || 0,
      lf:       parseFloat(fieldVal(tr, 'wlf')) || 0,
      grossSF:  gross,
      openings: ded,
      netSF:    Math.max(0, gross - ded)
    });
  });

  const ceilings = [];
  document.querySelectorAll('#ceil-body tr').forEach(tr => {
    if (!tr.querySelector('.ceil-location')) return;
    const gross = parseFloat(fieldVal(tr, 'cgsf')) || 0;
    const ded   = parseFloat(fieldVal(tr, 'cded')) || 0;
    ceilings.push({
      location: fieldVal(tr, 'ceil-location'),
      typeId:   fieldVal(tr, 'ceil-typeid').trim(),
      height:   parseFloat(fieldVal(tr, 'ceil-height')) || 0,
      grossSF:  gross,
      soffitLF: parseFloat(fieldVal(tr, 'ceil-soffitlf')) || 0,
      openings: ded,
      netSF:    Math.max(0, gross - ded)
    });
  });

  const wasteOverride = num('cond-waste', -1);
  const conditions = {
    maxHt:            num('cond-maxht'),
    sfAbove12:        num('cond-sf12'),
    sfAbove20:        num('cond-sf20'),
    curvedWalls:      sel('f-curved'),
    curvedWallsLF:    num('f-curved-lf', 0),
    exteriorExposure: sel('f-exterior'),
    phasedWork:       sel('f-phase'),
    phaseCount:       num('f-phase-n', 0),
    accessDifficulty: sel('f-access'),
    parking:          sel('f-parking'),
    wastePct:         wasteOverride >= 0 ? wasteOverride : 10,
    trips:            num('cond-trips'),
    // A2: Conditions converted to React — STATE.conf is folded into the
    // reducer (conditions.confidence). window.__getConfidence() (set by
    // ConditionsPage.jsx, see src/state/bridges.js) reads the live value
    // from there; STATE.conf kept as a fallback for non-browser/pre-mount
    // contexts (Vitest, or a moment before ConditionsPage first mounts).
    confidence:       (typeof window !== 'undefined' && window.__getConfidence) ? window.__getConfidence() : STATE.conf,
    durationWeeks:    num('proj-dur', 1),
    notes:            document.getElementById('cond-notes')?.value || ''
  };

  const rates = {
    framing:   num('rate-frame'),
    hanging:   num('rate-hang'),
    burdenPct: num('rate-burden', 32),
    superPct:  num('rate-super', 8),
    finish: {
      1: num('rate-fin1'), 2: num('rate-fin2'), 3: num('rate-fin3'),
      4: num('rate-fin4'), 5: num('rate-fin5')
    },
    adder12Pct: num('rate-add12'),
    adder20Pct: num('rate-add20'),
    stud: {
      '1-5/8"': num('rate-stud158'), '2-1/2"': num('rate-stud212'),
      '3-5/8"': num('rate-stud358'), '4"': num('rate-stud4'), '6"': num('rate-stud6')
    },
    board: {
      'Standard': num('rate-brd-std'), 'Type-X':  num('rate-brd-typex'),
      'Moisture': num('rate-brd-moist'), 'Impact': num('rate-brd-imp')
    },
    tape:     num('rate-tape'),
    insul:    num('rate-insul'),
    fasten:   num('rate-fasten'),
    delivery: num('rate-delivery'),
    disposal: num('rate-disposal'),
    lift:     num('rate-lift')
  };

  const markupInputs = {
    overheadPct:    num('markup-overhead'),
    contingencyPct: num('markup-contingency'),
    profitPct:      num('markup-profit')
  };

  // Per-line-item rate escalation (Tier 5, Part 2) — purely optional,
  // purely estimator judgment, no automatic proximity rule. Number.isNaN,
  // not ||, since an explicit 0% escalation is a real value distinct from
  // "not set" (same convention as Tier 3's wastePctOverride, above).
  function escPct(id) {
    const v = parseFloat(document.getElementById(id)?.value);
    return Number.isNaN(v) ? null : v;
  }
  const rateEscalation = {
    stud: {
      '1-5/8"': escPct('esc-stud158'), '2-1/2"': escPct('esc-stud212'),
      '3-5/8"': escPct('esc-stud358'), '4"': escPct('esc-stud4'), '6"': escPct('esc-stud6')
    },
    board: {
      'Standard': escPct('esc-brd-std'), 'Type-X':  escPct('esc-brd-typex'),
      'Moisture': escPct('esc-brd-moist'), 'Impact': escPct('esc-brd-imp')
    },
    tape:   escPct('esc-tape'),
    insul:  escPct('esc-insul'),
    fasten: escPct('esc-fasten')
  };

  const intelligence = {
    crewAvailability:   selOrNull('intel-crew'),
    pipelinePressure:   selOrNull('intel-pipeline'),
    materialTrend:      selOrNull('intel-material-trend'),
    gcRelationship:     selOrNull('intel-gc-rel'),
    gcPriceSensitivity: selOrNull('intel-gc-price'),
    competitionLevel:   selOrNull('intel-competition'),
    knownCompetitors:   document.getElementById('intel-competitors')?.value.trim() || null,
    dirigoEdge:         selOrNull('intel-edge'),
    // Computed count of *other* open drafts, alongside (not replacing) the
    // subjective pipelinePressure dropdown above — the UI shows this as a
    // hint next to the dropdown so the estimator sees it while still making
    // their own call. getAllDrafts()/activeDraftId are js/forms.js globals.
    openDraftCount:     getOpenDraftCount(getAllDrafts(), activeDraftId)
  };

  // 3.3: wallsMode/ceilingsMode are a page-level toggle, not a form
  // value — no DOM element to read the normal way. Same accessor shape
  // as conditions.confidence above (window.__getWallsMode/
  // __getCeilingsMode, registered by WallsPage.jsx/CeilingsPage.jsx via
  // src/state/bridges.js's registerWallsModeReader/
  // registerCeilingsModeReader), with the schema default as the
  // non-browser/pre-mount fallback.
  const wallsMode = (typeof window !== 'undefined' && window.__getWallsMode) ? window.__getWallsMode() : 'dimensions';
  const ceilingsMode = (typeof window !== 'undefined' && window.__getCeilingsMode) ? window.__getCeilingsMode() : 'dimensions';

  return { assemblies, walls, ceilings, conditions, rates, rateEscalation, markupInputs, intelligence, project, wallsMode, ceilingsMode };
}

// Assembles a bid record ready for saveBid(). bid_id and date_submitted are
// assigned server-side (netlify/functions/bids-core.js's stampNewBid(),
// Phase 3) — not present on the object this function returns.
//
// A2.5: finalizeSelection ({ amount, selectedOption }) is what the user
// actually picked in the finalize modal (FinalizeModal.jsx's handleConfirm())
// — a standard agent option's bidAmount, or the custom-override amount.
// final_bid and markup_pct are both derived from that chosen amount, not
// from markupResult (the plain calculator's independent result), which
// used to feed both and is why they were wrong together. The fallback to
// markupResult.finalBidPrice below only matters if this is ever called
// without a selection — submitBid() (js/ui.js) always supplies one today.
function buildBidRecord(state, summary, markupResult, finalizeSelection) {
  const chosenAmount = finalizeSelection?.amount != null
    ? finalizeSelection.amount
    : markupResult.finalBidPrice;
  const markupPct = summary.directCostTotal > 0
    ? Math.round(((chosenAmount - summary.directCostTotal) / summary.directCostTotal) * 1000) / 10
    : 0;
  return {
    project_name:           state.project.name,
    gc:                     state.project.gc,
    building_type:          state.project.buildingType,
    bid_date:               state.project.bidDate,
    start_date:             state.project.startDate,
    direct_cost:            Math.round(summary.directCostTotal),
    // Split captured at submission time — the labor/material split
    // already exists in memory when a bid is finalized (buildCostSummary()),
    // it just didn't survive past this point before. Feeds Tier 2's
    // future labor-burden recalibration report once enough bids
    // accumulate; not read by anything yet.
    estimated_labor_cost:   Math.round(summary.laborTotal),
    estimated_material_cost: Math.round(summary.materialTotal),
    markup_pct:             markupPct,
    final_bid:              Math.round(chosenAmount),
    // A2.5: which finalize-modal option the user actually chose — the
    // reducer's own vocabulary ('competitive'|'recommended'|'ambitious'|
    // 'override'), reused verbatim rather than translated, so it stays
    // aligned with the modal's own data-modal-opt test hooks. null only
    // if buildBidRecord() is ever called without a selection (see above).
    selected_option:        finalizeSelection?.selectedOption ?? null,
    // Redundant with final_bid when selected_option is 'override' (both
    // carry the same chosen amount), kept separately anyway since the
    // record shape doesn't otherwise distinguish "why" from "how much".
    custom_override_amount: finalizeSelection?.selectedOption === 'override'
      ? Math.round(finalizeSelection.amount)
      : null,
    confidence:             state.conditions.confidence,
    intelligence:           state.intelligence,
    outcome:                'pending',
    competitor_who_won:     null,
    winning_bid:            null,
    actual_cost:            null,
    cost_variance:          null,
    // Nullable — populated later via the Update form's split-cost fields
    // (saveUpdate(), js/ui.js), alongside actual_cost/cost_variance above,
    // not replacing them.
    actual_labor_cost:      null,
    actual_material_cost:   null,
    labor_cost_variance:    null,
    material_cost_variance: null,
    notes:                  ''
  };
}
