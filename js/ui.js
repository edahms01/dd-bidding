// ─────────────────────────────────────────────────────────────────────
// ui.js — Display and render layer
// Reads computed results and writes to the DOM. Zero calculation logic.
//
// Future: becomes React components consuming an API response.
//         renderOutput() → a component tree fed by a useMemo selector.
//         calc() → derived state via a store selector.
// ─────────────────────────────────────────────────────────────────────

// ── AGENT STATE ───────────────────────────────────────────────────────

let _agentResult       = null;
let _agentLoading      = false;
let _lastCalcState     = null;
let _lastCalcSum       = null;
let _lastCalcMarkup    = null;
// Phase E, Step 2 — the calc fingerprint the agent last ran against:
// { bidPrice, directCost } from the summary/markupResult that triggered
// the run. Carried into state.ui.agent.generatedAt via
// window.__renderAgentTab so src/state/agentStaleness.js can compare it
// against the live reactive calculation. Reset with the rest of the
// agent cache on every draft switch (_resetAgentCache()).
let _agentCalcFingerprint = null;
let _selectedBidOption = 'recommended';
let _lastAgentResult   = null;
// A2 cleanup pass: window.__getLastAgentResult (the accessor
// OutputPage.jsx's/AgentPage.jsx's "Try again"/"Finalize bid" buttons
// used to call, for the same reason js/forms.js's
// window.__getHasUnsavedChanges exists — a top-level `let` isn't a
// `window` property, and a React onClick can't see it via bare
// identifier lookup the way the original inline onclick="..." could)
// is gone now. Once both buttons live in React, the value they needed
// (this variable, mirrored into the reducer every time renderAgentTab()
// /_renderAgentResult() dispatch — see window.__renderAgentTab,
// bridges.js) is already sitting in state.ui.agent.cachedResult, read
// directly there instead. Unlike window.__getHasUnsavedChanges (still
// needed — hasUnsavedChanges has no reducer-state twin), this one had
// become a redundant second way to read a value React already had.

// Phase 3: set only when getHistorySummary() (a network call now) rejects
// during an agent run — distinct from the pre-existing, legitimate case
// where it resolves successfully but a GC/building type just has zero
// prior bids (getHistorySummary()'s own documented `empty` shape). Never
// set on that success path — _renderAgentResult() must not conflate "the
// request failed" with "this GC is new" into the same visible notice.
let _agentHistoryUnavailable = false;

// renderAgentTab()/runAgentIfNeeded() short-circuit on _lastAgentResult
// before ever checking which draft is active — reasonable when there was
// only ever one bid, a real cross-draft leak once there are several (see
// Phase 2 handover brief). Called from js/forms.js wherever the active
// draft changes out from under Tab 8's cache. Idempotent — safe to call
// redundantly (e.g. a fresh page load with nothing cached yet).
function _resetAgentCache() {
  _agentResult             = null;
  _lastAgentResult         = null;
  _agentLoading            = false;
  _agentHistoryUnavailable = false;
  _agentCalcFingerprint    = null;
  // A2: AgentPage is now React-owned — its own cache (state.ui.agent)
  // needs the same reset, or Tab 8 would keep showing the previous
  // draft's cached result even after these classic-script globals were
  // correctly cleared (see draft-switch-no-contamination.spec.js).
  window.__resetAgentCache?.();
  // 3.5: reuses this exact same choke point (both draft-switch call
  // sites below already call this function) rather than touching a
  // second call site directly. Unlike submitResult's deliberately-left
  // wrong-tab quirk, a pending row-undo surviving a draft switch is
  // actively data-corrupting, not cosmetic — it could resurrect a row
  // from a completely different draft into whatever's now active.
  window.__resetRowUndo?.();
}

// ── PIPELINE COUNT HINT ─────────────────────────────────────────────────
// Shows the computed "other open drafts" count next to the subjective
// Pipeline pressure dropdown (Conditions tab) — informs the estimator's
// own call, doesn't replace it. Recomputed on every visit to the tab
// (goto('conditions'), js/tabs.js), same pattern as runCalculation()/
// renderAgentTab() self-refreshing on their own tab visits.
function _renderPipelineHint() {
  const el = document.getElementById('pipeline-count-hint');
  if (!el) return;
  const count = getOpenDraftCount(getAllDrafts(), activeDraftId);
  el.textContent = count > 0
    ? count + (count === 1 ? ' other bid' : ' other bids') + ' currently open'
    : 'No other bids currently open';
}

// ── RATES RUNNING TOTAL ───────────────────────────────────────────────

function fmt(n) { return n > 0 ? '$' + Math.round(n).toLocaleString() : '—'; }

function sumCls(c) {
  let t = 0;
  document.querySelectorAll('.' + c).forEach(el => {
    const v = parseFloat(el.value);
    if (!isNaN(v)) t += v;
  });
  return t;
}

function calc() {
  const l = sumCls('L'), m = sumCls('M'), x = sumCls('X');
  document.getElementById('t-l').textContent   = fmt(l);
  document.getElementById('t-m').textContent   = fmt(m);
  document.getElementById('t-x').textContent   = fmt(x);
  document.getElementById('t-tot').textContent = fmt(l + m + x);
}

// ── FORMATTING HELPERS ────────────────────────────────────────────────

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n)  { return (+n).toFixed(1) + '%'; }

// Escapes the 5 characters that matter for safe interpolation into
// innerHTML (as text content or as a quoted attribute value) — used at
// every spot in this file that writes a dynamic string into markup.
// Not a fix for the separate inline-onclick JS-string-context case (see
// _renderAgentResult()'s optCards) — HTML-entity decoding happens before
// the browser evaluates an inline event handler's JS source, so escaping
// quotes here doesn't close that path the way it does for text content
// or a plain attribute value.
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── BID OUTPUT RENDER ─────────────────────────────────────────────────
// renderOutput(state, wallCosts, ceilCosts, summary, markupResult)
//   state        — full form snapshot from collectFormData()
//   wallCosts    — array from calculateWallCosts()
//   ceilCosts    — array from calculateCeilingCosts()
//   summary      — { laborTotal, materialTotal, logisticsTotal, directCostTotal }
//   markupResult — { directCostTotal, overhead, contingency, profit,
//                    totalMarkup, finalBidPrice, effectiveMargin }

// A2: OutputPage is now React-owned. window.__renderOutput (src/state/
// bridges.js) dispatches the computed values into the reducer instead
// of this function's old direct #output-phase3/#output-bid.innerHTML
// writes — those elements are React-rendered now, and a direct write
// would be silently overwritten (or fought) on the next unrelated
// re-render, same reasoning as every other converted page. Falls back
// to _renderOutputLegacy() (the exact original body, unmodified) only
// when the bridge isn't registered (Vitest/non-browser contexts, or
// before AppShell has mounted).
function renderOutput(state, wallCosts, ceilCosts, summary, markupResult) {
  if (window.__renderOutput) {
    window.__renderOutput({ state, wallCosts, ceilCosts, summary, markupResult });
    return;
  }
  _renderOutputLegacy(state, wallCosts, ceilCosts, summary, markupResult);
}

function _renderOutputLegacy(state, wallCosts, ceilCosts, summary, markupResult) {
  const phase3El = document.getElementById('output-phase3');
  const bidEl    = document.getElementById('output-bid');

  // ── per-area table helpers ──

  function areaRow(r, qty) {
    if (r.error) {
      return `<tr>
        <td colspan="6" style="padding:8px;color:#e85c4a;font-style:italic">
          ${escapeHtml(r.location) || '(unnamed)'} — ${escapeHtml(r.error)}
        </td>
      </tr>`;
    }
    return `<tr>
      <td>${escapeHtml(r.location) || '—'}</td>
      <td style="color:var(--text2)">${escapeHtml(r.typeId)}${r.layers > 1 ? ' ×' + r.layers : ''}</td>
      <td style="font-variant-numeric:tabular-nums;color:var(--text2)">${qty}</td>
      <td style="font-variant-numeric:tabular-nums">${fmtCost(r.laborTotal)}</td>
      <td style="font-variant-numeric:tabular-nums">${fmtCost(r.materialTotal)}</td>
      <td style="font-variant-numeric:tabular-nums;font-weight:600">${fmtCost(r.total)}</td>
    </tr>`;
  }

  function groupHead(label) {
    return `<tr>
      <td colspan="6" style="padding:10px 8px 3px;font-size:10px;font-weight:600;
          color:var(--text3);text-transform:uppercase;letter-spacing:.07em">
        ${label}
      </td>
    </tr>`;
  }

  const hasWalls    = wallCosts.length > 0;
  const hasCeilings = ceilCosts.length > 0;
  const hasAreas    = hasWalls || hasCeilings;

  const wallRows = wallCosts.map(r =>
    areaRow(r, r.lf ? r.lf.toLocaleString() + ' LF' : '— LF')
  ).join('');
  const ceilRows = ceilCosts.map(r =>
    areaRow(r, r.netSF.toLocaleString() + ' SF')
  ).join('');

  // ── subtotal row helper — used in both phase3 and bid sections ──

  function subtotalRow(label, value, accent) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text2)">${label}</span>
      <span style="font-variant-numeric:tabular-nums;font-size:13px;color:${accent || 'var(--text)'}">
        ${value}
      </span>
    </div>`;
  }

  // ── Phase 3: direct cost output ──

  phase3El.innerHTML = `
    <div class="totals-bar" style="margin-bottom:28px">
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.laborTotal)}</div>
        <div class="total-lbl">Labor</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.materialTotal)}</div>
        <div class="total-lbl">Materials</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.logisticsTotal)}</div>
        <div class="total-lbl">Logistics</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val green">${fmtCost(summary.directCostTotal)}</div>
        <div class="total-lbl">Direct cost total</div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Per-area breakdown</div>
      ${hasAreas
        ? `<div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Assembly</th>
                  <th>Quantity</th>
                  <th>Labor</th>
                  <th>Materials</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${hasWalls    ? groupHead('Walls')    + wallRows : ''}
                ${hasCeilings ? groupHead('Ceilings') + ceilRows : ''}
              </tbody>
            </table>
          </div>`
        : `<div class="empty-state" style="padding:24px">
            No wall or ceiling rows with data.
          </div>`
      }
    </div>

    <div class="section-block">
      <div class="section-label">Category subtotals</div>
      <div style="background:var(--surface);border:1px solid var(--border);
          border-radius:var(--rl);padding:4px 20px 12px">
        ${subtotalRow('Labor (raw)', fmtCost(summary.laborTotal), 'var(--teal)')}
        ${subtotalRow(
            'Materials (incl. ' + fmtPct(summary.weightedWastePct) + ' waste)',
            fmtCost(summary.materialTotal)
          )}
        ${subtotalRow(
            'Logistics (' + state.conditions.trips + ' trips' +
              (summary.logisticsTotal > 0 ? ', lift ' + fmtCost(state.rates.lift) + '/wk' : '') + ')',
            fmtCost(summary.logisticsTotal)
          )}
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:14px 0 6px;margin-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--text)">Direct cost total</span>
          <span style="font-variant-numeric:tabular-nums;font-size:22px;font-weight:700;
              color:var(--green)">${fmtCost(summary.directCostTotal)}</span>
        </div>
      </div>
    </div>
  `;

  // ── Phase 4: pricing breakdown + final bid ──

  const mu = state.markupInputs;

  bidEl.innerHTML = `
    <div class="section-block">
      <div class="section-label">Pricing breakdown</div>
      <div style="background:var(--surface);border:1px solid var(--border);
          border-radius:var(--rl);padding:4px 20px 12px">
        ${subtotalRow('Direct cost total', fmtCost(markupResult.directCostTotal), 'var(--teal)')}
        ${subtotalRow('Company overhead (' + fmtPct(mu.overheadPct) + ')', fmtCost(markupResult.overhead))}
        ${subtotalRow('Risk / contingency (' + fmtPct(mu.contingencyPct) + ')', fmtCost(markupResult.contingency))}
        ${subtotalRow('Profit margin (' + fmtPct(mu.profitPct) + ')', fmtCost(markupResult.profit))}
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:14px 0 6px;margin-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--text)">Total markup</span>
          <span style="font-variant-numeric:tabular-nums;font-size:16px;font-weight:600;
              color:var(--text2)">${fmtCost(markupResult.totalMarkup)}</span>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div style="background:var(--surface);border:2px solid var(--green);
          border-radius:var(--rl);padding:24px 28px;
          display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;color:var(--text3);text-transform:uppercase;
              letter-spacing:.08em;font-weight:600;margin-bottom:6px">Final bid price</div>
          <div style="font-size:12px;color:var(--text3)">
            Effective margin: ${fmtPct(markupResult.effectiveMargin)}
          </div>
        </div>
        <div style="font-variant-numeric:tabular-nums;font-size:38px;font-weight:700;color:var(--green)">
          ${fmtCost(markupResult.finalBidPrice)}
        </div>
      </div>
    </div>

  `;
}

// ── ORCHESTRATION ─────────────────────────────────────────────────────

// A2: Conditions converted to React — STATE.conf alone is stale the
// instant a user picks a confidence level in the browser, since
// ConditionsPage.jsx's buttons dispatch straight into the reducer and
// never call setConf() (see js/forms.js and CLAUDE.md). Same accessor
// js/state.js's collectFormData() reads confidence through, not
// reimplemented per call site — both call sites below used to read
// STATE.conf directly and silently pre-filled contingency to 0
// regardless of the confidence actually selected; found by reproducing
// it directly (select High confidence, run a calculation, contingency
// pre-filled to 0 instead of 4), not assumed.
function _currentConfidence() {
  return (typeof window !== 'undefined' && window.__getConfidence) ? window.__getConfidence() : STATE.conf;
}

// 4.2: split out of what used to be the single runCalculation() function.
// calculateOnly() is the numbers-only half — everything through
// renderOutput()/_lastCalc* stashing, no agent launch. runCalculation()
// (below) is calculateOnly() plus the agent launch, unchanged externally
// — every existing call site (window.goto('output'), the post-finalize
// "Back to output" button) keeps calling runCalculation() and keeps
// getting the agent relaunch it always did. The new reactive-calculation
// trigger (window.scheduleRecalc, below) calls calculateOnly() instead,
// specifically so a debounced edit anywhere in the workflow never
// relaunches the bid agent (a real API call) as a side effect — decided
// explicitly with Eric rather than assumed, since "numbers update live"
// doesn't imply "relaunch an AI call on every keystroke."
function calculateOnly() {
  // Pre-fill contingency from confidence if field is empty (only fires on first calculate)
  // A2: markup-contingency is a React-controlled input now (OutputPage.jsx)
  // — the direct .value write below is still required (collectFormData(),
  // called synchronously right after this, reads live DOM), but on its
  // own it would be silently reverted the next time anything re-renders
  // OutputPage (React re-asserts whatever state.bid.markupInputs.
  // contingencyPct still holds — '', since this write never told the
  // reducer). window.__hydrateMarkup's merge semantics (LOAD_SECTION,
  // store.jsx) update just this one field without touching overheadPct/
  // profitPct. Same dual-write shape as every other scalar hydration —
  // checklist item 4.
  const contingencyEl = document.getElementById('markup-contingency');
  if (contingencyEl && !contingencyEl.value) {
    const conf = _currentConfidence();
    const prefill = conf === 'hi' ? 4 : conf === 'md' ? 8 : conf === 'lo' ? 15 : 0;
    contingencyEl.value = prefill;
    window.__hydrateMarkup?.({ contingencyPct: prefill });
  }

  const state        = collectFormData();
  // Resolved once, before any row-level calculation — see js/calculator.js's
  // applyRateEscalation() doc comment. Only the wall/ceiling calls receive
  // the escalated rates; calculateLogistics() below keeps state.rates
  // unescalated (delivery/disposal/lift aren't material-price-risk lines).
  const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, escalatedRates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct);
  const markupResult = applyMarkup(summary, state.markupInputs);
  renderOutput(state, wallCosts, ceilCosts, summary, markupResult);

  _lastCalcState  = state;
  _lastCalcSum    = summary;
  _lastCalcMarkup = markupResult;

  return { state, summary, markupResult };
}

function runCalculation() {
  const { state, summary, markupResult } = calculateOnly();
  _agentResult  = null;
  _agentLoading = true;
  _launchBidAgent(state, summary, markupResult);
}

// 4.2: the one new reactive-calculation trigger. Debounced independently
// of autosave's own 700ms debounce (js/autosave.js) — both reset off the
// same events but fire on separate timers, so there's no shared-timer
// race, just two independent schedules. Wired from js/forms.js's
// existing _handleFormChange() (uncontrolled-input keystrokes) and from
// src/AppShell.jsx's state.bid watcher (React-dispatched row add/
// delete/hydration/controlled-field changes) — see CLAUDE.md's Phase B
// section. Guarded per checklist item 9 (CLAUDE.md): tests/unit/
// ui.test.js imports this file under Vitest's node environment, no
// window at all.
const RECALC_DEBOUNCE_MS = 500; // shorter than autosave's 700ms — numbers should feel live
if (typeof window !== 'undefined') {
  window.scheduleRecalc = debounce(calculateOnly, RECALC_DEBOUNCE_MS);
}

// ── AGENT LAUNCH ──────────────────────────────────────────────────────

async function _launchBidAgent(state, summary, markupResult) {
  // Phase E, Step 2 — fingerprint the calc state that triggered this run,
  // so agentStaleness.js can later tell whether the live numbers have
  // drifted from what produced the option cards.
  _agentCalcFingerprint = {
    bidPrice:   markupResult && typeof markupResult.finalBidPrice === 'number' ? markupResult.finalBidPrice : null,
    directCost: summary && typeof summary.directCostTotal === 'number' ? summary.directCostTotal : null
  };
  let bidHistory;
  try {
    bidHistory = await getHistorySummary(state.project.gc, state.project.buildingType);
    _agentHistoryUnavailable = false;
  } catch (e) {
    // Bid-storage fetch failed — don't take down the whole agent flow
    // over a storage hiccup. Fall back to the same zeroed shape
    // getHistorySummary() itself returns for "no bids yet" and let the
    // agent run without historical context; _renderAgentResult() shows a
    // visible notice for this case, driven only by this flag (never by
    // the legitimate "GC has zero prior bids" success path — see the
    // comment on _agentHistoryUnavailable's declaration above).
    bidHistory = {
      totalBids: 0, winRate: 0, winsWithThisGC: 0, lossesWithThisGC: 0, winRateByBuildingType: 0, avgCostVariance: null,
      // Same shape computeMarginOutcomeCurve([])/computeSeasonality([])/
      // computeCompetitorPatterns([]) return for zero bids — a storage
      // failure looks exactly like "no data yet" to the agent, not a
      // third, distinct shape (js/history-analytics.js).
      marginOutcomeCurve: { available: false, count: 0, minRequired: MIN_BIDS_FOR_MARGIN_CURVE }, seasonality: [],
      competitorPatterns: []
    };
    _agentHistoryUnavailable = true;
  }
  if (document.getElementById('page-agent')?.classList.contains('active')) {
    renderAgentTab();
  }
  _agentResult  = await runBidAgent(state, summary, markupResult, bidHistory);
  _agentLoading = false;
  if (document.getElementById('page-agent')?.classList.contains('active')) {
    renderAgentTab();
  }
}

// ── SUBMIT BID ────────────────────────────────────────────────────────

// A2.5: finalizeSelection ({ amount, selectedOption }) is the modal's
// resolved choice (FinalizeModal.jsx's handleConfirm(), or the dead
// classic-script _finalizeBid() below — not currently reachable) —
// threaded straight through to buildBidRecord() (js/state.js), which is
// where it actually replaces the plain-calculator amount. Everything
// below still computes state/summary/markupResult exactly as before:
// they're still the source for direct_cost/estimated_labor_cost/
// estimated_material_cost, which are legitimately plain-calculator-
// derived and out of scope for this fix.
async function submitBid(finalizeSelection) {
  // Same pre-fill logic as runCalculation — ensure contingency is set before
  // reading. Same dual-write reasoning too (see runCalculation()'s comment) —
  // the direct .value write alone would be silently reverted next time
  // anything re-renders OutputPage's now-controlled markup-contingency input.
  const contingencyEl = document.getElementById('markup-contingency');
  if (contingencyEl && !contingencyEl.value) {
    const conf = _currentConfidence();
    const prefill = conf === 'hi' ? 4 : conf === 'md' ? 8 : conf === 'lo' ? 15 : 0;
    contingencyEl.value = prefill;
    window.__hydrateMarkup?.({ contingencyPct: prefill });
  }

  const state        = collectFormData();
  const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, escalatedRates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct);
  const markupResult = applyMarkup(summary, state.markupInputs);

  let saved;
  try {
    saved = await saveBid(buildBidRecord(state, summary, markupResult, finalizeSelection));
  } catch (e) {
    // A failed save must never show "Bid submitted ✓" — the draft stays
    // in dirigo_drafts untouched (clearFinalizedDraft() below only runs
    // on success), so nothing is lost and the user can retry Finalize.
    //
    // A2: OutputPage is now React-owned — window.__setSubmitResult
    // dispatches into the reducer instead of this old direct
    // #output-bid.innerHTML write. Deliberately preserves the wrong-tab
    // bug exactly: this still targets the same conceptual "#output-bid
    // content" regardless of which tab is actually active when
    // submitBid() runs (Tab 8, via the finalize modal, in the case this
    // bug is about) — not fixed here, see CLAUDE.md/the A2 plan. Falls
    // back to the old direct write only when the bridge isn't
    // registered (Vitest/non-browser contexts).
    if (window.__setSubmitResult) {
      window.__setSubmitResult({ status: 'error' });
    } else {
      const bidEl = document.getElementById('output-bid');
      if (bidEl) {
        bidEl.innerHTML = `
          <div class="section-block">
            <div style="background:var(--surface);border:2px solid #e85c4a;
                border-radius:var(--rl);padding:28px;text-align:center">
              <div style="font-size:24px;color:#e85c4a;margin-bottom:10px">✕</div>
              <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">Bid submission failed</div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:20px">
                Nothing was saved — your draft is unchanged. Check your connection and try again.
              </div>
              <button class="btn btn-primary" onclick="_showFinalizeModal(_lastAgentResult?.options||[])">Try again</button>
            </div>
          </div>
        `;
      }
    }
    throw e; // let _finalizeBid()'s catch re-enable the confirm button
  }

  // The finalized draft now lives permanently in dirigo_bids — clear it out
  // of dirigo_drafts so "New Bid" never shows stale, already-submitted data.
  clearFinalizedDraft();

  if (window.__setSubmitResult) {
    window.__setSubmitResult({ status: 'success', saved });
  } else {
    const bidEl = document.getElementById('output-bid');
    if (bidEl) {
      bidEl.innerHTML = `
        <div class="section-block">
          <div style="background:var(--surface);border:2px solid var(--green);
              border-radius:var(--rl);padding:28px;text-align:center">
            <div style="font-size:24px;color:var(--green);margin-bottom:10px">✓</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">Bid submitted</div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:20px">
              ${escapeHtml(saved.project_name) || '(unnamed project)'} &mdash; ${fmtCost(saved.final_bid)}
            </div>
            <button class="btn btn-primary" onclick="goto('history')">View bid history →</button>
            <button class="btn btn-ghost" onclick="runCalculation()" style="margin-left:8px">Back to output</button>
          </div>
        </div>
      `;
    }
  }
}

// ── BID HISTORY RENDER ────────────────────────────────────────────────

async function renderHistory() {
  const page = document.getElementById('page-history');
  if (!page) return;

  // page-history's static "Loading bid history…" placeholder markup
  // (index.html) stays on screen for the duration of this fetch — it's
  // a genuinely meaningful loading state now, not an instant flash.
  let bids;
  try {
    bids = await getAllBids();
  } catch (e) {
    page.innerHTML = `
      <div class="page-hdr">
        <div>
          <div class="page-title">Bid history</div>
          <div class="page-sub">Track submitted bids and log outcomes for competitive analysis</div>
        </div>
      </div>
      <div class="empty-state" style="color:#e85c4a">
        Couldn't load bid history — check your connection and try again.
      </div>`;
    return;
  }

  const total    = bids.length;
  const won      = bids.filter(b => b.outcome === 'won').length;
  const winRate  = total > 0 ? Math.round((won / total) * 100) : 0;
  const wonBids  = bids.filter(b => b.outcome === 'won' && b.final_bid > 0 && b.direct_cost > 0);
  const avgMargin = wonBids.length > 0
    ? wonBids.reduce((s, b) => s + ((b.final_bid - b.direct_cost) / b.final_bid * 100), 0) / wonBids.length
    : null;

  function outcomePill(outcome) {
    if (outcome === 'won')
      return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(58,191,122,.1);border:1px solid rgba(58,191,122,.25);color:var(--green)">Won</span>`;
    if (outcome === 'lost')
      return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(232,92,74,.1);border:1px solid rgba(232,92,74,.25);color:#e85c4a">Lost</span>`;
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text3)">Pending</span>`;
  }

  function confLabel(conf) {
    if (conf === 'hi') return `<span style="color:var(--green)">High</span>`;
    if (conf === 'md') return `<span style="color:var(--accent)">Medium</span>`;
    if (conf === 'lo') return `<span style="color:#e85c4a">Low</span>`;
    return '<span style="color:var(--text3)">—</span>';
  }

  const rows = !bids.length
    ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No bids submitted yet — finalize a bid from the Bid Strategy step to see it here.</td></tr>`
    : bids.map(b => {
        const id = b.bid_id;
        return `
        <tr>
          <td style="white-space:nowrap;color:var(--text2)">${b.date_submitted || '—'}</td>
          <td style="font-weight:500">${escapeHtml(b.project_name) || '—'}</td>
          <td style="color:var(--text2)">${escapeHtml(b.gc) || '—'}</td>
          <td style="color:var(--text2)">${escapeHtml(b.building_type) || '—'}</td>
          <td style="font-variant-numeric:tabular-nums;font-weight:600;color:var(--green)">${b.final_bid ? fmtCost(b.final_bid) : '—'}</td>
          <td>${confLabel(b.confidence)}</td>
          <td>${outcomePill(b.outcome)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="toggleUpdate('${id}')">Update</button>
            <button class="btn btn-ghost btn-sm" style="color:#e85c4a;margin-left:4px" onclick="deleteBidRecord('${id}')">×</button>
          </td>
        </tr>
        <tr id="uprow-${id}" style="display:none;background:var(--surface2)">
          <td colspan="8" style="padding:14px 12px">
            <div class="grid g6" style="margin-bottom:12px">
              <div class="field">
                <span class="lbl">Outcome</span>
                <select id="uf-outcome-${id}">
                  <option value="pending"${b.outcome==='pending'?' selected':''}>Pending</option>
                  <option value="won"${b.outcome==='won'?' selected':''}>Won</option>
                  <option value="lost"${b.outcome==='lost'?' selected':''}>Lost</option>
                </select>
              </div>
              <div class="field">
                <span class="lbl">Competitor who won</span>
                <input type="text" id="uf-winner-${id}" value="${escapeHtml(b.competitor_who_won)}" placeholder="Company name">
              </div>
              <div class="field">
                <span class="lbl">Winning bid ($)</span>
                <input type="number" id="uf-winbid-${id}" value="${b.winning_bid||''}" placeholder="0">
              </div>
              <div class="field">
                <span class="lbl">Actual labor cost ($)</span>
                <input type="number" id="uf-actuallabor-${id}" value="${b.actual_labor_cost||''}" placeholder="0">
              </div>
              <div class="field">
                <span class="lbl">Actual material cost ($)</span>
                <input type="number" id="uf-actualmaterial-${id}" value="${b.actual_material_cost||''}" placeholder="0">
              </div>
              <div class="field">
                <span class="lbl">Notes</span>
                <input type="text" id="uf-notes-${id}" value="${escapeHtml(b.notes)}" placeholder="Post-bid notes">
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="saveUpdate('${id}')">Save</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="toggleUpdate('${id}')">Cancel</button>
          </td>
        </tr>`;
      }).join('');

  page.innerHTML = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Bid history</div>
        <div class="page-sub">Track submitted bids and log outcomes for competitive analysis</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Bid output</button>
      </div>
    </div>

    <div class="totals-bar" style="margin-bottom:28px">
      <div class="total-item">
        <div class="total-val">${total}</div>
        <div class="total-lbl">Total bids</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${total > 0 ? winRate + '%' : '—'}</div>
        <div class="total-lbl">Win rate</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${won}</div>
        <div class="total-lbl">Won</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val ${avgMargin !== null ? 'green' : ''}">${avgMargin !== null ? fmtPct(avgMargin) : '—'}</div>
        <div class="total-lbl">Avg margin (wins)</div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Submitted bids</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>GC</th><th>Building type</th>
              <th>Final bid</th><th>Confidence</th><th>Outcome</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function toggleUpdate(bid_id) {
  const row = document.getElementById('uprow-' + bid_id);
  if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

async function saveUpdate(bid_id) {
  const outcome        = document.getElementById('uf-outcome-'        + bid_id)?.value || 'pending';
  const winner         = document.getElementById('uf-winner-'         + bid_id)?.value.trim() || null;
  const winBid         = parseFloat(document.getElementById('uf-winbid-'         + bid_id)?.value) || null;
  const actualLabor    = parseFloat(document.getElementById('uf-actuallabor-'    + bid_id)?.value);
  const actualMaterial = parseFloat(document.getElementById('uf-actualmaterial-' + bid_id)?.value);
  const notes          = document.getElementById('uf-notes-'          + bid_id)?.value.trim() || '';

  try {
    const bids = await getAllBids();
    const rec  = bids.find(b => b.bid_id === bid_id);

    // computeCostVariances() (js/history-analytics.js) owns the
    // baseline-vs-legacy branching and the "both actuals required before
    // computing anything in the legacy path" rule — kept out of this
    // function so that null-handling is directly unit-testable.
    const variances = computeCostVariances({
      record:        rec,
      actualLabor:    isNaN(actualLabor)    ? null : actualLabor,
      actualMaterial: isNaN(actualMaterial) ? null : actualMaterial
    });

    await updateBid(bid_id, {
      outcome,
      competitor_who_won: winner || null,
      winning_bid:        winBid ? Math.round(winBid) : null,
      actual_labor_cost:    isNaN(actualLabor)    ? null : Math.round(actualLabor),
      actual_material_cost: isNaN(actualMaterial) ? null : Math.round(actualMaterial),
      ...variances,
      notes
    });
    renderHistory();
  } catch (e) {
    alert('Failed to save update — check your connection and try again.');
  }
}

async function deleteBidRecord(bid_id) {
  if (!confirm('Delete this bid record? This cannot be undone.')) return;
  try {
    await deleteBid(bid_id);
    renderHistory();
  } catch (e) {
    alert('Failed to delete bid — check your connection and try again.');
  }
}

// ── RATE TEMPLATES (Tier 5, Part 1) ─────────────────────────────────
// Save/Load controls on the Rates tab header. renderRateTemplateSelect()
// lives here rather than js/forms.js — this file owns page-level render-
// from-server-data orchestration (renderHistory(), renderDashboard()
// below), while forms.js owns form field population/collection/autosave.
// applyRateTemplate() itself (pure field hydration) stays in forms.js,
// alongside populateForm()'s own rates-hydration logic.

let _rateTemplatesCache = [];

async function renderRateTemplateSelect() {
  const sel = document.getElementById('rate-template-select');
  if (!sel) return;

  try {
    _rateTemplatesCache = await getAllRateTemplates();
  } catch (e) {
    _rateTemplatesCache = [];
  }

  if (!_rateTemplatesCache.length) {
    sel.innerHTML = '<option value="">No templates saved</option>';
    sel.disabled  = true;
    return;
  }

  sel.disabled  = false;
  sel.innerHTML = _rateTemplatesCache.map(t =>
    `<option value="${t.id}">${escapeHtml(t.name)}</option>`
  ).join('');
}

async function saveRateTemplateFromForm() {
  const name = prompt('Name this rate template:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();

  // No update/rename path exists — POST always creates a new record, so
  // saving under a name that already exists would silently produce two
  // identically-named entries, distinguishable only by list position.
  // Warn rather than block (blocking would need a rename path this phase
  // deliberately excludes) or silently allow.
  const isDuplicate = _rateTemplatesCache.some(t => t.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (isDuplicate && !confirm(`A template named "${trimmed}" already exists. Save another one with this name?`)) {
    return;
  }

  try {
    const data = collectFormData();
    await saveRateTemplate(trimmed, data.rates, data.rateEscalation);
    await renderRateTemplateSelect();
    _showFormToast('Template saved ✓', 'success');
  } catch (e) {
    alert('Failed to save template — check your connection and try again.');
  }
}

function loadSelectedRateTemplate() {
  const sel = document.getElementById('rate-template-select');
  const id  = sel && sel.value;
  if (!id) return;

  if (hasUnsavedChanges && !confirm('Loading a template will overwrite your current unsaved changes. Continue?')) {
    return;
  }

  const tmpl = _rateTemplatesCache.find(t => t.id === id);
  if (!tmpl) return;

  applyRateTemplate(tmpl.rates, tmpl.rateEscalation);
  _showFormToast('Template loaded ✓', 'success');
}

async function deleteSelectedRateTemplate() {
  const sel = document.getElementById('rate-template-select');
  const id  = sel && sel.value;
  if (!id) return;

  const tmpl = _rateTemplatesCache.find(t => t.id === id);
  if (!confirm(`Delete template "${tmpl ? tmpl.name : ''}"? This cannot be undone.`)) return;

  try {
    await deleteRateTemplate(id);
    await renderRateTemplateSelect();
    _showFormToast('Template deleted ✓', 'success');
  } catch (e) {
    alert('Failed to delete template — check your connection and try again.');
  }
}

// ── DASHBOARD RENDER ─────────────────────────────────────────────────
// Deliberately no computed cost shown — running the calculator against
// every draft just for a list preview would be scope creep; that's what
// Tab 7 is for. Draft CRUD itself (createDraft/switchToDraft/
// duplicateDraft/deleteDraft) lives in js/forms.js and stays DOM/dialog
// -free, same split as history.js vs. this file's renderHistory().

function renderDashboard() {
  const page   = document.getElementById('page-dashboard');
  if (!page) return;

  const drafts = Object.values(getAllDrafts())
    .sort((a, b) => new Date(b.lastModifiedAt) - new Date(a.lastModifiedAt));

  const rows = !drafts.length
    ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">No drafts yet — click "New Bid" to start one.</td></tr>`
    : drafts.map(d => {
        const name     = (d.project && d.project.name) || 'Untitled bid';
        const type     = (d.project && d.project.buildingType) || '—';
        const modified = d.lastModifiedAt ? new Date(d.lastModifiedAt).toLocaleString() : '—';
        return `
        <tr>
          <td style="font-weight:500">${escapeHtml(name)}</td>
          <td style="color:var(--text2)">${escapeHtml(type)}</td>
          <td style="white-space:nowrap;color:var(--text2)">${modified}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-primary btn-sm" onclick="switchToDraft('${d.id}')">Open</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:4px" onclick="duplicateDraftAndRefresh('${d.id}')">Duplicate</button>
            <button class="btn btn-ghost btn-sm" style="color:#e85c4a;margin-left:4px" onclick="confirmDeleteDraft('${d.id}')">×</button>
          </td>
        </tr>`;
      }).join('');

  page.innerHTML = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Every bid currently in progress</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="createDraft()">+ New Bid</button>
      </div>
    </div>

    <div class="section-block">
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>Project</th><th>Building type</th><th>Last modified</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function duplicateDraftAndRefresh(id) {
  duplicateDraft(id);
  renderDashboard();
}

function confirmDeleteDraft(id) {
  if (!confirm('Delete this draft? This cannot be undone.')) return;
  deleteDraft(id);
  renderDashboard();
}

// ── BID AGENT RENDER ──────────────────────────────────────────────────

// A2: AgentPage is now React-owned. window.__renderAgentTab (src/state/
// bridges.js) dispatches the current snapshot into the reducer instead
// of this function's old four-way innerHTML branch — AgentPage.jsx
// replicates the exact same branch order and priority (a cached result
// wins even over a fresh load in flight — see store.jsx's
// RENDER_AGENT_TAB). The legacy body's fourth, easy-to-miss branch:
// when _lastAgentResult is empty and _agentLoading is false but
// _agentResult *is* available, it falls through to
// _renderAgentResult(page, _agentResult) — which both shows that result
// AND caches it as _lastAgentResult for next time. Found by reproducing
// two real test failures, not by re-reading carefully enough the first
// time: dispatching only _lastAgentResult (skipping this fallback)
// meant the very first render of a real result — right after the
// agent call resolves, before anything else has ever cached it — fell
// through to the empty state instead, in both
// agent-history-fallback.spec.js and draft-switch-no-contamination.
// spec.js. resultToShow below reconstructs the same fallback chain, and
// caches it into _lastAgentResult exactly when the legacy branch would
// have (via _renderAgentResult()'s own assignment). Falls back to
// _renderAgentTabLegacy() (the exact original body) only when the
// bridge isn't registered (Vitest/non-browser contexts, or before
// AppShell has mounted).
function renderAgentTab() {
  if (window.__renderAgentTab) {
    const resultToShow = _lastAgentResult || (!_agentLoading ? _agentResult : null);
    if (resultToShow) _lastAgentResult = resultToShow;
    window.__renderAgentTab({ cachedResult: resultToShow, loading: _agentLoading, historyUnavailable: _agentHistoryUnavailable, generatedAt: _agentCalcFingerprint });
    return;
  }
  _renderAgentTabLegacy();
}

function _renderAgentTabLegacy() {
  const page = document.getElementById('page-agent');
  if (!page) return;

  if (_lastAgentResult) {
    _renderAgentResult(page, _lastAgentResult);
    return;
  }

  const hdr = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Agent Recommendation</div>
        <div class="page-sub">Bid strategy analysis by Claude AI</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Back</button>
        <button id="agent-finalize-btn" class="btn btn-primary" onclick="_showFinalizeModal(_lastAgentResult?.options||[])">Finalize bid →</button>
      </div>
    </div>`;

  if (_agentLoading) {
    page.innerHTML = hdr + `
      <div style="text-align:center;padding:60px 24px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Agent is analyzing your bid…</div>
        <div style="font-size:11px;color:var(--text3)">This takes a few seconds.</div>
      </div>`;
    return;
  }

  if (!_agentResult) {
    page.innerHTML = hdr + `
      <div class="empty-state">
        Fill in your bid through the Cost Summary step to get a recommendation.
      </div>`;
    return;
  }

  _renderAgentResult(page, _agentResult);
}

function _renderAgentResult(page, r) {
  // Always do this, regardless of render path below — the legacy
  // fallback branch (only reachable pre-mount/under Vitest) still reads
  // this bare identifier for its own "Finalize bid →" button, so it has
  // to stay correct even though the live browser path no longer depends
  // on it as a rendering concern (AgentPage.jsx reads
  // state.ui.agent.cachedResult instead — see bridges.js).
  _lastAgentResult   = r;

  // A2: bridge to AgentPage.jsx — see renderAgentTab()'s comment above.
  // runAgentIfNeeded() calls this function directly (not through
  // renderAgentTab()), so it needs its own bridge check too.
  if (window.__renderAgentTab) {
    window.__renderAgentTab({ cachedResult: r, loading: false, historyUnavailable: _agentHistoryUnavailable, generatedAt: _agentCalcFingerprint });
    return;
  }

  _selectedBidOption = 'recommended';

  const OPT_COLORS = {
    competitive: { color: 'var(--blue)',   bg: 'rgba(74,143,232,.08)',  border: 'rgba(74,143,232,.25)' },
    recommended: { color: 'var(--green)',  bg: 'rgba(58,191,122,.08)',  border: 'rgba(58,191,122,.3)'  },
    ambitious:   { color: 'var(--accent)', bg: 'rgba(232,124,42,.06)',  border: 'rgba(232,124,42,.25)' }
  };

  function statusPill(status) {
    if (status === 'positive') return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(58,191,122,.1);border:1px solid rgba(58,191,122,.25);color:var(--green)">Positive</span>`;
    if (status === 'warning')  return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(232,124,42,.1);border:1px solid rgba(232,124,42,.3);color:var(--accent)">Warning</span>`;
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text3)">Neutral</span>`;
  }

  function flagDot(severity) {
    const col = severity === 'high' ? '#e85c4a' : severity === 'medium' ? 'var(--accent)' : 'var(--text3)';
    return `<span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;margin-top:5px;display:inline-block"></span>`;
  }

  function winLikelihoodPill(val) {
    const s = {
      'Very High':  'background:rgba(58,191,122,.15);border:1px solid rgba(58,191,122,.35);color:#3abf7a',
      'High':       'background:rgba(58,191,122,.10);border:1px solid rgba(58,191,122,.25);color:#3abf7a',
      'Medium':     'background:rgba(232,124,42,.12);border:1px solid rgba(232,124,42,.30);color:#e87c2a',
      'Low–Medium': 'background:rgba(232,92,74,.10);border:1px solid rgba(232,92,74,.25);color:#e85c4a',
      'Low':        'background:rgba(232,92,74,.15);border:1px solid rgba(232,92,74,.35);color:#e85c4a'
    }[val] || 'background:rgba(255,255,255,.04);border:1px solid var(--border2);color:var(--text3)';
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;${s}">${escapeHtml(val) || '—'}</span>`;
  }

  const hdr = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Agent Recommendation</div>
        <div class="page-sub">Bid strategy analysis by Claude AI</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Back</button>
        <button id="agent-finalize-btn" class="btn btn-primary" onclick="_showFinalizeModal(_lastAgentResult?.options||[])">Finalize bid →</button>
      </div>
    </div>`;

  const optCards = (r.options || []).map(opt => {
    const oc    = OPT_COLORS[opt.type] || { color: 'var(--text)', bg: 'var(--surface)', border: 'var(--border)' };
    const isRec = opt.type === 'recommended';
    const isSel = _selectedBidOption === opt.type;
    return `
      <div data-bid-opt="${escapeHtml(opt.type)}"
           data-default-border="${oc.border}"
           data-default-bg="${oc.bg}"
           onclick="_selectBidOption('${escapeHtml(opt.type)}')"
           style="flex:1;background:${isSel ? 'var(--accent-dim)' : oc.bg};
                  border:1px solid ${isSel ? 'var(--accent-border)' : oc.border};
                  border-radius:var(--rl);padding:18px 16px;cursor:pointer;position:relative;
                  transition:all .15s;">
        ${isRec ? `<span style="position:absolute;top:10px;right:10px;font-size:9px;font-weight:700;
            padding:2px 7px;border-radius:4px;background:rgba(58,191,122,.12);
            border:1px solid rgba(58,191,122,.3);color:var(--green);letter-spacing:.03em">Agent pick</span>` : ''}
        <div style="font-size:10px;font-weight:700;color:${oc.color};text-transform:uppercase;
            letter-spacing:.08em;margin-bottom:12px">${escapeHtml(opt.label)}</div>
        <div style="font-family:monospace;font-size:26px;font-weight:700;color:${oc.color};
            line-height:1;margin-bottom:3px">${fmtCost(opt.bidAmount)}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${opt.margin}% margin</div>
        <div>
          <div style="font-size:9px;font-weight:600;color:var(--text3);letter-spacing:.08em;margin-bottom:5px;text-transform:uppercase">WIN LIKELIHOOD</div>
          ${winLikelihoodPill(opt.winLikelihood)}
        </div>
        <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:12px">${escapeHtml(opt.rationale)}</div>
      </div>`;
  }).join('');

  const historyUnavailableNotice = _agentHistoryUnavailable ? `
    <div style="background:rgba(232,124,42,.08);border:1px solid rgba(232,124,42,.3);
        border-radius:var(--rl);padding:10px 16px;margin-bottom:20px;font-size:12px;color:var(--accent)">
      Historical bid data unavailable — recommendation based on this bid only.
    </div>` : '';

  page.innerHTML = hdr + historyUnavailableNotice + `
    <div class="section-block">
      <div class="section-label">Agent analysis</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);
          padding:16px 18px;font-size:14px;color:var(--text2);line-height:1.7">
        ${escapeHtml(r.reasoning) || 'No analysis provided.'}
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Bid options</div>
      <div style="display:flex;gap:12px;align-items:stretch">
        ${optCards}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:0 2px">
        <span style="font-size:11px;color:var(--text3)">← Higher win rate</span>
        <div style="flex:1;height:1px;background:var(--border);margin:0 16px"></div>
        <span style="font-size:11px;color:var(--text3)">Higher margin →</span>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Signal summary</div>
      ${r.signals && r.signals.length > 0 ? `
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Signal</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            ${r.signals.map(s => `<tr>
              <td style="font-weight:500">${escapeHtml(s.label)}</td>
              <td style="color:var(--text2)">${escapeHtml(s.value)}${s.note ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${escapeHtml(s.note)}</div>` : ''}</td>
              <td>${statusPill(s.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div style="color:var(--text3);font-size:13px;padding:8px 0">No signals returned.</div>`}
    </div>

    <div class="section-block">
      <div class="section-label">Risk flags</div>
      ${!r.riskFlags || r.riskFlags.length === 0
        ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">No significant risk flags identified.</div>`
        : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);padding:4px 20px 12px">
            ${r.riskFlags.map(f => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
                ${flagDot(f.severity)}
                <div>
                  <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;
                      letter-spacing:.05em;margin-right:8px">${escapeHtml(f.severity)}</span>
                  <span style="font-size:13px;color:var(--text2)">${escapeHtml(f.message)}</span>
                </div>
              </div>`).join('')}
          </div>`}
    </div>

    <div class="section-block">
      <div class="section-label">Historical context</div>
      ${!r.historicalNotes || r.historicalNotes.length === 0
        ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">
            No historical data yet for this GC or building type.
            Win rate tracking will appear here after bids are logged.
          </div>`
        : `<ul style="list-style:none;padding:0;margin:0">
            ${r.historicalNotes.map(note => `
              <li style="padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;
                  color:var(--text2);padding-left:16px;position:relative">
                <span style="position:absolute;left:0;color:var(--text3)">›</span>${escapeHtml(note)}
              </li>`).join('')}
          </ul>`}
    </div>

  `;
}

// ── DEMO AGENT PRE-RUN ────────────────────────────────────────────────

function runAgentIfNeeded() {
  if (_lastAgentResult) return;
  const state = collectFormData();
  // Phase E, Step 2 — capture the fingerprint inputs now, before the
  // promise chain, so a reactive recalc landing during the demo delay
  // can't move _lastCalcSum/_lastCalcMarkup out from under it.
  const fpSum = _lastCalcSum, fpMarkup = _lastCalcMarkup;
  getHistorySummary(state.project.gc, state.project.buildingType)
    .then(bidHistory => runBidAgent(state, _lastCalcSum, _lastCalcMarkup, bidHistory))
    .then(result => {
      _lastAgentResult = result;
      _agentCalcFingerprint = {
        bidPrice:   fpMarkup && typeof fpMarkup.finalBidPrice === 'number' ? fpMarkup.finalBidPrice : null,
        directCost: fpSum && typeof fpSum.directCostTotal === 'number' ? fpSum.directCostTotal : null
      };
      const page = document.getElementById('page-agent');
      if (page) _renderAgentResult(page, result);
    })
    .catch(e => {
      // Best-effort background pre-run (demo seed-load path, before the
      // user has necessarily visited any tab) — a bid-storage hiccup here
      // shouldn't surface as an unhandled rejection. Not rendered anywhere
      // (there's no guaranteed active #page-agent to render into yet);
      // self-heals the next time the user actually reaches Tab 7/8, which
      // goes through _launchBidAgent()'s own handled error path instead.
      console.warn('runAgentIfNeeded: pre-run failed, will retry on next Tab 7/8 visit', e);
    });
}

function _selectBidOption(type) {
  _selectedBidOption = type;

  document.querySelectorAll('[data-bid-opt]').forEach(el => {
    const isSel = el.dataset.bidOpt === type;
    el.style.borderColor = isSel ? 'var(--accent-border)' : el.dataset.defaultBorder;
    el.style.background  = isSel ? 'var(--accent-dim)'   : el.dataset.defaultBg;
  });

  document.querySelectorAll('input[name="agent-bid-option"]').forEach(radio => {
    radio.checked = radio.value === type;
  });

  ['competitive', 'recommended', 'ambitious', 'override'].forEach(t => {
    const row = document.getElementById('finalize-row-' + t);
    if (!row) return;
    const isSel = t === type;
    row.style.borderColor = isSel ? 'var(--accent-border)' : 'transparent';
    row.style.background  = isSel ? 'var(--accent-dim)'    : 'transparent';
  });
}

// ── FINALIZE MODAL ────────────────────────────────────────────────────

function _initFinalizeModal() {
  if (document.getElementById('finalize-modal-overlay')) return;
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'finalize-modal-overlay';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Select your final bid amount</div>
        <button class="modal-close" onclick="_closeFinalizeModal()">×</button>
      </div>
      <div id="finalize-modal-body"></div>
      <div id="finalize-modal-error" style="display:none;margin:0 20px 12px;padding:10px 14px;
          background:rgba(232,92,74,.08);border:1px solid rgba(232,92,74,.3);border-radius:var(--r);
          color:#e85c4a;font-size:12px"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="_closeFinalizeModal()">Cancel</button>
        <button class="btn btn-primary" id="finalize-confirm-btn" onclick="_finalizeBid()" disabled>
          Confirm + submit →
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) _closeFinalizeModal(); });
}

function _showFinalizeModal(agentOptions) {
  _initFinalizeModal();
  const body = document.getElementById('finalize-modal-body');

  const optRows = (agentOptions || []).map(opt => `
    <div class="bid-option-row" data-modal-opt="${escapeHtml(opt.type)}" onclick="_modalSelectRow(this)">
      <input type="radio" name="finalize-modal-option" value="${escapeHtml(opt.type)}" class="bid-option-radio">
      <div style="flex:1">
        <div class="bid-option-label">${escapeHtml(opt.label)}</div>
        <div class="bid-option-note">${opt.margin}% margin</div>
      </div>
      <div class="bid-option-amount">${fmtCost(opt.bidAmount)}</div>
    </div>`).join('');

  body.innerHTML = optRows + `
    <div class="bid-option-row" data-modal-opt="override" onclick="_modalSelectRow(this)">
      <input type="radio" name="finalize-modal-option" value="override" class="bid-option-radio">
      <div style="flex:1">
        <div class="bid-option-label">Custom override</div>
        <div class="custom-amount-wrap" id="modal-custom-wrap">
          <input type="number" id="modal-custom-amount" placeholder="Enter amount" min="0" step="500"
                 oninput="_modalCustomInput(this)" onclick="event.stopPropagation()"
                 style="width:160px;background:var(--surface2);border:1px solid var(--border2);
                        border-radius:var(--r);padding:5px 8px;font-size:13px;
                        color:var(--text);font-variant-numeric:tabular-nums;margin-top:4px">
        </div>
      </div>
    </div>`;

  const recRow = body.querySelector('[data-modal-opt="recommended"]');
  if (recRow) _modalSelectRow(recRow);

  // Fresh open — clear any error left over from a previous failed attempt.
  const errEl = document.getElementById('finalize-modal-error');
  if (errEl) errEl.style.display = 'none';

  document.getElementById('finalize-modal-overlay').classList.add('open');
}

function _closeFinalizeModal() {
  const el = document.getElementById('finalize-modal-overlay');
  if (el) el.classList.remove('open');
}

function _modalSelectRow(rowEl) {
  const body = document.getElementById('finalize-modal-body');
  body.querySelectorAll('.bid-option-row').forEach(r => r.classList.remove('selected'));
  rowEl.classList.add('selected');

  const radio = rowEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;

  const isOverride = rowEl.dataset.modalOpt === 'override';
  const wrap = document.getElementById('modal-custom-wrap');
  if (wrap) wrap.classList.toggle('visible', isOverride);

  const confirmBtn = document.getElementById('finalize-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = isOverride;
}

function _modalCustomInput(input) {
  const confirmBtn = document.getElementById('finalize-confirm-btn');
  if (confirmBtn) {
    const val = parseFloat(input.value);
    confirmBtn.disabled = !(val && val > 0);
  }
}

async function _finalizeBid() {
  const selected = document.querySelector('input[name="finalize-modal-option"]:checked');
  if (!selected) return;
  const decision = selected.value;

  let amount, label;
  if (decision === 'override') {
    amount = parseFloat(document.getElementById('modal-custom-amount')?.value || 0);
    if (!amount || amount <= 0) return;
    label  = 'Custom override';
  } else {
    const opt = (_lastAgentResult?.options || []).find(o => o.type === decision);
    amount = opt?.bidAmount ?? null;
    label  = opt?.label ?? decision;
  }

  if (!amount) return;

  // Phase 3: Finalize is now a real network round trip (saveBid() awaits
  // a fetch), not an instant synchronous action — guard against a
  // double-click or a slow connection firing saveBid() twice before the
  // first response lands and creating two records for one submission.
  const confirmBtn = document.getElementById('finalize-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    await submitBid();
    _closeFinalizeModal();
    _showBidToast(label, amount);
  } catch (e) {
    // submitBid() also rendered a failure panel into #output-bid, but that
    // page is hidden behind this still-open modal (Tab 8, not Tab 7) —
    // confirmed via a real Playwright run that a locator finding that
    // panel isn't the same as the user actually seeing it. Show the
    // failure here too, where the user is actually looking, and
    // re-enable the button so they can retry without leaving the modal.
    const errEl = document.getElementById('finalize-modal-error');
    if (errEl) {
      errEl.textContent = 'Bid submission failed — check your connection and try again.';
      errEl.style.display = 'block';
    }
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function _showBidToast(label, amount) {
  const existing = document.getElementById('bid-submit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bid-submit-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'background:var(--surface)', 'border:1px solid rgba(58,191,122,.35)',
    'border-radius:var(--rl)', 'padding:12px 18px',
    'color:var(--green)', 'font-size:13px', 'font-weight:500',
    'box-shadow:0 4px 12px rgba(0,0,0,.3)', 'z-index:1100',
    'transition:opacity .4s ease'
  ].join(';');
  toast.textContent = 'Bid submitted — ' + fmtCost(amount) + ' logged to history ✓';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      const btn = document.getElementById('agent-finalize-btn');
      if (btn) {
        btn.textContent = 'View bid history →';
        btn.className   = 'btn btn-ghost';
        btn.onclick     = function() { goto('history'); };
      }
    }, 400);
  }, 3000);
}

// Guarded — this file's only other top-level (module-load-time) DOM side
// effect, unlike calculator.js/drafts.js which never touch `document` at
// all. Without this guard, requiring this file under Vitest's plain
// 'node' environment (no jsdom, per vitest.config.mjs) to reach
// escapeHtml() below would throw at load time before the export block is
// ever reached.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeFinalizeModal();
  });
}

// Dual browser-global/CommonJS export, same convention as js/calculator.js
// and js/drafts.js — added specifically so escapeHtml() (the one genuinely
// pure function in this otherwise DOM-only file) is directly importable
// by the Vitest suite without a DOM.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml };
}

