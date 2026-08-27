// ─────────────────────────────────────────────────────────────────────
// AssembliesPage.jsx — full React port of index.html's #page-assemblies
// (the former <template id="legacy-tpl-assemblies">).
//
// Different pattern from Project/Conditions/Rates: those pages' inputs
// are React-controlled (value + onChange dispatching SET_FIELD) because
// there's a fixed, known set of fields. This page's rows are a variable-
// length list the user adds/deletes — React owns *that* (state.bid.
// assemblies drives which <tr>s exist, via .map()), but each row's own
// fields are deliberately left UNCONTROLLED (defaultValue, not value) —
// matching collectFormData()'s original DOM-query-by-position read
// exactly, and avoiding the need to dispatch on every keystroke for
// fields nothing else in the app needs to react to live.
//
// Two hazards this shape specifically requires getting right — verified
// directly during this page's build, not assumed (see the build report
// for the empirical checks):
//   1. React key MUST be a stable per-row identity, never array
//      position. With uncontrolled inputs, defaultValue only applies on
//      first mount — if the key is index-based, deleting a middle row
//      shifts every row after it into a *reused* DOM node (same key,
//      new data), and that node's uncontrolled inputs keep showing the
//      PREVIOUS occupant's stale typed values instead of the new row's.
//      See store.jsx's freshRowKey()/_key for the fix: a plain,
//      never-reset, session-wide counter, separate from _num (which
//      DOES reset per hydration, for the id-auto-generation logic
//      below, and would cause the exact same bug if reused as the key).
//   2. Structural hydration (populateForm() loading a draft/seed) can't
//      use the scalar pages' "plain DOM write + dispatch" pattern —
//      manually rebuilding #asm-body's children from classic-script
//      code would fight React's own ownership of that same list. See
//      bridges.js's window.__hydrateAssemblies: it uses flushSync to
//      force the dispatch's DOM update to happen synchronously, so a
//      caller reading collectFormData() immediately after (loadSeedData
//      ()'s runCalculation() call, the same shape that caused Tab 7's
//      "$0" flash for Rates — see CLAUDE.md checklist item 4) sees the
//      freshly-hydrated rows, not stale ones.
// ─────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { useStore } from '../state/store.jsx';

const CATEGORY_OPTS    = ['Wall', 'Ceiling'];
const STUD_SIZE_OPTS   = ['1-5/8"', '2-1/2"', '3-5/8"', '4"', '6"'];
const SPACING_OPTS     = ['16"', '24"', '12"'];
const LAYERS_OPTS      = [1, 2, 3];
const BOARD_TYPE_OPTS  = ['Standard', 'Type-X', 'Moisture', 'Impact'];
const FIRE_RATING_OPTS = ['None', '1-hr', '2-hr'];
const ACOUSTIC_OPTS    = ['No', 'Yes'];
const FINISH_LEVEL_OPTS = [1, 2, 3, 4, 5];

function AssemblyRow({ row, index, dispatch }) {
  const idRef = useRef(null);

  // Ports updateAsmId() (js/forms.js) almost verbatim — same DOM-ref-
  // based approach, just reached via React's onChange instead of an
  // inline onchange="" attribute. Deliberately NOT modeled as reducer
  // state: this is a pure same-row DOM side effect (auto-fill the ID
  // unless the user has already customized it), never read by
  // collectFormData() as anything other than whatever ends up in the
  // #asm-id input's live .value — no reason to route it through
  // dispatch/re-render for every category change.
  function handleCategoryChange(e) {
    const idInput = idRef.current;
    if (!idInput) return;
    const prefix  = e.target.value === 'Ceiling' ? 'C' : 'W';
    const newAuto = prefix + row._num;
    if (idInput.value === idInput.dataset.auto) idInput.value = newAuto;
    idInput.dataset.auto = newAuto;
  }

  return (
    <tr>
      <td><input ref={idRef} type="text" defaultValue={row.id} data-auto={row.id} className="asm-id" /></td>
      <td>
        <select defaultValue={row.category} onChange={handleCategoryChange}>
          {CATEGORY_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.studSize}>
          {STUD_SIZE_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.spacing}>
          {SPACING_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.layers}>
          {LAYERS_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.boardType}>
          {BOARD_TYPE_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.fireRating}>
          {FIRE_RATING_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.acoustic}>
          {ACOUSTIC_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select defaultValue={row.finishLevel}>
          {FINISH_LEVEL_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td><input type="text" defaultValue={row.notes} placeholder="notes" /></td>
      <td><input type="number" min="0" className="asm-waste" placeholder="def." defaultValue={row.wastePctOverride ?? ''} /></td>
      <td><button className="del-btn" onClick={() => dispatch({ type: 'DELETE_ROW', section: 'assemblies', index })}>×</button></td>
    </tr>
  );
}

export default function AssembliesPage({ active }) {
  const [state, dispatch] = useStore();
  const rows = state.bid.assemblies;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-assemblies">
      <div className="page-hdr">
        <div><div className="page-title">Assembly types</div><div className="page-sub">Define each wall and ceiling system. Each type ID is referenced in walls and ceilings.</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('rates')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('walls')}>Next: Walls →</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col style={{ width: 60 }} /><col style={{ width: 84 }} /><col style={{ width: 82 }} />
            <col style={{ width: 68 }} /><col style={{ width: 60 }} /><col style={{ width: 108 }} />
            <col style={{ width: 74 }} /><col style={{ width: 62 }} /><col style={{ width: 60 }} />
            <col /><col style={{ width: 62 }} /><col style={{ width: 36 }} />
          </colgroup>
          <thead><tr>
            <th>Type ID</th><th>Category</th><th>Stud size</th><th>Spacing</th>
            <th>Board layers</th><th>Board type</th><th>Fire rating</th>
            <th>Acoustic</th><th>Finish level</th><th>Notes</th><th>Waste %</th><th></th>
          </tr></thead>
          <tbody id="asm-body">
            {rows.map((row, i) => <AssemblyRow key={row._key} row={row} index={i} dispatch={dispatch} />)}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => dispatch({ type: 'ADD_ASSEMBLY_ROW' })}>+ Add assembly type</button>
    </div>
  );
}
