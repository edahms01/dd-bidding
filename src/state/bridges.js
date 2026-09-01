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
import { flushSync } from 'react-dom';

let _dispatch = null;

export function registerBridges(dispatch) {
  _dispatch = dispatch;

  // ── Tab routing — replaces js/tabs.js's goto() ──
  // Preserves goto()'s exact per-tab side effects, minus the 'rates'
  // case (RatesPage now handles its own on-become-active side effects,
  // e.g. loading the rate-template list, via its own effect). The
  // 'history' branch dispatches directly now rather than calling a
  // separate window.showHistory — see the A2 cleanup-pass note below
  // for why that standalone bridge (and window.showDashboard/
  // toggleNav) is gone.
  window.goto = function goto(id) {
    if (id === 'history') { _dispatch({ type: 'GOTO_SECTION', section: 'history' }); return; }
    _dispatch({ type: 'GOTO_TAB', id });
    // Legacy side effects for still-vanilla pages — unchanged targets,
    // just no longer routed through goto()'s own class-toggling.
    // 'conditions' removed: ConditionsPage now handles its own
    // on-become-active side effect (_renderPipelineHint()) via its own
    // effect, same pattern as RatesPage's template-list load.
    if (id === 'output') window.runCalculation?.();
    if (id === 'agent') window.renderAgentTab?.();
  };

  // ── A2 cleanup pass: window.showHistory()/showDashboard()/toggleNav()
  // (which used to replace js/tabs.js's same-named functions) are gone.
  // Once every page converted, their only remaining callers were
  // AppShell's own onClick handlers — no classic-script consumer left at
  // all (unlike window.goto above, still called by js/forms.js's
  // switchToDraft()/createDraft() as a bare identifier) — so AppShell
  // dispatches GOTO_SECTION/SET_NAV_COLLAPSED directly instead of
  // through a bridge that existed only for AppShell to call itself
  // through. js/tabs.js's own goto/showHistory/showDashboard/toggleNav
  // were already dead (shadowed) before this; nothing additional to
  // update there.

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
  window.__hydrateMarkup = (markupInputs) => _dispatch({ type: 'LOAD_SECTION', key: 'markupInputs', value: markupInputs });

  // ── Bid reset — replaces js/forms.js's resetFormFields() direct
  // el.value = '' writes for every React-owned bid section (project/
  // conditions/intelligence/rates/rateEscalation/assemblies/walls/
  // ceilings), same controlled-input hazard as the hydrate bridges
  // above. See store.jsx's RESET_BID. flushSync — see
  // __hydrateAssemblies below for why: resetFormFields() no longer does
  // its own direct #asm-body/#wall-body/#ceil-body DOM rebuild (each
  // page owns its own list via .map() now, and manually mutating a list
  // React also renders is a different, worse hazard than the leaf-value
  // case — see CLAUDE.md), so this dispatch is the *only* thing that
  // clears those three tables, and _createAndActivateBlankDraft() reads
  // them back synchronously right after resetFormFields() returns.
  window.__resetBidState = () => flushSync(() => _dispatch({ type: 'RESET_BID' }));

  // ── Assemblies row hydration — replaces populateForm()'s
  // asmBody.innerHTML = ''; asmCount = 0; rows.forEach(() => addAsm())
  // DOM rebuild (see store.jsx's LOAD_ASSEMBLY_ROWS). Structural, not a
  // leaf-value write, so the dual-write trick the scalar bridges above
  // use (plain DOM write + dispatch, see CLAUDE.md checklist item 4)
  // does NOT apply here: AssembliesPage owns #asm-body's children via
  // .map() now, and manually rebuilding that same subtree from classic-
  // script code would fight React's own reconciliation of it (wrong
  // hazard class — list/child-identity conflicts, not just a value
  // getting silently reverted). flushSync forces React to apply the
  // dispatch's DOM update synchronously, before this function returns,
  // instead of the default batched/async commit — so a caller that
  // reads collectFormData() immediately after (loadSeedData() ->
  // runCalculation(), the same shape that caused Tab 7's "$0" flash for
  // Rates) sees the freshly-hydrated rows, not stale ones. Verified
  // directly, not assumed — see the AssembliesPage build report.
  window.__hydrateAssemblies = (rows) => flushSync(() => _dispatch({ type: 'LOAD_ASSEMBLY_ROWS', rows }));

  // ── Walls/Ceilings row hydration — same reasoning/shape as
  // __hydrateAssemblies above (WallsPage/CeilingsPage own their
  // <tbody>s via .map() now too).
  // 3.3: optional 2nd arg (mode) rides along on the same dispatch —
  // LOAD_WALL_ROWS/LOAD_CEILING_ROWS (store.jsx) fall back to the
  // schema default when it's undefined (pre-3.3 draft/import).
  window.__hydrateWalls = (rows, mode) => flushSync(() => _dispatch({ type: 'LOAD_WALL_ROWS', rows, mode }));
  window.__hydrateCeilings = (rows, mode) => flushSync(() => _dispatch({ type: 'LOAD_CEILING_ROWS', rows, mode }));

  // ── Output — replaces js/ui.js's renderOutput() direct #output-phase3/
  // #output-bid.innerHTML writes. No flushSync: nothing reads the DOM
  // synchronously right after runCalculation() calls this (unlike the
  // row-hydration bridges above) — plain dispatch is correct and
  // preferred here (see CLAUDE.md's flushSync scoping caution: reach for
  // it only for the one class of problem it actually fixes).
  window.__renderOutput = (output) => _dispatch({ type: 'RENDER_OUTPUT', output });

  // ── Submit result — replaces submitBid()'s (js/ui.js) direct
  // #output-bid.innerHTML writes for the post-finalize success/failure
  // panel. Deliberately preserves the wrong-tab bug exactly as it exists
  // today (see CLAUDE.md/the A2 plan — not fixed in A2): this just
  // dispatches into OutputPage's own state the same #output-bid write
  // always targeted, regardless of which tab is actually active when
  // submitBid() runs.
  window.__setSubmitResult = (result) => _dispatch({ type: 'SET_SUBMIT_RESULT', result });

  // ── Finalize modal close — replaces js/ui.js's _closeFinalizeModal().
  // The modal is a real shell-owned component now (FinalizeModal.jsx,
  // rendered by AppShell), which dispatches CLOSE_FINALIZE_MODAL
  // directly for its own Cancel/×/overlay-click handlers — this bridge
  // overwrites the classic-script function declaration of the same
  // name (shadowing, same mechanism window.goto relies on) purely so
  // js/ui.js's own document.addEventListener('keydown', ...) Escape
  // handler keeps working: it calls _closeFinalizeModal as a bare
  // identifier, resolved at call time, so it picks up this overwritten
  // definition automatically. That keydown listener is the *only*
  // remaining consumer — a genuine classic-script one, unlike
  // window._showFinalizeModal (below, now gone) or
  // window.__getLastAgentResult (js/ui.js, now gone), which had none
  // left once Agent/Output converted; only AgentPage.jsx's/
  // OutputPage.jsx's own onClick handlers called those, so they dispatch
  // OPEN_FINALIZE_MODAL directly and read state.ui.agent.cachedResult
  // (already the same value _lastAgentResult held) instead now.
  // _initFinalizeModal()/_showFinalizeModal()/_modalSelectRow()/
  // _modalCustomInput()/_finalizeBid() are all fully dead — nothing
  // calls any of them (verified: grepped every call site before
  // converting, per the accessor-audit discipline — see CLAUDE.md).
  window._closeFinalizeModal = () => _dispatch({ type: 'CLOSE_FINALIZE_MODAL' });

  // ── Agent tab rendering — replaces js/ui.js's renderAgentTab()/
  // _renderAgentResult() innerHTML writes (AgentPage.jsx). Both
  // functions still exist and still run on every call site they always
  // did (window.goto's 'agent' case, both calls inside
  // _launchBidAgent(), runAgentIfNeeded()) — they still own reading the
  // classic-script globals (_lastAgentResult/_agentLoading/
  // _agentHistoryUnavailable) and writing _lastAgentResult, just dispatch
  // a snapshot into the reducer instead of building HTML. See
  // store.jsx's RENDER_AGENT_TAB for why cachedResult/loading/
  // historyUnavailable are passed through as separate fields rather than
  // pre-collapsed into one "mode" here — the component needs to
  // replicate the exact same branch order the original had.
  window.__renderAgentTab = (snapshot) => _dispatch({ type: 'RENDER_AGENT_TAB', ...snapshot });

  // ── Agent cache reset — replaces js/ui.js's _resetAgentCache() direct
  // global writes, called alongside them (not instead) on every draft
  // switch/blank-draft activation, so Tab 8's cached result can't leak
  // across drafts.
  window.__resetAgentCache = () => _dispatch({ type: 'RESET_AGENT_CACHE' });
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

// ── Walls/Ceilings mode read accessors (3.3) ──
// Same shape and reasoning as registerConfidenceReader() above:
// wallsMode/ceilingsMode (a page-level toggle, not a form value) have no
// DOM representation for collectFormData() to read the normal way —
// registered from WallsPage.jsx/CeilingsPage.jsx themselves (page owns
// its own bridge, matching ConditionsPage.jsx's precedent), not
// centralized in registerBridges(), since each needs live access to its
// own page's reducer slice specifically.
export function registerWallsModeReader(getMode) {
  window.__getWallsMode = getMode;
}
export function registerCeilingsModeReader(getMode) {
  window.__getCeilingsMode = getMode;
}
