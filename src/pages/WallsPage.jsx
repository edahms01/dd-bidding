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
// 3.1: every field's <input> now carries a stable className
// (wall-location/wall-typeid/wall-height, plus the pre-existing .wlf/
// .wgsf/.wded) — js/state.js's collectFormData() reads this row by
// class now, not by NodeList position, so this page's own column order
// no longer has to match that function's index math field-for-field.
// Type ID is the one deliberately controlled field in this row —
// TypeIdSelect.jsx, dispatching SET_ROW_FIELD — everything else stays
// uncontrolled. See src/state/validation.js for the orphan-reference
// rule the inline warning below uses.
//
// 3.4: page-level `derived` state (openings > gross, zero-height, blank)
// — same root-ref + onInput-delegation pattern as RatesPage.jsx's own
// recomputeTotals(), not a new mechanism. One pass, computed from the
// live DOM (matching collectFormData()'s own read), covers all three
// guardrails; the same pass will feed 3.5's column totals later (Step
// 6) rather than building a second, competing read of the same rows.
// Read-only display — never touches calcWall()/collectFormData()'s
// existing clamp-at-zero math (explicit, deliberate constraint, see
// docs/dirigo-ux-decisions.md §3.4).
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.jsx';
import TypeIdSelect from '../components/TypeIdSelect.jsx';
import { isOrphanTypeId } from '../state/validation.js';

function fmtNet(g, d) {
  const gross = parseFloat(g) || 0;
  const ded   = parseFloat(d) || 0;
  return gross > 0 ? Math.max(0, gross - ded).toLocaleString() : '—';
}

function WallRow({ row, index, dispatch, assemblies, derived }) {
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

  const orphan = isOrphanTypeId(row.typeId, assemblies);

  return (
    <tr className={derived?.isBlank ? 'row-blank' : ''}>
      <td><input type="text" className="wall-location" defaultValue={row.location} placeholder="Floor 3 / North" /></td>
      <td>
        <TypeIdSelect
          className="wall-typeid"
          assemblies={assemblies}
          value={row.typeId}
          onChange={(value) => dispatch({ type: 'SET_ROW_FIELD', section: 'walls', index, field: 'typeId', value })}
        />
        {orphan && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>
            ⚠ Assembly "{row.typeId}" not found
          </div>
        )}
      </td>
      <td>
        <input type="number" min="0" className="wall-height" defaultValue={row.height} placeholder="10" />
        {derived?.zeroHeight && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ Height is 0</div>
        )}
      </td>
      <td><input type="number" min="0" defaultValue={row.lf} placeholder="0" className="wlf" /></td>
      <td><input ref={gsfRef} type="number" min="0" defaultValue={row.grossSF} placeholder="0" className="wgsf" onInput={recalc} /></td>
      <td>
        <input ref={dedRef} type="number" min="0" defaultValue={row.openings} placeholder="0" className="wded" onInput={recalc} />
        {derived?.openingsExceedGross && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ Exceeds gross SF</div>
        )}
      </td>
      <td><span ref={netRef} className="calc-cell wnet">{fmtNet(row.grossSF, row.openings)}</span></td>
      <td><button className="del-btn" onClick={() => dispatch({ type: 'DELETE_ROW', section: 'walls', index })}>×</button></td>
    </tr>
  );
}

export default function WallsPage({ active }) {
  const [state, dispatch] = useStore();
  const rows = state.bid.walls;
  const assemblies = state.bid.assemblies;
  const rootRef = useRef(null);
  const [derived, setDerived] = useState([]);

  // 3.4 — one page-level pass over the live DOM (same class-based fields
  // 3.1's collectFormData() rewrite introduced), read-only, never fed
  // back into calcWall()'s own math.
  const computeDerived = useCallback(() => {
    if (!rootRef.current) return [];
    return Array.from(rootRef.current.querySelectorAll('#wall-body tr')).map((tr) => {
      const location = tr.querySelector('.wall-location')?.value || '';
      const typeId   = tr.querySelector('.wall-typeid')?.value || '';
      const height   = parseFloat(tr.querySelector('.wall-height')?.value) || 0;
      const lf       = parseFloat(tr.querySelector('.wlf')?.value) || 0;
      const gross    = parseFloat(tr.querySelector('.wgsf')?.value) || 0;
      const openings = parseFloat(tr.querySelector('.wded')?.value) || 0;
      const isBlank = !location && !typeId && !height && !lf && !gross && !openings;
      return {
        isBlank,
        // Zero-height is only worth flagging on a row that otherwise has
        // real data — a blank row already gets its own (different)
        // treatment below, no need to double-flag it.
        zeroHeight: !isBlank && height === 0,
        openingsExceedGross: gross > 0 && openings > gross,
        lf, gross, openings
      };
    });
  }, []);

  // Recompute on every keystroke (delegated onInput below, same pattern
  // as RatesPage.jsx's recomputeTotals) and whenever rows are hydrated/
  // added/deleted (state.bid.walls itself changes reference).
  useEffect(() => {
    setDerived(computeDerived());
  }, [rows, computeDerived]);

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-walls" ref={rootRef} onInput={() => setDerived(computeDerived())}>
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
            {rows.map((row, i) => <WallRow key={row._key} row={row} index={i} dispatch={dispatch} assemblies={assemblies} derived={derived[i]} />)}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => dispatch({ type: 'ADD_WALL_ROW' })}>+ Add wall area</button>
    </div>
  );
}
