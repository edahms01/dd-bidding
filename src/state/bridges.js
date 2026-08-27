// ─────────────────────────────────────────────────────────────────────
// bridges.js — window-global functions that let still-classic-script
// code (inline onclick="..." attributes, js/forms.js, js/tabs.js) keep
// working unmodified against AppShell's React state, exactly the same
// "legacy window bridge, dropped once nothing needs it" pattern already
// used for the module-export conversion in the Preflight resolution —
// reused here for navigation and Rates hydration specifically.
//
// registerBridges(dispatch) is called once by AppShell on mount. Until
// then these are no-ops (shouldn't happen in practice — AppShell mounts
// before any user interaction is possible — but fails quietly rather
// than throwing if it somehow did).
// ─────────────────────────────────────────────────────────────────────

let _dispatch = null;

export function registerBridges(dispatch) {
  _dispatch = dispatch;

  // ── Tab routing — replaces js/tabs.js's goto() ──
  // Preserves goto()'s exact per-tab side effects, minus the 'rates'
  // case (RatesPage now handles its own on-become-active side effects,
  // e.g. loading the rate-template list, via its own effect).
  window.goto = function goto(id) {
    if (id === 'history') { window.showHistory(); return; }
    _dispatch({ type: 'GOTO_TAB', id });
    // Legacy side effects for still-vanilla pages — unchanged targets,
    // just no longer routed through goto()'s own class-toggling.
    // 'conditions' removed: ConditionsPage now handles its own
    // on-become-active side effect (_renderPipelineHint()) via its own
    // effect, same pattern as RatesPage's template-list load.
    if (id === 'output') window.runCalculation?.();
    if (id === 'agent') window.renderAgentTab?.();
  };

  // ── Left-nav section switches — replace js/tabs.js's showHistory()/
  // showDashboard(). History no longer calls the legacy renderHistory()
  // — HistoryPage is a real React component now and fetches its own
  // data (see HistoryPage.jsx's effect on becoming active). Dashboard
  // is unconverted this spike — same LegacyPage/window.renderDashboard()
  // path as before.
  window.showHistory = function showHistory() {
    _dispatch({ type: 'GOTO_SECTION', section: 'history' });
  };

  window.showDashboard = function showDashboard() {
    _dispatch({ type: 'GOTO_SECTION', section: 'dashboard' });
    window.renderDashboard?.();
  };

  // ── Nav collapse toggle — replaces js/tabs.js's toggleNav(). Keeps
  // the exact same localStorage key/persistence behavior.
  window.toggleNav = function toggleNav() {
    // Read current value off the DOM class rather than plumbing state
    // back out of this module — AppShell renders navCollapsed from
    // state, so toggling is just "set to the opposite of what's
    // currently rendered." Cheap and avoids a second source of truth.
    const nav = document.getElementById('app-leftnav');
    const collapsed = !nav.classList.contains('collapsed');
    localStorage.setItem('dirigo_nav_collapsed', collapsed ? '1' : '');
    _dispatch({ type: 'SET_NAV_COLLAPSED', value: collapsed });
  };

  // ── Rates hydration — replaces js/forms.js's populateForm()/
  // applyRateTemplate() direct DOM set(id, val) writes for the Rates
  // section (see the calls in those two functions). Writing straight to
  // a React-controlled <input>'s .value would be silently overwritten
  // on the next re-render, since React never learns the DOM changed
  // out from under it — this dispatches into the real state instead.
  window.__hydrateRates = function __hydrateRates(rates, rateEscalation) {
    _dispatch({ type: 'LOAD_RATES', rates, rateEscalation });
  };

  // ── Project/Conditions/Intelligence hydration — same reasoning as
  // __hydrateRates above, generic LOAD_SECTION action (see store.jsx).
  window.__hydrateProject = (project) => _dispatch({ type: 'LOAD_SECTION', key: 'project', value: project });
  window.__hydrateConditions = (conditions) => _dispatch({ type: 'LOAD_SECTION', key: 'conditions', value: conditions });
  window.__hydrateIntelligence = (intelligence) => _dispatch({ type: 'LOAD_SECTION', key: 'intelligence', value: intelligence });

  // ── Bid reset — replaces js/forms.js's resetFormFields() direct
  // el.value = '' writes for every React-owned bid section (project/
  // conditions/intelligence/rates/rateEscalation), same controlled-input
  // hazard as the hydrate bridges above. See store.jsx's RESET_BID.
  window.__resetBidState = () => _dispatch({ type: 'RESET_BID' });
}

// ── Confidence read accessor ──
// STATE.conf (js/state.js) is folded into the reducer now that
// Conditions has converted (conditions.confidence) — but
// collectFormData() (js/state.js) still needs to read the CURRENT
// confidence value for every caller that isn't ConditionsPage itself
// (autosave, export, submitBid, the agent). This is the read-direction
// counterpart to the hydrate bridges above: legacy code reading FROM
// React state, not writing into it. Registered separately from
// registerBridges() (called from ConditionsPage itself, not AppShell)
// since it needs live access to conditions.confidence specifically, not
// just a dispatch function.
export function registerConfidenceReader(getConfidence) {
  window.__getConfidence = getConfidence;
}
