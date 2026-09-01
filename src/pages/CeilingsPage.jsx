// ─────────────────────────────────────────────────────────────────────
// CeilingsPage.jsx — full React port of index.html's #page-ceilings
// (the former <template id="legacy-tpl-ceilings">). Same pattern as
// WallsPage.jsx/AssembliesPage.jsx — see WallsPage.jsx's header comment
// for the full reasoning (row identity, uncontrolled fields, derived
// Net SF, the 3.1 class-based collectFormData() rewrite and Type ID
// dropdown, the 3.4 page-level derived-guardrail pass, and 3.3's
// dimensions/area mode toggle — Height is the only column that hides;
// calculateCeilingCosts() uses SF-based framing, not an LF concept at
// all for ceilings, so there's no Walls-style "LF empty" addendum here).
// Soffit LF (the 5th column) has no calc side effect at all in the
// original markup — no oninput — so it's a plain uncontrolled input
// here too, nothing special beyond the new stable className.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.jsx';
import TypeIdSelect from '../components/TypeIdSelect.jsx';
import { isOrphanTypeId } from '../state/validation.js';
import { registerCeilingsModeReader } from '../state/bridges.js';

function fmtNet(g, d) {
  const gross = parseFloat(g) || 0;
  const ded   = parseFloat(d) || 0;
  return gross > 0 ? Math.max(0, gross - ded).toLocaleString() : '—';
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle">
      <button type="button" className={'mode-toggle-btn' + (mode === 'dimensions' ? ' on' : '')} onClick={() => onChange('dimensions')}>
        Enter by dimensions
      </button>
      <button type="button" className={'mode-toggle-btn' + (mode === 'area' ? ' on' : '')} onClick={() => onChange('area')}>
        Enter by area
      </button>
    </div>
  );
}

function CeilRow({ row, index, dispatch, assemblies, derived, mode }) {
  const gsfRef = useRef(null);
  const dedRef = useRef(null);
  const netRef = useRef(null);
  const heightHidden = mode === 'area';

  // Ports calcCeil() (js/forms.js).
  function recalc() {
    const g = parseFloat(gsfRef.current?.value) || 0;
    const d = parseFloat(dedRef.current?.value) || 0;
    if (netRef.current) netRef.current.textContent = g > 0 ? Math.max(0, g - d).toLocaleString() : '—';
  }

  const orphan = isOrphanTypeId(row.typeId, assemblies);

  return (
    <tr className={derived?.isBlank ? 'row-blank' : ''}>
      <td><input type="text" className="ceil-location" defaultValue={row.location} placeholder="Floor 3 / Lobby" /></td>
      <td>
        <TypeIdSelect
          className="ceil-typeid"
          assemblies={assemblies}
          value={row.typeId}
          onChange={(value) => dispatch({ type: 'SET_ROW_FIELD', section: 'ceilings', index, field: 'typeId', value })}
        />
        {orphan && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>
            ⚠ Assembly "{row.typeId}" not found
          </div>
        )}
      </td>
      <td style={heightHidden ? { display: 'none' } : undefined}>
        <input type="number" min="0" className="ceil-height" defaultValue={row.height} placeholder="12" />
        {derived?.zeroHeight && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ Height is 0</div>
        )}
      </td>
      <td><input ref={gsfRef} type="number" min="0" defaultValue={row.grossSF} placeholder="0" className="cgsf" onInput={recalc} /></td>
      <td><input type="number" min="0" className="ceil-soffitlf" defaultValue={row.soffitLF} placeholder="0" /></td>
      <td>
        <input ref={dedRef} type="number" min="0" defaultValue={row.openings} placeholder="0" className="cded" onInput={recalc} />
        {derived?.openingsExceedGross && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ Exceeds gross SF</div>
        )}
      </td>
      <td><span ref={netRef} className="calc-cell cnet">{fmtNet(row.grossSF, row.openings)}</span></td>
      <td className="row-actions">
        {/* 3.5 — live-captured via window.collectFormData(), same
            reasoning as WallsPage.jsx/AssembliesPage.jsx. */}
        <button className="dup-btn" title="Duplicate" onClick={() => {
          const live = window.collectFormData?.()?.ceilings?.[index];
          const values = live ? { location: live.location, typeId: live.typeId, height: live.height, grossSF: live.grossSF, soffitLF: live.soffitLF, openings: live.openings } : undefined;
          dispatch({ type: 'DUPLICATE_ROW', section: 'ceilings', index, values });
          // 3.5 — plain reducer dispatch, not a native DOM event; see
          // AppShell.jsx's reactive-calc effect comment for why autosave
          // is fixed per-action here, not with a blanket watcher.
          window._handleFormChange?.();
        }}>⧉</button>
        <button className="del-btn" onClick={() => {
          const live = window.collectFormData?.()?.ceilings?.[index];
          const values = live ? { location: live.location, typeId: live.typeId, height: live.height, grossSF: live.grossSF, soffitLF: live.soffitLF, openings: live.openings } : undefined;
          dispatch({ type: 'DELETE_ROW', section: 'ceilings', index, values });
          window._handleFormChange?.();
        }}>×</button>
      </td>
    </tr>
  );
}

function fmtTotal(n) { return n > 0 ? n.toLocaleString() : '—'; }

export default function CeilingsPage({ active }) {
  const [state, dispatch] = useStore();
  const rows = state.bid.ceilings;
  const assemblies = state.bid.assemblies;
  const mode = state.bid.ceilingsMode;
  const rootRef = useRef(null);
  const [derived, setDerived] = useState([]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    registerCeilingsModeReader(() => modeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeDerived = useCallback(() => {
    if (!rootRef.current) return [];
    return Array.from(rootRef.current.querySelectorAll('#ceil-body tr')).map((tr) => {
      const location = tr.querySelector('.ceil-location')?.value || '';
      const typeId   = tr.querySelector('.ceil-typeid')?.value || '';
      const height   = parseFloat(tr.querySelector('.ceil-height')?.value) || 0;
      const gross    = parseFloat(tr.querySelector('.cgsf')?.value) || 0;
      const soffitLF = parseFloat(tr.querySelector('.ceil-soffitlf')?.value) || 0;
      const openings = parseFloat(tr.querySelector('.cded')?.value) || 0;
      const isBlank = !location && !typeId && !height && !gross && !soffitLF && !openings;
      return {
        isBlank,
        zeroHeight: !isBlank && height === 0,
        openingsExceedGross: gross > 0 && openings > gross,
        gross, openings, soffitLF, netSF: Math.max(0, gross - openings)
      };
    });
  }, []);

  useEffect(() => {
    setDerived(computeDerived());
  }, [rows, mode, computeDerived]);

  // 3.3 — see WallsPage.jsx's identical comment: a plain button dispatch
  // never fires the native DOM input/change event autosave's delegated
  // listener needs, so this defers an immediate (non-debounced)
  // window._autosave() to an effect, matching RatesPage.jsx's proven
  // needsImmediateSave shape.
  const [needsImmediateSave, setNeedsImmediateSave] = useState(false);
  useEffect(() => {
    if (!needsImmediateSave) return;
    setNeedsImmediateSave(false);
    window._autosave?.();
  }, [needsImmediateSave, mode]);

  function setMode(value) {
    dispatch({ type: 'SET_FIELD', path: ['bid', 'ceilingsMode'], value });
    setNeedsImmediateSave(true);
  }

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-ceilings" ref={rootRef} onInput={() => setDerived(computeDerived())}>
      <div className="page-hdr">
        <div><div className="page-title">Ceiling + soffit quantities</div><div className="page-sub">One row per area. Net SF calculates automatically.</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('walls')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('output')}>Generate bid output →</button>
        </div>
      </div>
      <ModeToggle mode={mode} onChange={setMode} />
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col style={{ width: 150 }} /><col style={{ width: 64 }} /><col style={{ width: 78, visibility: mode === 'area' ? 'collapse' : 'visible' }} />
            <col style={{ width: 88 }} /><col style={{ width: 88 }} /><col style={{ width: 92 }} />
            <col style={{ width: 72 }} /><col style={{ width: 58 }} />
          </colgroup>
          <thead><tr>
            <th>Location</th><th>Type ID</th><th style={mode === 'area' ? { display: 'none' } : undefined}>Height (ft)</th>
            <th>SF ceiling</th><th>Soffit LF</th><th>Openings (SF)</th><th>Net SF</th><th></th>
          </tr></thead>
          <tbody id="ceil-body">
            {rows.map((row, i) => <CeilRow key={row._key} row={row} index={i} dispatch={dispatch} assemblies={assemblies} derived={derived[i]} mode={mode} />)}
          </tbody>
          {/* 3.5 — column totals, summed from the same computeDerived()
              pass 3.4 already runs (Σ over non-blank rows). */}
          <tfoot><tr className="totals-row">
            <td colSpan="2">Totals</td>
            <td style={mode === 'area' ? { display: 'none' } : undefined}></td>
            <td>{fmtTotal(derived.filter((d) => d && !d.isBlank).reduce((s, d) => s + d.gross, 0))}</td>
            <td>{fmtTotal(derived.filter((d) => d && !d.isBlank).reduce((s, d) => s + d.soffitLF, 0))}</td>
            <td></td>
            <td>{fmtTotal(derived.filter((d) => d && !d.isBlank).reduce((s, d) => s + d.netSF, 0))}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => { dispatch({ type: 'ADD_CEILING_ROW' }); window._handleFormChange?.(); }}>+ Add ceiling area</button>
    </div>
  );
}
