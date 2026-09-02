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

// ── Row identity, for Assemblies (and later Walls/Ceilings) ──────────
// React's `key` prop for a row MUST be stable per row *instance*, never
// per row *position* — a real, reproduced bug, not a theoretical one:
// with an uncontrolled <input defaultValue={row.notes}>, React only
// applies defaultValue on first mount, never again. Delete the middle
// row of three with position-based keys (0,1,2 -> 0,1) and React
// reconciles by *reusing* the old key=1 DOM node for the new key=1 data
// (what used to be row 2) rather than unmounting it — the uncontrolled
// input keeps showing row 1's stale typed values, silently wrong.
// _nextRowKey is a plain module-level counter, deliberately outside the
// reducer's persisted state and never reset by RESET_BID/LOAD_*_ROWS
// (unlike _num below) — every row ever created in this session, across
// every draft switch and every "New Bid", gets a value nothing else in
// this session will ever reuse. Confirmed no <React.StrictMode> wrapper
// in main.jsx, so the reducer calling this (a technically-impure action)
// never double-fires from dev-mode double-invocation.
let _nextRowKey = 1;
function freshRowKey() { return _nextRowKey++; }

// Matches addAsm()'s exact template defaults (js/forms.js) — every
// <select> in that markup has no `selected` attribute, so the real
// default is each one's *first listed option*, not collectFormData()'s
// defensive `|| 3`-style fallbacks (those exist for missing/corrupt
// data, not what a freshly-added row actually contains). finishLevel's
// true default is 1 (first of five options), not 3 — checked against
// the literal template string, not assumed.
// `_num` feeds the id-prefix auto-generation side effect (see
// AssembliesPage.jsx's category onChange, porting updateAsmId()) and is
// intentionally reset to each row's 1-indexed position on every
// hydration (LOAD_ASSEMBLY_ROWS), exactly matching populateForm()'s
// original asmCount = 0; rows.forEach(() => addAsm()) behavior. `_key`
// is the separate, never-reset React key described above — the two
// numbers coincide for a freshly-added row but diverge after the first
// hydration or reset, on purpose.
// NOTE: src/state/stepStatus.js's ASM_DEFAULTS mirrors the non-id/
// non-bookkeeping fields below to decide whether an assembly row has
// been touched (the Assemblies step-completion indicator). If these
// defaults change, update ASM_DEFAULTS to match or that indicator goes
// subtly wrong.
function blankAssemblyRow(num) {
  return {
    id: 'W' + num, category: 'Wall', studSize: '1-5/8"', spacing: '16"',
    layers: 1, boardType: 'Standard', fireRating: 'None', acoustic: 'No',
    finishLevel: 1, notes: '', wastePctOverride: null,
    _num: num, _key: freshRowKey()
  };
}

// Matches addWall()'s/addCeil()'s exact template defaults (js/forms.js)
// — every field starts genuinely blank (placeholder text only, no
// default value), unlike Assemblies' selects. No _num/id-auto-generation
// concept here — Walls/Ceilings rows have no equivalent of Assemblies'
// category-linked Type ID field, just a plain, always-manually-typed
// typeId text input. netSF is deliberately NOT a stored field — it's
// purely derived (Math.max(0, grossSF - openings), exactly matching
// collectFormData()'s own computation) and rendered from grossSF/
// openings directly; see WallsPage.jsx's/CeilingsPage.jsx's calcWall()/
// calcCeil() ports for why it's a ref-driven DOM side effect, not state.
function blankWallRow() {
  return { location: '', typeId: '', height: '', lf: '', grossSF: '', openings: '', _key: freshRowKey() };
}
function blankCeilRow() {
  return { location: '', typeId: '', height: '', grossSF: '', soffitLF: '', openings: '', _key: freshRowKey() };
}

export const initialState = {
  ui: {
    // 'workflow' | 'bids' | 'biddecision' | 'summary' (Phase C: 'history'/
    // 'dashboard' collapsed into 'bids' in 2.5; 'biddecision' is 8.4's
    // standalone gate, reached only from the Bids list; 'summary' is
    // Phase D's read-only mobile rollup, reached only from the
    // mobile-only drawer item — see BidSummaryPage.jsx).
    activeSection: 'workflow',
    // which of the 8 workflow tabs, only meaningful when
    // activeSection === 'workflow'.
    activeTab: 'project',
    navCollapsed: !!localStorage.getItem('dirigo_nav_collapsed'),
    // Phase D — mobile off-canvas nav drawer. Distinct from navCollapsed
    // (the desktop 200px<->48px width toggle, which persists): this is
    // the below-768px slide-in drawer's open/closed state, ephemeral by
    // design — a phone session always starts with the drawer closed.
    navDrawerOpen: false,
    // Phase C 2.2 — the Rates L/M/X class-sum totals, published by
    // RatesPage.jsx's recomputeTotals() (the calc() port) so
    // stepStatus.js can read the same signal the Rates totals bar shows
    // without re-deriving "are the rates filled in" a second way.
    rateTotals: { l: 0, m: 0, x: 0 },
    // Phase C 2.4 / 2.5 — the Bids list toolbar's filter state. The
    // toolbar (HistoryToolbar.jsx, shown in the step-bar slot while
    // activeSection === 'bids' so the shell stays stable) writes here;
    // BidsPage.jsx reads it to filter both the list and the totals.
    // `status` is one of '' | 'Draft' | 'Submitted' | 'Won' | 'Lost'
    // (the unified list's derived status, Step 2.5). Not persisted.
    bidsFilters: { gc: '', status: '', from: '', to: '' },
    // Bridge target for js/ui.js's renderOutput() (window.__renderOutput,
    // see bridges.js) — the derived calculation result runCalculation()
    // computes (js/ui.js), not form input. null until the first
    // calculation; OutputPage.jsx renders the "complete rates and
    // calculate" empty state while it's null, matching the original
    // template's static placeholder exactly.
    output: null,
    // Bridge target for submitBid() (window.__setSubmitResult) — replaces
    // its old direct #output-bid.innerHTML writes for the post-finalize
    // success/failure confirmation panel. null | {status:'success', saved}
    // | {status:'error'}. Deliberately NOT cleared by RESET_BID — matches
    // resetFormFields()'s own documented behavior of leaving Tab 7/8
    // alone on a fresh draft, since goto('output') already unconditionally
    // recalculates (and this clears) on every visit to that tab.
    submitResult: null,
    // Shell-owned now (AppShell renders it, always mounted like every
    // other page — see FinalizeModal.jsx), reachable from both Tab 7
    // (OutputPage's "Try again") and Tab 8 (Agent's "Finalize bid →",
    // still classic-script markup until Agent converts) via the
    // window._showFinalizeModal bridge. `open` drives the same CSS
    // .open-class-toggle the original modal-overlay always used
    // (opacity/transform transitions keyed off that class) — the modal
    // stays mounted at all times, never conditionally rendered, or the
    // fade/slide-in transition would have nothing to animate from.
    // `selected` always resets to 'recommended' on open, matching
    // _showFinalizeModal()'s original unconditional _modalSelectRow(
    // recRow) call — never carries over from a previous open.
    finalizeModal: {
      open: false,
      options: [],
      selected: 'recommended',
      customAmount: '',
      isSubmitting: false,
      error: null
    },
    // Bridge target for js/ui.js's renderAgentTab()/_renderAgentResult()
    // (window.__renderAgentTab, see bridges.js) — mirrors the exact
    // three-way branch renderAgentTab() always had: cachedResult truthy
    // wins regardless of loading (the original's real behavior, not a
    // simplification — a stale cachedResult is shown even if a *new*
    // agent run is already in flight, since nothing clears it until
    // _resetAgentCache() runs on a draft switch); else loading; else the
    // empty state. selectedOption resets to 'recommended' every time
    // cachedResult is (re-)dispatched truthy — matches
    // _renderAgentResult()'s own unconditional `_selectedBidOption =
    // 'recommended'`, which used to fire on *every* cache-hit render,
    // i.e. every tab revisit, not just the first one. Card selection
    // does not persist across tab switches; the underlying result does.
    agent: {
      cachedResult: null,
      loading: false,
      historyUnavailable: false,
      selectedOption: 'recommended'
    },
    // 3.5 — Undo-on-delete's pending state: null | {section, index, row}.
    // Set by DELETE_ROW, consumed/cleared by UNDO_DELETE_ROW, and
    // explicitly cleared on every draft switch/reset (RESET_BID above,
    // and js/ui.js's _resetAgentCache() bridge) — unlike submitResult's
    // deliberately-preserved wrong-tab quirk, a pending undo surviving a
    // draft switch is actively data-corrupting, not cosmetic.
    rowUndo: null
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
    },
    // Matches _initApp()'s unconditional addAsm() call on every fresh
    // boot — a brand new app state always starts with exactly one blank
    // assembly row, "W1". asmCounter tracks the next id number to
    // allocate (mirrors js/forms.js's module-level asmCount, now
    // reducer-owned since AssembliesPage creates rows via dispatch, not
    // by calling addAsm() directly).
    assemblies: [blankAssemblyRow(1)],
    asmCounter: 1,
    // Matches _initApp()'s unconditional addWall()/addCeil() calls on
    // every fresh boot — a brand new app state always starts with one
    // blank row in each table.
    walls: [blankWallRow()],
    ceilings: [blankCeilRow()],
    // 3.3 — page-level "Enter by dimensions" / "Enter by area" toggle,
    // one per table, persists per draft (it's a plain state.bid key, so
    // it flows through collectFormData()/buildExportPayload()/
    // buildDraftRecord() the same way every other bid field already
    // does — no separate persistence path). RESET_BID picks this up for
    // free via its wholesale deep-clone of initialState.bid below.
    wallsMode: 'dimensions',
    ceilingsMode: 'dimensions',
    // Matches the original static markup's blank <input>s exactly —
    // contingencyPct gets pre-filled from confidence by runCalculation()
    // itself (js/ui.js's _currentConfidence()-driven logic), not here.
    markupInputs: { overheadPct: '', contingencyPct: '', profitPct: '' }
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

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ── Standing rule: every hydration action merges onto current/default
// state, recursively — never replaces a section wholesale. Not a
// one-off patch for one old file; this is the general shape any load-a-
// full-object-into-the-reducer action must have, permanently, because
// the schema is expected to keep growing (rates.finish/stud/board today,
// whatever assembly-extensibility work adds tomorrow) and *something*
// hydrating this reducer — a draft load, an import, a legacy migration,
// a rate template saved before a field existed — will keep lacking
// newer fields as it does. A wholesale `{...defaults, ...incoming}`
// (single-level) or `state.section = incoming` (no merge at all) both
// break the same way the day a field gets added: reproduced directly on
// LOAD_SECTION, not hypothesized — legacy-migration.spec.js's pre-drafts
// fixture has a project object with no `scope` key (predates that
// field), and a wholesale replace left project.scope undefined, crashing
// ProjectPage's `p.scope.includes(label)` on the very next render.
// mergeDeep() recurses into nested plain objects (rates.finish, .stud,
// .board, etc.) so a partially-populated nested object degrades
// gracefully too, not just a missing top-level key. Arrays (project.scope)
// replace wholesale, not element-wise — merging a list field-by-field
// wouldn't mean anything. A key *present* in `incoming` always wins, at
// any depth; a key *absent* from it falls back to whatever `base`
// (current state, or the reducer's own defaults) already has.
function mergeDeep(base, incoming) {
  if (!isPlainObject(base) || !isPlainObject(incoming)) return incoming;
  const out = { ...base };
  for (const key of Object.keys(incoming)) {
    out[key] = mergeDeep(base[key], incoming[key]);
  }
  return out;
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
      // DOM changed out from under it). mergeDeep(), not a wholesale
      // replace — see its comment above: a rate template saved before
      // Tier 5 Part 2 shipped has no rateEscalation field at all, and a
      // future rates/rateEscalation field added the same way would hit
      // the exact same gap in old templates.
      return {
        ...state,
        bid: {
          ...state.bid,
          rates: action.rates != null ? mergeDeep(state.bid.rates, action.rates) : state.bid.rates,
          rateEscalation: action.rateEscalation != null ? mergeDeep(state.bid.rateEscalation, action.rateEscalation) : state.bid.rateEscalation
        }
      };
    case 'LOAD_SECTION':
      // Generic version of LOAD_RATES above, for project/conditions/
      // intelligence — same bridge purpose (populateForm() dispatching
      // instead of writing DOM .value directly), one action instead of
      // three near-identical ones. undefined/null value is a no-op, not
      // a wipe — matches populateForm()'s own `state.X || {}` fallback
      // (a draft missing a whole section shouldn't blank out defaults).
      // mergeDeep(), not a wholesale replace — see its comment above.
      if (action.value == null) return state;
      return {
        ...state,
        bid: { ...state.bid, [action.key]: mergeDeep(state.bid[action.key], action.value) }
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
      // could mutate across resets. assemblies/walls/ceilings are NOT
      // part of that clone — each is rebuilt fresh via its blankXRow()
      // factory instead, so its React key is newly minted every reset
      // (see freshRowKey()'s comment above). Reusing initialState.bid's
      // frozen row keys here would mean every "New Bid" click after the
      // first produces a row with the *same* key as the previous draft's
      // first row — React would reuse that DOM node instead of
      // unmounting it, and the uncontrolled inputs inside it
      // (defaultValue only applies on first mount) would keep showing
      // the old draft's stale typed values despite the state correctly
      // reporting a blank row. Reproduced directly on Assemblies before
      // this was generalized — see CLAUDE.md checklist.
      // 3.5: also clears rowUndo — a pending undo referencing a row from
      // the *previous* draft is actively data-corrupting (could
      // resurrect that row into this fresh one), not a cosmetic
      // wrong-tab-style quirk, so unlike submitResult (deliberately left
      // alone above) this needs an explicit reset here too, not just at
      // _resetAgentCache()'s bridge (js/ui.js) — belt and suspenders,
      // since RESET_BID is reachable via more than one path.
      return {
        ...state,
        bid: {
          ...JSON.parse(JSON.stringify(initialState.bid)),
          assemblies: [blankAssemblyRow(1)],
          asmCounter: 1,
          walls: [blankWallRow()],
          ceilings: [blankCeilRow()]
        },
        ui: { ...state.ui, rowUndo: null }
      };
    case 'ADD_ASSEMBLY_ROW': {
      const num = state.bid.asmCounter + 1;
      return {
        ...state,
        bid: {
          ...state.bid,
          assemblies: [...state.bid.assemblies, blankAssemblyRow(num)],
          asmCounter: num
        }
      };
    }
    case 'ADD_WALL_ROW':
      return { ...state, bid: { ...state.bid, walls: [...state.bid.walls, blankWallRow()] } };
    case 'ADD_CEILING_ROW':
      return { ...state, bid: { ...state.bid, ceilings: [...state.bid.ceilings, blankCeilRow()] } };
    case 'SET_ROW_FIELD':
      // 3.1 — for the one row field that's controlled (Type ID, via
      // TypeIdSelect.jsx), since orphan detection needs real reducer
      // state to react across pages. NOT a general-purpose replacement
      // for every row field going uncontrolled-to-controlled — the rest
      // of each row stays deliberately uncontrolled (see WallsPage.jsx/
      // CeilingsPage.jsx/AssembliesPage.jsx). Deliberately NOT built on
      // setPath() above: setPath spreads on a numeric array index
      // ({...arr, [index]: val}), which silently turns the array into a
      // plain object — breaking every later .map()/.filter() on that
      // section. .map() with an index check keeps it a real array.
      return {
        ...state,
        bid: {
          ...state.bid,
          [action.section]: state.bid[action.section].map((r, i) =>
            i === action.index ? { ...r, [action.field]: action.value } : r)
        }
      };
    case 'DELETE_ROW': {
      // Generic across row-array sections — deletes by index, captured
      // at render time in each row's own delete-button closure, so it
      // always targets the row whose button was actually clicked
      // regardless of how the array has shifted since that row mounted.
      //
      // 3.5 — also stashes the removed row into state.ui.rowUndo for
      // Undo. action.values (captured live from the DOM at delete time,
      // via window.collectFormData() — see AssembliesPage.jsx/
      // WallsPage.jsx/CeilingsPage.jsx's handleDelete()) is merged over
      // rows[action.index], NOT used alone: every row field except Type
      // ID is deliberately uncontrolled (no per-keystroke dispatch), so
      // the reducer's own copy can be stale relative to what's actually
      // typed in the DOM right before delete — undo restoring the stale
      // reducer copy would silently discard a live edit the user never
      // dispatched. The merge keeps non-DOM-backed bookkeeping (_num,
      // _key) from the reducer copy while letting live values win for
      // everything collectFormData() actually reads.
      const rows = state.bid[action.section];
      const deletedSnapshot = action.values ? { ...rows[action.index], ...action.values } : rows[action.index];
      return {
        ...state,
        bid: {
          ...state.bid,
          [action.section]: rows.filter((_, i) => i !== action.index)
        },
        ui: { ...state.ui, rowUndo: { section: action.section, index: action.index, row: deletedSnapshot } }
      };
    }
    case 'UNDO_DELETE_ROW': {
      const u = state.ui.rowUndo;
      if (!u) return state;
      const rows = state.bid[u.section];
      // Fresh _key — same discipline as every other newly-inserted row
      // (freshRowKey()'s own comment: reusing a key risks React reusing
      // a stale uncontrolled-input DOM node instead of mounting a new
      // one). Restored at the same index it was removed from — a plain
      // splice-style insert, correct regardless of what else has
      // happened to the array since (e.g. a duplicate inserted after
      // it — see the duplicate-then-undo spec).
      const restored = { ...u.row, _key: freshRowKey() };
      const next = [...rows.slice(0, u.index), restored, ...rows.slice(u.index)];
      return {
        ...state,
        bid: { ...state.bid, [u.section]: next },
        ui: { ...state.ui, rowUndo: null }
      };
    }
    case 'DUPLICATE_ROW': {
      // action.values — same live-DOM-capture reasoning as DELETE_ROW
      // above, same reason: rows[action.index] alone can be stale.
      const rows = state.bid[action.section];
      const src = action.values ? { ...rows[action.index], ...action.values } : rows[action.index];
      let copy;
      if (action.section === 'assemblies') {
        // Copying `id` verbatim would collide in calculator.js's asmMap
        // (Object.fromEntries keeps only the last of any duplicate id,
        // silently shadowing the original) — mint a fresh id instead,
        // same prefix convention as AssembliesPage.jsx's own
        // updateAsmId() (Wall -> 'W', anything else -> 'C').
        const num = state.bid.asmCounter + 1;
        const prefix = src.category === 'Ceiling' ? 'C' : 'W';
        copy = { ...src, id: prefix + num, _num: num, _key: freshRowKey() };
        const next = [...rows.slice(0, action.index + 1), copy, ...rows.slice(action.index + 1)];
        return { ...state, bid: { ...state.bid, assemblies: next, asmCounter: num } };
      }
      // Walls/ceilings: sharing a typeId across rows is normal (two
      // zones of the same assembly type), no rename needed.
      copy = { ...src, _key: freshRowKey() };
      const next = [...rows.slice(0, action.index + 1), copy, ...rows.slice(action.index + 1)];
      return { ...state, bid: { ...state.bid, [action.section]: next } };
    }
    case 'LOAD_ASSEMBLY_ROWS': {
      // Bridge target for js/forms.js's populateForm() (window.
      // __hydrateAssemblies, see bridges.js) — replaces the old
      // asmBody.innerHTML=''; asmCount=0; rows.forEach(() => addAsm())
      // DOM-rebuild. Every loaded row gets BOTH a freshly-reset _num
      // (1-indexed position, matching populateForm()'s original
      // behavior — see blankAssemblyRow()'s comment) AND a brand new
      // _key (freshRowKey(), never reused — see its comment above:
      // reusing a key across a draft switch would let React silently
      // carry the previous draft's stale uncontrolled-input values into
      // the newly loaded row's DOM node).
      const rows = (action.rows || []).map((asm, i) => ({
        id: asm.id || '', category: asm.category || 'Wall', studSize: asm.studSize || '3-5/8"',
        spacing: asm.spacing || '16"', layers: asm.layers ?? 1, boardType: asm.boardType || 'Standard',
        fireRating: asm.fireRating || 'None', acoustic: asm.acoustic || 'No', finishLevel: asm.finishLevel ?? 3,
        notes: asm.notes || '', wastePctOverride: asm.wastePctOverride ?? null,
        _num: i + 1, _key: freshRowKey()
      }));
      return { ...state, bid: { ...state.bid, assemblies: rows, asmCounter: rows.length } };
    }
    case 'LOAD_WALL_ROWS': {
      // Bridge target for populateForm()'s Walls section (window.
      // __hydrateWalls). Same shape as LOAD_ASSEMBLY_ROWS — no _num
      // here (Walls has no id-auto-generation concept), just a fresh
      // _key per row.
      const rows = (action.rows || []).map((w) => ({
        location: w.location != null ? w.location : '', typeId: w.typeId != null ? w.typeId : '',
        height: w.height != null ? w.height : '', lf: w.lf != null ? w.lf : '',
        grossSF: w.grossSF != null ? w.grossSF : '', openings: w.openings != null ? w.openings : '',
        _key: freshRowKey()
      }));
      // 3.3 — action.mode is undefined for any pre-3.3 draft/import that
      // never carried this field; falls back to the schema default
      // ('dimensions'), NOT state.bid.wallsMode (the currently-active
      // session's mode) — this is a wholesale hydration, same as the
      // rows themselves, not a merge, so a switched-to draft that never
      // set a mode shouldn't silently inherit whatever mode happened to
      // be active in the browser from a *different* draft.
      return { ...state, bid: { ...state.bid, walls: rows, wallsMode: action.mode ?? 'dimensions' } };
    }
    case 'LOAD_CEILING_ROWS': {
      // Bridge target for populateForm()'s Ceilings section (window.
      // __hydrateCeilings). Same shape as LOAD_WALL_ROWS.
      const rows = (action.rows || []).map((c) => ({
        location: c.location != null ? c.location : '', typeId: c.typeId != null ? c.typeId : '',
        height: c.height != null ? c.height : '', grossSF: c.grossSF != null ? c.grossSF : '',
        soffitLF: c.soffitLF != null ? c.soffitLF : '', openings: c.openings != null ? c.openings : '',
        _key: freshRowKey()
      }));
      // 3.3 — see LOAD_WALL_ROWS's comment above, same reasoning.
      return { ...state, bid: { ...state.bid, ceilings: rows, ceilingsMode: action.mode ?? 'dimensions' } };
    }
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
    case 'SET_NAV_DRAWER':
      // Phase D — mobile drawer open/closed. Not persisted (see initialState).
      return { ...state, ui: { ...state.ui, navDrawerOpen: action.value } };
    case 'SET_BIDS_FILTER':
      // Phase C 2.4/2.5 — one field of the Bids list toolbar's filter.
      return { ...state, ui: { ...state.ui, bidsFilters: { ...state.ui.bidsFilters, [action.key]: action.value } } };
    case 'CLEAR_BIDS_FILTERS':
      return { ...state, ui: { ...state.ui, bidsFilters: { gc: '', status: '', from: '', to: '' } } };
    case 'SET_RATE_TOTALS':
      // Phase C 2.2 — RatesPage.jsx publishes its L/M/X class-sum here so
      // stepStatus.js reads one source of truth. No-op if unchanged so a
      // per-keystroke recompute that lands on the same numbers doesn't
      // spin an extra render.
      {
        const cur = state.ui.rateTotals;
        const nx = action.totals;
        if (cur.l === nx.l && cur.m === nx.m && cur.x === nx.x) return state;
        return { ...state, ui: { ...state.ui, rateTotals: nx } };
      }
    case 'RENDER_OUTPUT':
      // Bridge target for js/ui.js's runCalculation() (window.
      // __renderOutput, see bridges.js) — replaces renderOutput()'s old
      // direct #output-phase3/#output-bid.innerHTML writes. Clearing
      // submitResult here matches the original's implicit behavior: any
      // fresh calculation (a Recalculate click, a tab visit, the
      // success panel's own "Back to output" button) overwrote
      // #output-bid with the normal breakdown, erasing whatever
      // success/failure panel was showing — not something to preserve
      // as a *feature*, just the exact current behavior, bug (the
      // wrong-tab one) included.
      return { ...state, ui: { ...state.ui, output: action.output, submitResult: null } };
    case 'SET_SUBMIT_RESULT':
      // Bridge target for submitBid() (window.__setSubmitResult) —
      // replaces its old direct #output-bid.innerHTML writes for the
      // post-finalize success/failure panel.
      return { ...state, ui: { ...state.ui, submitResult: action.result } };
    case 'OPEN_FINALIZE_MODAL':
      // Bridge target for window._showFinalizeModal(options) — replaces
      // _showFinalizeModal()'s old body.innerHTML rebuild + _initFinalizeModal
      // ()'s lazy-create. Always resets selected/customAmount/isSubmitting/
      // error, matching the original's unconditional _modalSelectRow(recRow)
      // call on every open — never carries stale state from a previous open.
      return {
        ...state,
        ui: {
          ...state.ui,
          finalizeModal: {
            open: true, options: action.options || [], selected: 'recommended',
            customAmount: '', isSubmitting: false, error: null
          }
        }
      };
    case 'CLOSE_FINALIZE_MODAL':
      // Bridge target for window._closeFinalizeModal() — replaces the
      // original's el.classList.remove('open'). Still needed as a real
      // bridge (not just dispatched directly from FinalizeModal.jsx)
      // because the Escape-key listener (js/ui.js) calls it as a bare
      // classic-script identifier reference, same mechanism window.goto
      // already relies on for its own shadowing.
      return { ...state, ui: { ...state.ui, finalizeModal: { ...state.ui.finalizeModal, open: false } } };
    case 'SELECT_FINALIZE_OPTION':
      // Replaces _modalSelectRow()'s DOM class/checked/disabled writes —
      // FinalizeModal.jsx derives all of that from `selected` at render
      // time instead (className, radio `checked`, confirm-button
      // `disabled`, the custom-amount wrap's visibility).
      return { ...state, ui: { ...state.ui, finalizeModal: { ...state.ui.finalizeModal, selected: action.option } } };
    case 'SET_FINALIZE_CUSTOM_AMOUNT':
      return { ...state, ui: { ...state.ui, finalizeModal: { ...state.ui.finalizeModal, customAmount: action.value } } };
    case 'SET_FINALIZE_SUBMITTING':
      // Replaces _finalizeBid()'s confirmBtn.disabled = true/false direct
      // writes — the double-submit guard. Dispatched synchronously, before
      // any await, same as the original — see FinalizeModal.jsx's
      // handleConfirm() and CLAUDE.md's checklist for the timing
      // verification (no flushSync needed here: a synchronous dispatch
      // inside a click handler, before its first await, commits before
      // the browser's next paint under React 18's batching, the same
      // guarantee the original direct write relied on).
      return { ...state, ui: { ...state.ui, finalizeModal: { ...state.ui.finalizeModal, isSubmitting: action.value } } };
    case 'SET_FINALIZE_ERROR':
      return { ...state, ui: { ...state.ui, finalizeModal: { ...state.ui.finalizeModal, error: action.error } } };
    case 'RENDER_AGENT_TAB':
      // Bridge target for js/ui.js's renderAgentTab()/_renderAgentResult()
      // — see the comment on initialState.ui.agent above for the full
      // reasoning. Dispatched on every call (every tab revisit, every
      // _launchBidAgent() step, runAgentIfNeeded()'s background pre-run),
      // not just once — that repetition is what makes the selectedOption
      // reset happen on every revisit, matching the original exactly.
      return {
        ...state,
        ui: {
          ...state.ui,
          agent: {
            cachedResult: action.cachedResult,
            loading: action.loading,
            historyUnavailable: action.historyUnavailable,
            selectedOption: action.cachedResult ? 'recommended' : state.ui.agent.selectedOption
          }
        }
      };
    case 'SELECT_AGENT_OPTION':
      // Replaces _selectBidOption()'s direct DOM style writes on
      // [data-bid-opt] cards — AgentPage.jsx derives each card's
      // selected styling from this at render time instead. Only the
      // first of _selectBidOption()'s three DOM-manipulation blocks
      // (the cards themselves) ever did anything — the other two
      // referenced elements (input[name="agent-bid-option"],
      // #finalize-row-*) that don't exist anywhere in current markup;
      // not reproduced here, since faithfully porting dead code isn't
      // faithful to anything real. See CLAUDE.md.
      return { ...state, ui: { ...state.ui, agent: { ...state.ui.agent, selectedOption: action.option } } };
    case 'RESET_AGENT_CACHE':
      // Bridge target for js/ui.js's _resetAgentCache() (window.
      // __resetAgentCache) — called on every draft switch (_flushAndSwitch
      // ()) and every blank-draft activation (_createAndActivateBlankDraft
      // ()), so Tab 8's cache can't leak between drafts (see
      // draft-switch-no-contamination.spec.js). Mirrors _resetAgentCache()'s
      // own reset of _agentResult/_lastAgentResult/_agentLoading/
      // _agentHistoryUnavailable exactly.
      return {
        ...state,
        ui: { ...state.ui, agent: { cachedResult: null, loading: false, historyUnavailable: false, selectedOption: 'recommended' } }
      };
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
