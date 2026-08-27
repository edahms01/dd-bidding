// ─────────────────────────────────────────────────────────────────────
// store.jsx — A2 spike: the one reducer/context AppShell owns.
//
// Scoped intentionally: this spike converts Rates + History only, so the
// `bid` slice here holds just what RatesPage actually reads/writes
// (rates, rateEscalation). It is NOT yet the full state shape from the
// approved plan (project/assemblies/walls/ceilings/conditions/etc.) —
// that shape is the target once every page has converted, built out
// incrementally as each remaining page migrates in the full-migration
// step. Until then, every other field still lives in the DOM on its
// LegacyPage, read via the existing collectFormData()/populateForm().
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
