// ─────────────────────────────────────────────────────────────────────
// AppShell.jsx — header, left nav, tab bar, and the page-switching that
// used to live in js/tabs.js. Registers the window bridges on mount so
// every existing inline onclick="goto(...)"/"showHistory()"/etc. keeps
// working unmodified, whether it's calling into a LegacyPage or a real
// React page.
//
// Every page renders unconditionally, always mounted — only className
// (active/inactive) changes based on ui state. This is deliberate, not
// an oversight: the current app never destroys a page's DOM on
// navigation (just toggles a CSS class), so a user's not-yet-submitted
// typing on any page survives switching away and back. Conditionally
// mounting/unmounting pages in React would silently break that for
// every LegacyPage the moment the user navigated away — a real
// behavior regression, not a refactor.
// ─────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useRef } from 'react';
import { useStore } from './state/store.jsx';
import { registerBridges } from './state/bridges.js';
import { parseHash, canonicalHash } from './state/router.js';
import { stepStatus } from './state/stepStatus.js';
import ProjectPage from './pages/ProjectPage.jsx';
import ConditionsPage from './pages/ConditionsPage.jsx';
import RatesPage from './pages/RatesPage.jsx';
import AssembliesPage from './pages/AssembliesPage.jsx';
import WallsPage from './pages/WallsPage.jsx';
import CeilingsPage from './pages/CeilingsPage.jsx';
import OutputPage from './pages/OutputPage.jsx';
import MarketReadPage from './pages/MarketReadPage.jsx';
import AgentPage from './pages/AgentPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FinalizeModal from './pages/FinalizeModal.jsx';
import BidTotalRail from './components/BidTotalRail.jsx';
import RowUndoToast from './components/RowUndoToast.jsx';
import HistoryToolbar from './components/HistoryToolbar.jsx';

// 4.1: tabs where the rail shows — "visible from Assemblies onward" per
// the decision record, not project/conditions/rates (which either
// precede any takeoff data existing at all, or already have their own
// totals display — RatesPage.jsx's own crude tile).
const RAIL_TABS = ['assemblies', 'walls', 'ceilings', 'output', 'market', 'agent'];

// Phase C 2.1 — 9 steps in cost-then-price order. Internal keys are
// unchanged from the pre-C set (conditions/output/agent kept on purpose —
// see CLAUDE.md's key-rename decision); only `label` moved, and `market`
// is the one new key (the price-driving half split off the old
// Conditions page). `num` is the display index, renumbered here.
const WORKFLOW_TABS = [
  { id: 'project',     num: 1, label: 'Project' },
  { id: 'conditions',  num: 2, label: 'Site Conditions' },
  { id: 'assemblies',  num: 3, label: 'Assemblies' },
  { id: 'walls',       num: 4, label: 'Walls' },
  { id: 'ceilings',    num: 5, label: 'Ceilings' },
  { id: 'rates',       num: 6, label: 'Rates' },
  { id: 'output',      num: 7, label: 'Cost Summary' },
  { id: 'market',      num: 8, label: 'Market Read' },
  { id: 'agent',       num: 9, label: 'Bid Strategy' }
];

export default function AppShell() {
  const [state, dispatch] = useStore();
  const { activeSection, activeTab, navCollapsed } = state.ui;

  // Phase C 2.2 — URL routing. stateRef gives the once-registered
  // hashchange listener the *current* section/tab without re-subscribing
  // on every nav; urlSyncedOnce lets the state->URL effect skip its
  // first run (first-mount URL handling belongs to the URL->state effect)
  // so "app booted" isn't its own Back target. See src/state/router.js.
  const stateRef = useRef({ activeSection, activeTab });
  stateRef.current = { activeSection, activeTab };
  const urlSyncedOnce = useRef(false);
  const steps = stepStatus(state.bid, state.ui);

  useEffect(() => {
    registerBridges(dispatch);
    // A2 spike finding: forms.js's INIT section (addAsm()/addWall()/
    // addCeil() default rows, the .workflow-area input/change delegation
    // that drives autosave, and _initDraftsAndResume()'s draft restore)
    // all ran at classic-<script>-load time, before React mounted at
    // all — safe when every page was static HTML, present in the DOM
    // the instant the parser reached that script tag. Now that
    // Assemblies/Walls/Ceilings/etc. are LegacyPage-cloned from a
    // <template> inside a post-mount effect, none of that DOM exists
    // yet when forms.js's top-level code runs, and DOMContentLoaded
    // doesn't reliably wait for React's effects either (module scripts
    // execute before DOMContentLoaded, but React schedules useEffect
    // for after paint — a race, not a guarantee). Confirmed by
    // reproducing the failure directly (addAsm() throwing on a null
    // #asm-body) rather than reasoning it away.
    //
    // Fix: AppShell dispatches this event once every LegacyPage child's
    // mount effect has run (children's effects fire before a parent's,
    // in the same commit, so by the time this one fires every template
    // has been cloned in). forms.js listens for it instead of
    // DOMContentLoaded — see the INIT section at the bottom of forms.js.
    window.dispatchEvent(new CustomEvent('dirigo:shell-ready'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4.2: reactive calculation. Covers the half js/forms.js's
  // _handleFormChange() (uncontrolled-input keystrokes) can't —
  // React-dispatched row add/delete/duplicate/undo, hydration on draft
  // switch/import/reset, and controlled fields (Project/Conditions/
  // Rates/Markup) don't reliably fire a native input/change event that
  // bubbles to .workflow-area. Every bid-touching reducer branch returns
  // a new state.bid reference, so this fires on every relevant dispatch.
  //
  // Deliberately does NOT also drive autosave/hasUnsavedChanges here —
  // tried that for 3.5 (calling window._handleFormChange() on every
  // state.bid change) and reverted it after it broke 11 specs: this
  // effect fires on hydration too (draft switch/import/reset/boot-resume,
  // not just genuine user edits), and every one of those flows already
  // has its own deliberate hasUnsavedChanges/save handling (switchToDraft
  // (), handleImportFile(), _createAndActivateBlankDraft(), etc.) —
  // firing _handleFormChange() indiscriminately fought those, most
  // visibly by marking hasUnsavedChanges true right after a fresh import
  // hydrated, which made handleImportFile()'s OWN "overwrite unsaved
  // changes?" confirm guard fire on the *next* import and silently abort
  // it (auto-dismissed by Playwright, field left blank). Reactive calc
  // is safe to run unconditionally on hydration (recomputing numbers
  // from freshly-loaded data is always correct); autosave is not (it's
  // a write, and firing it outside a flow that already accounts for
  // hasUnsavedChanges can clobber that flow's own bookkeeping). See
  // AssembliesPage.jsx/WallsPage.jsx/CeilingsPage.jsx/RowUndoToast.jsx
  // for 3.5's actual fix — a direct window._handleFormChange() call at
  // each specific row add/delete/duplicate/undo action, the same
  // per-action shape 3.3's mode toggle already used (RatesPage.jsx's
  // needsImmediateSave precedent), not a blanket watcher.
  useEffect(() => {
    window.scheduleRecalc?.();
  }, [state.bid]);

  // Phase C 2.2 — URL -> state. Parse location.hash on mount (deep link)
  // and on every browser Back/Forward or manual edit, dispatching to
  // match. Registered once; reads live state through stateRef so it
  // never needs re-subscribing. An unrecognized hash is ignored (the
  // state->URL effect below will re-assert a canonical one).
  useEffect(() => {
    function applyHash() {
      const cur = stateRef.current;
      const parsed = parseHash(window.location.hash);
      if (!parsed) {
        // Empty or garbage hash — snap the URL back to the canonical
        // form for whatever step is showing. replaceState doesn't fire
        // hashchange, so this can't loop.
        const c = canonicalHash(cur.activeSection, cur.activeTab);
        if (window.location.hash !== c) window.history.replaceState(null, '', c);
        return;
      }
      if (parsed.section === 'workflow') {
        if (cur.activeSection !== 'workflow' || cur.activeTab !== parsed.tab) {
          // Route through window.goto so a Back/Forward or deep link to
          // #/output / #/agent fires the same per-tab side effects
          // (runCalculation / renderAgentTab) a normal tab click does —
          // registerBridges() has run by the time this effect exists.
          if (window.goto) window.goto(parsed.tab);
          else dispatch({ type: 'GOTO_TAB', id: parsed.tab });
        }
      } else if (cur.activeSection !== parsed.section) {
        dispatch({ type: 'GOTO_SECTION', section: parsed.section });
      }
    }
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase C 2.2 — state -> URL. The first run is skipped entirely: the
  // URL -> state effect above already owns first-mount URL handling
  // (replaceState for an empty/garbage hash, a dispatch for a valid deep
  // link), and a push here would add a spurious "app booted" history
  // entry. Every later navigation pushState's so it's a real Back
  // target. The `hash !== desired` guard makes this a no-op for
  // Back/Forward-driven dispatches (the browser already set the hash) —
  // that guard is what prevents the bounce-between-two-entries failure.
  useEffect(() => {
    if (!urlSyncedOnce.current) {
      urlSyncedOnce.current = true;
      return;
    }
    const desired = canonicalHash(activeSection, activeTab);
    if (window.location.hash !== desired) window.history.pushState(null, '', desired);
  }, [activeSection, activeTab]);

  return (
    <Fragment>
    <div className="shell">
      <header className="header">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <line x1="5" y1="7" x2="11" y2="7" />
              <line x1="5" y1="10" x2="8" y2="10" />
            </svg>
          </div>
          <div>
            <div className="logo-name">Dirigo Drywall</div>
            <div className="logo-sub">Bid System</div>
          </div>
        </div>
        <div className="header-actions">
          {/* Static JSX text — populateForm() mutates this span's
              textContent directly via document.querySelector('.proj-badge
              span'); since this element's JSX never changes across
              re-renders, React never diffs it, so that mutation survives
              exactly like it does today. */}
          <div className="proj-badge">Project: <span>New bid</span></div>
          {/* Same reasoning: #autosave-indicator's class/text are mutated
              directly by js/forms.js's _setIndicator(); static JSX here
              means React never overwrites it. */}
          <span id="autosave-indicator" className="autosave-indicator" />
          <button className="btn btn-ghost btn-sm" onClick={() => window.exportBid?.()}>Export</button>
          <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('import-file-input').click()}>Import</button>
          <input type="file" id="import-file-input" accept="application/json" style={{ display: 'none' }} onChange={(e) => window.handleImportFile?.(e)} />
        </div>
      </header>

      <div className="app-layout">
        {/* A2 cleanup pass: dispatches directly instead of going through
            window.showHistory()/showDashboard()/toggleNav() (bridges.js)
            — those bridges had no remaining classic-script consumer once
            every page converted, only this component's own onClick
            handlers, so the indirection was removed along with them
            (see CLAUDE.md). Fixed a real, pre-existing bug found while
            doing this: className was hardcoded to "leftnav", never
            conditionally including "collapsed" — toggleNav() correctly
            flipped navCollapsed (the labels/toggle-icon always updated),
            but the sidebar's own width (.leftnav.collapsed, css/
            components.css) never actually changed, because nothing ever
            put the class on this element. Reproduced directly (toggled,
            read getComputedStyle(nav).width, it never changed) before
            fixing. */}
        <nav className={'leftnav' + (navCollapsed ? ' collapsed' : '')} id="app-leftnav">
          <div className="nav-items">
            <div className={'nav-item' + (activeSection === 'workflow' ? ' active' : '')} data-nav="workflow" onClick={() => window.createDraft?.()} title="New Bid">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" />
                <path d="M9 2v4h4" />
                <line x1="6" y1="9" x2="10" y2="9" />
                <line x1="8" y1="7" x2="8" y2="11" />
              </svg>
              {!navCollapsed && <span className="nav-label">New Bid</span>}
            </div>

            <div className={'nav-item' + (activeSection === 'history' ? ' active' : '')} data-nav="history" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'history' })} title="Bid History">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <polyline points="8 5 8 8.5 10.5 10.5" />
              </svg>
              {!navCollapsed && <span className="nav-label">Bid History</span>}
            </div>

            <div className={'nav-item' + (activeSection === 'dashboard' ? ' active' : '')} data-nav="dashboard" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'dashboard' })} title="Dashboard">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              {!navCollapsed && <span className="nav-label">Dashboard</span>}
            </div>

            <div className="nav-item nav-placeholder" title="Coming soon">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2" />
                <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" />
              </svg>
              {!navCollapsed && <span className="nav-label">Settings</span>}
            </div>
          </div>

          <button className="nav-toggle" onClick={() => {
            const collapsed = !navCollapsed;
            localStorage.setItem('dirigo_nav_collapsed', collapsed ? '1' : '');
            dispatch({ type: 'SET_NAV_COLLAPSED', value: collapsed });
          }}>
            <span id="nav-toggle-icon">
              {navCollapsed ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 3 11 8 6 13" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 3 5 8 10 13" /></svg>
              )}
            </span>
          </button>
        </nav>

        <div className="workflow-area">
          {activeSection === 'workflow' && (
            <nav className="tabs" id="app-tabs">
              {WORKFLOW_TABS.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && <div className="tab-sep">›</div>}
                  <div
                    className={
                      'tab' +
                      (activeTab === t.id ? ' active' : '') +
                      (steps[t.id] === 'complete' ? ' done' : steps[t.id] === 'partial' ? ' partial' : '')
                    }
                    onClick={() => window.goto(t.id)}
                    id={'tab-' + t.id}
                  >
                    <span className="tnum">{t.num}</span> {t.label}
                  </div>
                </Fragment>
              ))}
            </nav>
          )}

          {activeSection === 'workflow' && RAIL_TABS.includes(activeTab) && (
            <BidTotalRail output={state.ui.output} />
          )}

          {/* Phase C 2.4 — keep the frame stable on Bid History: the
              step-bar slot carries a filter toolbar instead of going
              blank. Step 4 folds Dashboard + History into one Bids list
              and this toolbar grows a status filter with it. */}
          {activeSection === 'history' && <HistoryToolbar />}

          <div className="body">
            <ProjectPage active={activeSection === 'workflow' && activeTab === 'project'} />
            <ConditionsPage active={activeSection === 'workflow' && activeTab === 'conditions'} />
            <RatesPage active={activeSection === 'workflow' && activeTab === 'rates'} />
            <AssembliesPage active={activeSection === 'workflow' && activeTab === 'assemblies'} />
            <WallsPage active={activeSection === 'workflow' && activeTab === 'walls'} />
            <CeilingsPage active={activeSection === 'workflow' && activeTab === 'ceilings'} />
            <OutputPage active={activeSection === 'workflow' && activeTab === 'output'} />
            <MarketReadPage active={activeSection === 'workflow' && activeTab === 'market'} />
            <AgentPage active={activeSection === 'workflow' && activeTab === 'agent'} />
            <DashboardPage active={activeSection === 'dashboard'} />
            <HistoryPage active={activeSection === 'history'} />
          </div>
        </div>
      </div>
    </div>
    <FinalizeModal />
    <RowUndoToast />
    </Fragment>
  );
}
