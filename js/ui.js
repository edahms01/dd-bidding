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
// (this variable, mirrored into the reducer every time renderAgentTab()/
// runAgentIfNeeded() dispatch — see window.__renderAgentTab,
// bridges.js) is already sitting in state.ui.agent.cachedResult, read
// directly there instead. Unlike window.__getHasUnsavedChanges (still
// needed — hasUnsavedChanges has no reducer-state twin), this one had
// become a redundant second way to read a value React already had.

// Phase 3: set only when getHistorySummary() (a network call now) rejects
// during an agent run — distinct from the pre-existing, legitimate case
// where it resolves successfully but a GC/building type just has zero
// prior bids (getHistorySummary()'s own documented `empty` shape). Never
// set on that success path — the dispatched snapshot must not conflate
// "the request failed" with "this GC is new" into the same visible notice.
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
// (window.goto's per-tab side effects, src/state/bridges.js), same pattern as runCalculation()/
// renderAgentTab() self-refreshing on their own tab visits.
function _renderPipelineHint() {
  const el = document.getElementById('pipeline-count-hint');
  if (!el) return;
  // Step 2B: _draftsCache (js/forms.js) instead of an async getAllDrafts()
  // — this runs synchronously on every tab visit, same reasoning as
  // js/state.js's openDraftCount read.
  const count = getOpenDraftCount(_draftsCache, activeDraftId);
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

// Escapes the 5 characters that matter for safe interpolation into
// innerHTML (as text content or as a quoted attribute value) — used at
// every spot in this file that writes a dynamic string into markup.
// Not a fix for the separate inline-onclick JS-string-context case —
// HTML-entity decoding happens before the browser evaluates an inline
// event handler's JS source, so escaping quotes here doesn't close that
// path the way it does for text content or a plain attribute value.
// (Migration Phase 4: fmtCost()/fmtPct() and every legacy render body
// they backed are deleted; escapeHtml() itself is kept — it's imported
// directly by tests/unit/ui.test.js, see the export note below.)
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
// re-render, same reasoning as every other converted page.
//
// Migration Phase 4: the old fallback body (_renderOutputLegacy(), used
// only when the bridge wasn't registered — Vitest/non-browser contexts,
// or before AppShell had mounted) is deleted. Every real user
// interaction is gated behind AppShell's mount effect, which registers
// this bridge before dispatching 'dirigo:shell-ready' (the event that
// unblocks js/forms.js's _initApp()) — there is no UI to click before
// that ordering holds, so the fallback was dead in every reachable path.
function renderOutput(state, wallCosts, ceilCosts, summary, markupResult) {
  window.__renderOutput({ state, wallCosts, ceilCosts, summary, markupResult });
}

// ── ORCHESTRATION ─────────────────────────────────────────────────────

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
  const state        = collectFormData();
  // Resolved once, before any row-level calculation — see js/calculator.js's
  // applyRateEscalation() doc comment. Only the wall/ceiling calls receive
  // the escalated rates; calculateLogistics() below keeps state.rates
  // unescalated (delivery/disposal/lift aren't material-price-risk lines).
  const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, escalatedRates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct,
    state.rates.burdenPct, state.rates.superPct,
    state.rates.adder12Pct, state.rates.adder20Pct,
    state.conditions.sfAbove12, state.conditions.sfAbove20);
  const markupResult = applyMarkup(summary, state.markupInputs);
  renderOutput(state, wallCosts, ceilCosts, summary, markupResult);

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
// resolved choice (FinalizeModal.jsx's handleConfirm()) — threaded
// straight through to buildBidRecord() (js/state.js), which is
// where it actually replaces the plain-calculator amount. Everything
// below still computes state/summary/markupResult exactly as before:
// they're still the source for direct_cost/estimated_labor_cost/
// estimated_material_cost, which are legitimately plain-calculator-
// derived and out of scope for this fix.
async function submitBid(finalizeSelection) {
  const state        = collectFormData();
  const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, escalatedRates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct,
    state.rates.burdenPct, state.rates.superPct,
    state.rates.adder12Pct, state.rates.adder20Pct,
    state.conditions.sfAbove12, state.conditions.sfAbove20);
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
    // bug is about) — not fixed here, see CLAUDE.md/the A2 plan.
    // Migration Phase 4: the direct-write fallback (used only when the
    // bridge wasn't registered) is deleted — same dead-in-every-
    // reachable-path reasoning as renderOutput()/renderAgentTab() above.
    window.__setSubmitResult({ status: 'error' });
    throw e; // let FinalizeModal.jsx's handleConfirm() catch re-enable the confirm button
  }

  // The finalized draft now lives permanently in the bids store — clear it
  // out of the drafts store so "New Bid"/Home never shows stale,
  // already-submitted data. Step 2B: now a network call — awaited so the
  // Home-nav dispatch that follows (FinalizeModal.jsx) doesn't race the
  // delete.
  await clearFinalizedDraft();

  window.__setSubmitResult({ status: 'success', saved });
}

// ── BID AGENT RENDER ──────────────────────────────────────────────────

// A2: AgentPage is now React-owned. window.__renderAgentTab (src/state/
// bridges.js) dispatches the current snapshot into the reducer instead
// of this function's old four-way innerHTML branch — AgentPage.jsx
// replicates the exact same branch order and priority (a cached result
// wins even over a fresh load in flight — see store.jsx's
// RENDER_AGENT_TAB). The legacy body's fourth, easy-to-miss branch:
// when _lastAgentResult is empty and _agentLoading is false but
// _agentResult *is* available, it falls through to displaying that
// result AND caching it as _lastAgentResult for next time. Found by
// reproducing two real test failures, not by re-reading carefully
// enough the first time: dispatching only _lastAgentResult (skipping
// this fallback) meant the very first render of a real result — right
// after the agent call resolves, before anything else has ever cached
// it — fell through to the empty state instead, in both
// agent-history-fallback.spec.js and draft-switch-no-contamination.
// spec.js. resultToShow below reconstructs the same fallback chain, and
// caches it into _lastAgentResult exactly when the legacy branch would
// have.
//
// Migration Phase 4: the old fallback body (_renderAgentTabLegacy() and
// _renderAgentResult(), used only when the bridge wasn't registered) is
// deleted — same dead-in-every-reachable-path reasoning as
// renderOutput() above.
function renderAgentTab() {
  const resultToShow = _lastAgentResult || (!_agentLoading ? _agentResult : null);
  if (resultToShow) _lastAgentResult = resultToShow;
  window.__renderAgentTab({ cachedResult: resultToShow, loading: _agentLoading, historyUnavailable: _agentHistoryUnavailable, generatedAt: _agentCalcFingerprint });
}

// ── DEMO AGENT PRE-RUN ────────────────────────────────────────────────

function runAgentIfNeeded() {
  // Returns a promise resolving to the agent result (or the already-cached
  // one) — data/seed.js's dual-demo live load awaits this to show a
  // success/failure note in the toolbar. Callers that don't care can
  // ignore the return, exactly as before.
  if (_lastAgentResult) return Promise.resolve(_lastAgentResult);
  const state = collectFormData();
  // Phase E, Step 2 — capture the fingerprint inputs now, before the
  // promise chain, so a reactive recalc landing during the demo delay
  // can't move _lastCalcSum/_lastCalcMarkup out from under it.
  const fpSum = _lastCalcSum, fpMarkup = _lastCalcMarkup;
  return getHistorySummary(state.project.gc, state.project.buildingType)
    .then(bidHistory => runBidAgent(state, _lastCalcSum, _lastCalcMarkup, bidHistory))
    .then(result => {
      _lastAgentResult = result;
      _agentCalcFingerprint = {
        bidPrice:   fpMarkup && typeof fpMarkup.finalBidPrice === 'number' ? fpMarkup.finalBidPrice : null,
        directCost: fpSum && typeof fpSum.directCostTotal === 'number' ? fpSum.directCostTotal : null
      };
      // Migration Phase 4: was `if (page) _renderAgentResult(page, result);`
      // — _renderAgentResult() is deleted (its legacy branch was the only
      // reason it existed as its own function; its bridge branch is
      // inlined here, its only surviving caller). The `if (page)` guard
      // is left exactly as it was — out of this phase's scope, see the
      // plan's implementation notes.
      const page = document.getElementById('page-agent');
      if (page) {
        _lastAgentResult = result;
        window.__renderAgentTab({ cachedResult: result, loading: false, historyUnavailable: _agentHistoryUnavailable, generatedAt: _agentCalcFingerprint });
      }
      return result;
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

// ── FINALIZE MODAL BRIDGE NOTE ───────────────────────────────────────
// The finalize modal itself is React now (src/pages/FinalizeModal.jsx).
// _initFinalizeModal()/_showFinalizeModal()/_closeFinalizeModal()/
// _modalSelectRow()/_modalCustomInput()/_finalizeBid() were the classic-
// script implementation — all dead, removed in the A2 close-out cleanup.
// window._closeFinalizeModal is still a real bridge (src/state/bridges.js)
// that js/ui.js's own Escape-key listener below calls by name.
// The post-finalize confirmation toast is React now too
// (src/components/BidSubmitToast.jsx) — _showBidToast() was removed with
// the post-finalize-Home-nav change; nothing here shows it any more.

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

