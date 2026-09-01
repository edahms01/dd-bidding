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
// class now, not by NodeList position. Type ID is the one deliberately
// controlled field in this row — TypeIdSelect.jsx, dispatching
// SET_ROW_FIELD — everything else stays uncontrolled. See
// src/state/validation.js for the orphan-reference rule the inline
// warning below uses.
//
// 3.4: page-level `derived` state (openings > gross, zero-height, blank,
// and — 3.3's addendum — LF empty in area mode) — same root-ref +
// onInput-delegation pattern as RatesPage.jsx's own recomputeTotals().
// Read-only display — never touches calcWall()/collectFormData()'s
// existing clamp-at-zero math.
//
// 3.3: page-level "Enter by dimensions"/"Enter by area" toggle
// (state.bid.wallsMode, a plain reducer scalar — persists per draft the
// same way every other bid field does, no separate mechanism). Height
// is the only column that toggles — it's never read by calcWall()'s
// cost math (confirmed by reading calculator.js before building this),
// so hiding it changes nothing about pricing, only what's shown. LF/
// Gross SF/Openings/Net SF stay visible and directly-entered in both
// modes, exactly as before 3.3. Height's <td>/<th> and <col> use
// display:none/visibility:collapse (CSS-hide), never conditional
// unmount — an unmounted uncontrolled <input> would discard whatever
// the user typed the moment the mode switched, silently violating
// "hides columns without discarding already-entered values". The mode
// itself has no DOM representation (a click toggle, not a form value),
// so collectFormData() (js/state.js) reads it back via
// window.__getWallsMode(), registered below the same way
// ConditionsPage.jsx registers its confidence reader.
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
import { registerWallsModeReader } from '../state/bridges.js';

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

function WallRow({ row, index, dispatch, assemblies, derived, mode }) {
  const gsfRef = useRef(null);
  const dedRef = useRef(null);
  const netRef = useRef(null);
  const heightHidden = mode === 'area';

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
      <td style={heightHidden ? { display: 'none' } : undefined}>
        <input type="number" min="0" className="wall-height" defaultValue={row.height} placeholder="10" />
        {derived?.zeroHeight && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ Height is 0</div>
        )}
      </td>
      <td>
        <input type="number" min="0" defaultValue={row.lf} placeholder="0" className="wlf" />
        {derived?.lfEmptyInAreaMode && (
          <div style={{ fontSize: 11, color: 'var(--status-warn)', marginTop: 3 }}>⚠ LF is required</div>
        )}
      </td>
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
  const mode = state.bid.wallsMode;
  const rootRef = useRef(null);
  const [derived, setDerived] = useState([]);

  // 3.3 — always-current ref so the registered getter never returns a
  // stale closure value, same pattern as ConditionsPage.jsx's confRef.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    registerWallsModeReader(() => modeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3.4 (+ 3.3's LF-empty-in-area-mode addendum) — one page-level pass
  // over the live DOM, read-only, never fed back into calcWall()'s math.
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
        zeroHeight: !isBlank && height === 0,
        openingsExceedGross: gross > 0 && openings > gross,
        // LF stays required in BOTH modes (it's priced per LF, not
        // recoverable from SF alone) — only worth flagging on a row
        // that otherwise has real data, same reasoning as zeroHeight.
        lfEmptyInAreaMode: !isBlank && modeRef.current === 'area' && !lf,
        lf, gross, openings
      };
    });
  }, []);

  useEffect(() => {
    setDerived(computeDerived());
  }, [rows, mode, computeDerived]);

  // 3.3 — the mode toggle is a plain button dispatch, not a native DOM
  // input/change event, so js/forms.js's .workflow-area delegated
  // listener (the one that drives _debouncedAutosave()) never sees it —
  // found running the real reload-persistence check, not assumed safe
  // by analogy. Same fix, same reasoning, as RatesPage.jsx's
  // handleLoadTemplate()/needsImmediateSave: defer an immediate
  // (non-debounced) window._autosave() to an effect keyed on the mode
  // itself, so it runs after React has actually committed the change,
  // not synchronously at click time (collectFormData() reads the
  // now-current window.__getWallsMode() value either way here — the
  // ref updates every render regardless — but this keeps the same
  // proven shape as the one other place this exact hazard was already
  // found, rather than reasoning it's unnecessary here specifically).
  const [needsImmediateSave, setNeedsImmediateSave] = useState(false);
  useEffect(() => {
    if (!needsImmediateSave) return;
    setNeedsImmediateSave(false);
    window._autosave?.();
  }, [needsImmediateSave, mode]);

  function setMode(value) {
    dispatch({ type: 'SET_FIELD', path: ['bid', 'wallsMode'], value });
    setNeedsImmediateSave(true);
  }

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-walls" ref={rootRef} onInput={() => setDerived(computeDerived())}>
      <div className="page-hdr">
        <div><div className="page-title">Wall quantities</div><div className="page-sub">One row per floor or zone. Net SF calculates automatically.</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('assemblies')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('ceilings')}>Next: Ceilings →</button>
        </div>
      </div>
      <ModeToggle mode={mode} onChange={setMode} />
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col style={{ width: 150 }} /><col style={{ width: 64 }} /><col style={{ width: 78, visibility: mode === 'area' ? 'collapse' : 'visible' }} />
            <col style={{ width: 82 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 72 }} /><col style={{ width: 36 }} />
          </colgroup>
          <thead><tr>
            <th>Location</th><th>Type ID</th><th style={mode === 'area' ? { display: 'none' } : undefined}>Height (ft)</th>
            <th>LF framing</th><th>Gross SF board</th><th>Openings (SF)</th><th>Net SF</th><th></th>
          </tr></thead>
          <tbody id="wall-body">
            {rows.map((row, i) => <WallRow key={row._key} row={row} index={i} dispatch={dispatch} assemblies={assemblies} derived={derived[i]} mode={mode} />)}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => dispatch({ type: 'ADD_WALL_ROW' })}>+ Add wall area</button>
    </div>
  );
}
