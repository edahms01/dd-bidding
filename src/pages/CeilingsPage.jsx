// ─────────────────────────────────────────────────────────────────────
// CeilingsPage.jsx — full React port of index.html's #page-ceilings
// (the former <template id="legacy-tpl-ceilings">). Same pattern as
// WallsPage.jsx/AssembliesPage.jsx — see WallsPage.jsx's header comment
// for the full reasoning (row identity, uncontrolled fields, derived
// Net SF). Soffit LF (the 5th column) has no calc side effect at all in
// the original markup — no class, no oninput — so it's a plain
// uncontrolled input here too, nothing special.
// ─────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { useStore } from '../state/store.jsx';

function fmtNet(g, d) {
  const gross = parseFloat(g) || 0;
  const ded   = parseFloat(d) || 0;
  return gross > 0 ? Math.max(0, gross - ded).toLocaleString() : '—';
}

function CeilRow({ row, index, dispatch }) {
  const gsfRef = useRef(null);
  const dedRef = useRef(null);
  const netRef = useRef(null);

  // Ports calcCeil() (js/forms.js).
  function recalc() {
    const g = parseFloat(gsfRef.current?.value) || 0;
    const d = parseFloat(dedRef.current?.value) || 0;
    if (netRef.current) netRef.current.textContent = g > 0 ? Math.max(0, g - d).toLocaleString() : '—';
  }

  return (
    <tr>
      <td><input type="text" defaultValue={row.location} placeholder="Floor 3 / Lobby" /></td>
      <td><input type="text" defaultValue={row.typeId} placeholder="C1" /></td>
      <td><input type="number" min="0" defaultValue={row.height} placeholder="12" /></td>
      <td><input ref={gsfRef} type="number" min="0" defaultValue={row.grossSF} placeholder="0" className="cgsf" onInput={recalc} /></td>
      <td><input type="number" min="0" defaultValue={row.soffitLF} placeholder="0" /></td>
      <td><input ref={dedRef} type="number" min="0" defaultValue={row.openings} placeholder="0" className="cded" onInput={recalc} /></td>
      <td><span ref={netRef} className="calc-cell cnet">{fmtNet(row.grossSF, row.openings)}</span></td>
      <td><button className="del-btn" onClick={() => dispatch({ type: 'DELETE_ROW', section: 'ceilings', index })}>×</button></td>
    </tr>
  );
}

export default function CeilingsPage({ active }) {
  const [state, dispatch] = useStore();
  const rows = state.bid.ceilings;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-ceilings">
      <div className="page-hdr">
        <div><div className="page-title">Ceiling + soffit quantities</div><div className="page-sub">One row per area. Net SF calculates automatically.</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('walls')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('output')}>Generate bid output →</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col style={{ width: 150 }} /><col style={{ width: 64 }} /><col style={{ width: 78 }} />
            <col style={{ width: 88 }} /><col style={{ width: 88 }} /><col style={{ width: 92 }} />
            <col style={{ width: 72 }} /><col style={{ width: 36 }} />
          </colgroup>
          <thead><tr>
            <th>Location</th><th>Type ID</th><th>Height (ft)</th>
            <th>SF ceiling</th><th>Soffit LF</th><th>Openings (SF)</th><th>Net SF</th><th></th>
          </tr></thead>
          <tbody id="ceil-body">
            {rows.map((row, i) => <CeilRow key={row._key} row={row} index={i} dispatch={dispatch} />)}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => dispatch({ type: 'ADD_CEILING_ROW' })}>+ Add ceiling area</button>
    </div>
  );
}
