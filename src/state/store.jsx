// ─────────────────────────────────────────────────────────────────────
// store.jsx — the one reducer/context AppShell owns.
//
// Built out incrementally as each page converts — the `bid` slice below
// holds project/conditions/intelligence/rates/rateEscalation now that
// Project and Conditions have joined Rates. Every not-yet-converted page
// still lives in the DOM on its LegacyPage, read via the existing
// collectFormData()/populateForm().
//
// `ui` holds the shell-level navigation state that used to live in
// js/tabs.js's module-level variables (_lastWorkflowTab) and the DOM
// itself (.tab.active / .page.active / .nav-item.active classes,
// #app-tabs display). AppShell renders every page unconditionally,
// always mounted — only className changes based on this state — to
// exactly preserve today's behavior of never destroying a page's DOM
// (and whatever a user has typed into it) on navigation.
// ─────────────────────────────────────────────────────────────────────
import { createContext, useContext, useReducer } from 'react';

export const initialState = {
  ui: {
    // 'workflow' | 'history' | 'dashboard' — mirrors js/tabs.js's
    // _navSetActive() section concept.
    activeSection: 'workflow',
    // which of the 8 workflow tabs, only meaningful when
    // activeSection === 'workflow'.
    activeTab: 'project',
    navCollapsed: !!localStorage.getItem('dirigo_nav_collapsed')
  },
  bid: {
    project: {
      name: '', gc: '', bidDate: '', address: '', buildingType: '', drawingsRef: '',
      startDate: '', durationWeeks: '', floors: '',
      // Matches the original 5 pill labels exactly (index.html's
      // data-scope values) — "on" by default for the first two, same as
      // the original static markup (class="pill on").
      scope: ['Metal framing', 'Drywall'],
      exclusions: ''
    },
    conditions: {
      maxHt: '', sfAbove12: '', sfAbove20: '',
      curvedWalls: 'no', curvedWallsLF: '',
      exteriorExposure: 'no',
      phasedWork: 'no', phaseCount: '',
      accessDifficulty: 'normal', parking: 'yes',
      wastePct: '', trips: '', confidence: '', notes: ''
    },
    intelligence: {
      crewAvailability: '', pipelinePressure: '', materialTrend: '',
      gcRelationship: '', gcPriceSensitivity: '', competitionLevel: '',
      knownCompetitors: '', dirigoEdge: ''
    },
    rates: {
      framing: '', hanging: '', burdenPct: '', superPct: '',
      finish: { 1: '', 2: '', 3: '', 4: '', 5: '' },
      adder12Pct: '', adder20Pct: '',
      stud:  { '1-5/8"': '', '2-1/2"': '', '3-5/8"': '', '4"': '', '6"': '' },
      board: { 'Standard': '', 'Type-X': '', 'Moisture': '', 'Impact': '' },
      tape: '', insul: '', fasten: '', delivery: '', disposal: '', lift: ''
    },
    rateEscalation: {
      stud:  { '1-5/8"': '', '2-1/2"': '', '3-5/8"': '', '4"': '', '6"': '' },
      board: { 'Standard': '', 'Type-X': '', 'Moisture': '', 'Impact': '' },
      tape: '', insul: '', fasten: ''
    }
  }
};

// Sets a leaf value at a path array, e.g. ['bid','rates','stud','3-5/8"'].
// Path-array form rather than the plan's illustrative bracket-string
// syntax ('rates.stud["3-5/8"]') — same SET_FIELD concept, simpler to
// implement correctly without writing a string parser for a spike; noted
// in the spike report as a small refinement, not a deviation in intent.
function setPath(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  return { ...obj, [head]: setPath(obj[head] ?? {}, rest, value) };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return setPath(state, action.path, action.value);
    case 'LOAD_RATES':
      // Bridge target for js/forms.js's populateForm()/applyRateTemplate()
      // — see bridges.js. Replaces those functions' old direct DOM
      // set(id, val) writes for the Rates section, which would otherwise
      // fight React's controlled inputs (the value would flash in, then
      // be overwritten on next re-render since React never learned the
      // DOM changed out from under it).
      return {
        ...state,
        bid: {
          ...state.bid,
          rates: action.rates ?? state.bid.rates,
          rateEscalation: action.rateEscalation ?? state.bid.rateEscalation
        }
      };
    case 'LOAD_SECTION':
      // Generic version of LOAD_RATES above, for project/conditions/
      // intelligence — same bridge purpose (populateForm() dispatching
      // instead of writing DOM .value directly), one action instead of
      // three near-identical ones. undefined/null value is a no-op, not
      // a wipe — matches populateForm()'s own `state.X || {}` fallback
      // (a draft missing a whole section shouldn't blank out defaults).
      // Merged onto the *current* section, not replaced outright — a
      // real, reproduced crash, not a hypothetical: legacy-migration.
      // spec.js's pre-drafts dirigo_current_bid blob has a project
      // object with no `scope` key at all (predates that field), and a
      // wholesale replace left state.bid.project.scope undefined,
      // crashing ProjectPage's p.scope.includes(label) on the very next
      // render. A key present in action.value (even an empty array)
      // still wins; only a key *absent* from it falls back to whatever
      // was already there — the same "missing means leave it alone,
      // don't blank it" semantics populateForm()'s own
      // `if (Array.isArray(p.scope))` guard always had for this exact
      // field.
      if (action.value == null) return state;
      return {
        ...state,
        bid: { ...state.bid, [action.key]: { ...state.bid[action.key], ...action.value } }
      };
    case 'RESET_BID':
      // Bridge target for js/forms.js's resetFormFields() (window.
      // __resetBidState, see bridges.js) — the same controlled-input
      // hazard as every hydrate action above, caught by reproducing it
      // directly: fill #rate-frame, click New Bid, #rate-frame still
      // shows the old value, because resetFormFields()'s plain
      // el.value = '' writes get silently overwritten the next time
      // anything re-renders RatesPage (React re-asserts whatever
      // state.bid.rates.framing still holds, which resetFormFields()
      // never actually touched). One action resets every React-owned
      // bid section at once, matching resetFormFields()'s own framing —
      // it has never reset "just Rates" or "just Project," always all
      // of them together as one "back to a truly fresh page load" op.
      // Deep-cloned so the fresh state (esp. project.scope, an array)
      // isn't a shared reference future TOGGLE_SCOPE/SET_FIELD actions
      // could mutate across resets.
      return { ...state, bid: JSON.parse(JSON.stringify(initialState.bid)) };
    case 'TOGGLE_SCOPE': {
      const scope = state.bid.project.scope;
      const next = scope.includes(action.label)
        ? scope.filter((s) => s !== action.label)
        : [...scope, action.label];
      return { ...state, bid: { ...state.bid, project: { ...state.bid.project, scope: next } } };
    }
    case 'GOTO_TAB':
      return { ...state, ui: { ...state.ui, activeSection: 'workflow', activeTab: action.id } };
    case 'GOTO_SECTION':
      return { ...state, ui: { ...state.ui, activeSection: action.section } };
    case 'SET_NAV_COLLAPSED':
      return { ...state, ui: { ...state.ui, navCollapsed: action.value } };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const value = useReducer(reducer, initialState);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// Returns [state, dispatch], same shape as useReducer itself.
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore() called outside <StoreProvider>');
  return ctx;
}
