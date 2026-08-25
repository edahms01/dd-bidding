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

  const walls = [];
  document.querySelectorAll('#wall-body tr').forEach(tr => {
    const inp = tr.querySelectorAll('input');
    if (!inp[0]) return;
    const gross = parseFloat(inp[4]?.value) || 0;
    const ded   = parseFloat(inp[5]?.value) || 0;
    walls.push({
      location: inp[0].value,
      typeId:   inp[1].value.trim(),
      height:   parseFloat(inp[2]?.value) || 0,
      lf:       parseFloat(inp[3]?.value) || 0,
      grossSF:  gross,
      openings: ded,
      netSF:    Math.max(0, gross - ded)
    });
  });

  const ceilings = [];
  document.querySelectorAll('#ceil-body tr').forEach(tr => {
    const inp = tr.querySelectorAll('input');
    if (!inp[0]) return;
    const gross = parseFloat(inp[3]?.value) || 0;
    const ded   = parseFloat(inp[5]?.value) || 0;
    ceilings.push({
      location: inp[0].value,
      typeId:   inp[1].value.trim(),
      height:   parseFloat(inp[2]?.value) || 0,
      grossSF:  gross,
      soffitLF: parseFloat(inp[4]?.value) || 0,
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
    confidence:       STATE.conf,
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

  // Escalation: zero if start date is within 60 days of bid date
  const bidDateStr   = document.getElementById('proj-bid')?.value   || '';
  const startDateStr = document.getElementById('proj-start')?.value || '';
  let escalationPct  = num('markup-escalation');
  if (bidDateStr && startDateStr) {
    const days = (new Date(startDateStr) - new Date(bidDateStr)) / 86400000;
    if (days < 60) escalationPct = 0;
  }
  const markupInputs = {
    overheadPct:    num('markup-overhead'),
    contingencyPct: num('markup-contingency'),
    profitPct:      num('markup-profit'),
    escalationPct
  };

  const intelligence = {
    crewAvailability:   sel('intel-crew'),
    pipelinePressure:   sel('intel-pipeline'),
    materialTrend:      sel('intel-material-trend'),
    gcRelationship:     sel('intel-gc-rel'),
    gcPriceSensitivity: sel('intel-gc-price'),
    competitionLevel:   sel('intel-competition'),
    knownCompetitors:   document.getElementById('intel-competitors')?.value.trim() || '',
    dirigoEdge:         sel('intel-edge'),
    // Computed count of *other* open drafts, alongside (not replacing) the
    // subjective pipelinePressure dropdown above — the UI shows this as a
    // hint next to the dropdown so the estimator sees it while still making
    // their own call. getAllDrafts()/activeDraftId are js/forms.js globals.
    openDraftCount:     getOpenDraftCount(getAllDrafts(), activeDraftId)
  };

  return { assemblies, walls, ceilings, conditions, rates, markupInputs, intelligence, project };
}

// Assembles a bid record ready for saveBid(). bid_id and date_submitted are
// assigned server-side (netlify/functions/bids-core.js's stampNewBid(),
// Phase 3) — not present on the object this function returns.
function buildBidRecord(state, summary, markupResult) {
  const markupPct = summary.directCostTotal > 0
    ? Math.round((markupResult.totalMarkup / summary.directCostTotal) * 1000) / 10
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
    final_bid:              Math.round(markupResult.finalBidPrice),
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
