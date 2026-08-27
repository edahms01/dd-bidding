// ─────────────────────────────────────────────────────────────────────
// WallsPage.jsx — full React port of index.html's #page-walls (the
// former <template id="legacy-tpl-walls">). Same pattern proven on
// AssembliesPage.jsx: React owns which rows exist (state.bid.walls
// drives .map()), each row's own fields stay uncontrolled (defaultValue,
// matching collectFormData()'s original DOM-query-by-position read —
// no per-keystroke dispatch), rows keyed by a stable, never-reused
// _key (store.jsx's freshRowKey()) rather than array position or any
// value that resets per hydration — see CLAUDE.md's "Converting a
// page" checklist items 7–8 for the two hazard classes this avoids.
//
// Net SF is deliberately NOT stored state — collectFormData() (js/
// state.js) always recomputes it from grossSF/openings, exactly what
// this page's calcWall()-port below also does. The <span> showing it is
// a pure derived-display convenience, updated two ways: computed once
// at render time (fmtNet, for the initial/hydrated value) and then kept
// live via a ref-based oninput handler that ports calcWall() (js/
// forms.js) almost verbatim — not modeled as reducer state, since
// nothing else in the app needs to observe it live.
// ─────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { useStore } from '../state/store.jsx';

function fmtNet(g, d) {
  const gross = parseFloat(g) || 0;
  const ded   = parseFloat(d) || 0;
  return gross > 0 ? Math.max(0, gross - ded).toLocaleString() : '—';
}

function WallRow({ row, index, dispatch }) {
  const gsfRef = useRef(null);
  const dedRef = useRef(null);
  const netRef = useRef(null);

  // Ports calcWall() (js/forms.js) — same DOM-ref-based approach as
  // AssembliesPage's updateAsmId() port, reached via React's onInput
  // instead of an inline oninput="" attribute.
  function recalc() {
    const g = parseFloat(gsfRef.current?.value) || 0;
    const d = parseFloat(dedRef.current?.value) || 0;
    if (netRef.current) netRef.current.textContent = g > 0 ? Math.max(0, g - d).toLocaleString() : '—';
  }

  return (
    <tr>
      <td><input type="text" defaultValue={row.location} placeholder="Floor 3 / North" /></td>
      <td><input type="text" defaultValue={row.typeId} placeholder="W1" /></td>
      <td><input type="number" min="0" defaultValue={row.height} placeholder="10" /></td>
      <td><input type="number" min="0" defaultValue={row.lf} placeholder="0" className="wlf" /></td>
      <td><input ref={gsfRef} type="number" min="0" defaultValue={row.grossSF} placeholder="0" className="wgsf" onInput={recalc} /></td>
      <td><input ref={dedRef} type="number" min="0" defaultValue={row.openings} placeholder="0" className="wded" onInput={recalc} /></td>
      <td><span ref={netRef} className="calc-cell wnet">{fmtNet(row.grossSF, row.openings)}</span></td>
      <td><button className="del-btn" onClick={() => dispatch({ type: 'DELETE_ROW', section: 'walls', index })}>×</button></td>
    </tr>
  );
}

export default function WallsPage({ active }) {
  const [state, dispatch] = useStore();
  const rows = state.bid.walls;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-walls">
      <div className="page-hdr">
        <div><div className="page-title">Wall quantities</div><div className="page-sub">One row per floor or zone. Net SF calculates automatically.</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('assemblies')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('ceilings')}>Next: Ceilings →</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col style={{ width: 150 }} /><col style={{ width: 64 }} /><col style={{ width: 78 }} />
            <col style={{ width: 82 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 72 }} /><col style={{ width: 36 }} />
          </colgroup>
          <thead><tr>
            <th>Location</th><th>Type ID</th><th>Height (ft)</th>
            <th>LF framing</th><th>Gross SF board</th><th>Openings (SF)</th><th>Net SF</th><th></th>
          </tr></thead>
          <tbody id="wall-body">
            {rows.map((row, i) => <WallRow key={row._key} row={row} index={i} dispatch={dispatch} />)}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => dispatch({ type: 'ADD_WALL_ROW' })}>+ Add wall area</button>
    </div>
  );
}
