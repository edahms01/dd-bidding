// ─────────────────────────────────────────────────────────────────────
// RatesPage.jsx — full React port of index.html's #page-rates + the
// rate-template CRUD UI (js/ui.js's renderRateTemplateSelect()/
// saveRateTemplateFromForm()/loadSelectedRateTemplate()/
// deleteSelectedRateTemplate()) + the crude totals-bar sum (js/ui.js's
// calc(), NOT the real calculator.js engine — see the spike report/plan
// for why these are different things).
//
// Two fields (Plastering, External wall) are genuine orphans in the
// original app: they're real inputs with real oninput="calc()" handlers,
// but collectFormData() never reads them and nothing persists them —
// verified directly (grep for "plaster"/"extwall" across js/ turns up
// nothing outside index.html and this file). Preserved as-is: plain
// uncontrolled inputs, not wired to reducer state, exactly matching
// current behavior (they contribute to the displayed totals bar but
// nowhere else, same as today).
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../state/store.jsx';

function fmt(n) { return n > 0 ? '$' + Math.round(n).toLocaleString() : '-'; }

// Mirrors js/state.js's collectFormData()'s num(): parseFloat, NaN -> 0.
// Applied before saving a rate template — see handleSaveTemplate().
function numify(obj) {
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k in obj) out[k] = numify(obj[k]);
    return out;
  }
  const v = parseFloat(obj);
  return isNaN(v) ? 0 : v;
}

function sumClassIn(root, cls) {
  let t = 0;
  root.querySelectorAll('.' + cls).forEach((el) => {
    const v = parseFloat(el.value);
    if (!isNaN(v)) t += v;
  });
  return t;
}

function RateField({ path, dispatch, get, className, id, placeholder }) {
  return (
    <input
      id={id}
      className={className}
      type="number"
      placeholder={placeholder}
      value={get(path)}
      onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}
    />
  );
}

function EscField({ path, dispatch, get, id }) {
  return (
    <input
      id={id}
      className="esc-input"
      type="number"
      placeholder="-"
      value={get(path)}
      onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}
    />
  );
}

export default function RatesPage({ active }) {
  const [state, dispatch] = useStore();
  const rootRef = useRef(null);
  const [totals, setTotals] = useState({ l: 0, m: 0, x: 0 });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [needsImmediateSave, setNeedsImmediateSave] = useState(false);

  // See handleLoadTemplate() below for why this can't just call
  // window._autosave() inline at dispatch time.
  useEffect(() => {
    if (!needsImmediateSave) return;
    setNeedsImmediateSave(false);
    window._autosave?.();
  }, [needsImmediateSave, state.bid.rates, state.bid.rateEscalation]);

  const get = useCallback((path) => {
    // path is bid-relative (e.g. ['rates','framing']) — RateField/EscField
    // only prepend 'bid' when dispatching (SET_FIELD's path needs the full
    // state-relative path); this read side already starts at state.bid.
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  }, [state.bid]);

  const recomputeTotals = useCallback(() => {
    if (!rootRef.current) return;
    const next = {
      l: sumClassIn(rootRef.current, 'L'),
      m: sumClassIn(rootRef.current, 'M'),
      x: sumClassIn(rootRef.current, 'X')
    };
    setTotals(next);
    // Phase C 2.2 — publish the same L/M/X sum stepStatus.js reads for
    // the Rates tab's completion indicator. SET_RATE_TOTALS no-ops when
    // the numbers are unchanged (store.jsx), so the onInput/hydration
    // firings that don't move a total are free.
    dispatch({ type: 'SET_RATE_TOTALS', totals: next });
  }, [dispatch]);

  // Mirrors calc() being called explicitly at the end of populateForm()/
  // applyRateTemplate() — recompute whenever rates hydrate from a draft
  // or a template. The onInput delegation below (mirroring every
  // oninput="calc()" attribute in the original markup) handles typing,
  // including the two orphan fields which aren't reducer-tracked at all.
  useEffect(() => {
    recomputeTotals();
  }, [state.bid.rates, state.bid.rateEscalation, recomputeTotals]);

  async function loadTemplates() {
    try {
      setTemplates(await window.getAllRateTemplates());
    } catch (e) {
      setTemplates([]);
    }
  }

  // Matches goto()'s old `if (id === 'rates') renderRateTemplateSelect()`
  // — refetch the template list every time this page becomes active,
  // not just once on first mount.
  useEffect(() => {
    if (active) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function handleSaveTemplate() {
    const name = prompt('Name this rate template:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const isDuplicate = templates.some((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate && !confirm(`A template named "${trimmed}" already exists. Save another one with this name?`)) return;
    try {
      // Real bug found running the suite, not assumed: collectFormData()'s
      // num() helper parses every rate field via parseFloat (NaN -> 0)
      // before saveRateTemplateFromForm() ever saved a template — "5.00"
      // typed by a user was always saved and reloaded as the number 5.
      // Reducer state holds the raw typed string (needed so the input
      // doesn't fight the user mid-keystroke), so saving state.bid.rates
      // directly would save "5.00" verbatim, a real behavior difference
      // caught by rate-templates.spec.js expecting "5" back after a
      // reload. numify() replicates num()'s exact parseFloat/NaN->0 rule.
      await window.saveRateTemplate(trimmed, numify(state.bid.rates), numify(state.bid.rateEscalation));
      await loadTemplates();
      window._showFormToast?.('Template saved ✓', 'success');
    } catch (e) {
      alert('Failed to save template. Check your connection and try again.');
    }
  }

  function handleLoadTemplate() {
    if (!selectedTemplateId) return;
    if (window.__getHasUnsavedChanges?.() && !confirm('Loading a template will overwrite your current unsaved changes. Continue?')) return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;
    dispatch({ type: 'LOAD_RATES', rates: tmpl.rates, rateEscalation: tmpl.rateEscalation });
    // Real bug found running the suite, not assumed: the old
    // applyRateTemplate() did an immediate manual draft save (not the
    // normal 700ms debounce) specifically so a reload right after
    // loading a template can't lose it to a race — its own comment
    // explains why. Dispatching into the reducer alone doesn't trigger
    // that: React sets a controlled input's DOM .value directly during
    // its own commit, without firing a native input/change event, so
    // the .workflow-area delegated listener that normally drives
    // autosave never sees this change at all. needsImmediateSave defers
    // the actual save to an effect (below), so it runs after React has
    // committed the new values to the DOM — collectFormData() (which
    // window._autosave() calls) reads live DOM .value, and calling it
    // before that commit would save the *previous* values instead.
    setNeedsImmediateSave(true);
    window._showFormToast?.('Template loaded ✓', 'success');
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!confirm(`Delete template "${tmpl ? tmpl.name : ''}"? This cannot be undone.`)) return;
    try {
      await window.deleteRateTemplate(selectedTemplateId);
      await loadTemplates();
      setSelectedTemplateId('');
      window._showFormToast?.('Template deleted ✓', 'success');
    } catch (e) {
      alert('Failed to delete template. Check your connection and try again.');
    }
  }

  const finishDots = { 1: '#555a6b', 2: '#4a8fe8', 3: '#2ab5a0', 4: '#e87c2a', 5: '#3abf7a' };
  const finishDesc = {
    1: 'Tape only, concealed areas',
    2: 'Tape + compound, wet areas',
    3: 'Standard commercial, paint ready',
    4: 'High quality, most commercial work',
    5: 'Premium: skim coat, critical lighting'
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-rates" ref={rootRef} onInput={recomputeTotals}>
      <div className="page-hdr">
        <div className="rates-hdr-lead">
          <div><div className="page-title">Rates</div><div className="page-sub">Current pricing for this project: labor, materials, and logistics</div></div>
          <div className="rate-template-controls">
            <select
              id="rate-template-select"
              style={{ minWidth: 150 }}
              disabled={templates.length === 0}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templates.length === 0
                ? <option value="">No templates saved</option>
                : templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={handleDeleteTemplate} title="Delete selected template">🗑</button>
            <button className="btn btn-ghost btn-sm" onClick={handleLoadTemplate}>Load</button>
            <button className="btn btn-ghost btn-sm" onClick={handleSaveTemplate}>Save as template</button>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('ceilings')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('output')}>Next: Cost Summary →</button>
        </div>
      </div>

      <div className="totals-bar">
        <div className="total-item"><div className="total-val" id="t-l">{fmt(totals.l)}</div><div className="total-lbl">Labor</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val" id="t-m">{fmt(totals.m)}</div><div className="total-lbl">Materials</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val" id="t-x">{fmt(totals.x)}</div><div className="total-lbl">Logistics</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val green" id="t-tot">{fmt(totals.l + totals.m + totals.x)}</div><div className="total-lbl">Direct cost total</div></div>
      </div>

      <div className="rgroup">
        <div className="rgroup-hdr">
          <div className="rgroup-icon icon-l">L</div>
          <div><div className="rgroup-title">Labor rates</div><div className="rgroup-desc">All-in crew rate excluding burden</div></div>
        </div>
        <div className="rgrid g3" style={{ marginBottom: 12 }}>
          <div className="rcard"><div className="rcard-lbl">Metal framing <span className="badge b-lf">per LF</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-frame" className="ri L" path={['rates', 'framing']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/LF</span></div><div className="rhint">Standard height. Adders applied automatically.</div></div>
          <div className="rcard"><div className="rcard-lbl">Drywall hanging <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-hang" className="ri L" path={['rates', 'hanging']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/SF/layer</span></div><div className="rhint">Multiplied by board layers per assembly.</div></div>
          {/* Orphan fields — see file header comment. Plain uncontrolled inputs, matching current behavior exactly. */}
          <div className="rcard"><div className="rcard-lbl">Plastering <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><input id="rate-plaster" className="ri L" type="number" placeholder="0.00" /><span className="isfx">/SF</span></div></div>
          <div className="rcard"><div className="rcard-lbl">External wall <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><input id="rate-extwall" className="ri L" type="number" placeholder="0.00" /><span className="isfx">/SF</span></div></div>
          <div className="rcard"><div className="rcard-lbl">Labor burden <span className="badge b-pct">%</span></div><div className="iw"><RateField id="rate-burden" className="ri L" path={['rates', 'burdenPct']} get={get} dispatch={dispatch} placeholder="32" /><span className="isfx">%</span></div><div className="rhint">Payroll tax, workers comp, benefits. 28–40%.</div></div>
          <div className="rcard"><div className="rcard-lbl">Supervision <span className="badge b-pct">%</span></div><div className="iw"><RateField id="rate-super" className="ri L" path={['rates', 'superPct']} get={get} dispatch={dispatch} placeholder="8" /><span className="isfx">%</span></div><div className="rhint">Foreman as % of total labor. 6–12%.</div></div>
        </div>
        <div className="taping-adders-row">
          <div className="taping-col">
            <div className="sub-lbl">Taping + finishing, by finish level ($/SF)</div>
            <div className="ftable">
              <div className="fth"><div>Level</div><div>Description</div><div>Rate ($/SF)</div></div>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div className="frow" key={lvl}>
                  <div className="flvl"><span className="ldot" style={{ background: finishDots[lvl] }} />Level {lvl}</div>
                  <div className="fdesc">{finishDesc[lvl]}</div>
                  <div><div className="fiw"><span className="fpfx">$</span><RateField id={'rate-fin' + lvl} className="fi L" path={['rates', 'finish', lvl]} get={get} dispatch={dispatch} placeholder="0.00" /></div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="adders-col">
            <div className="sub-lbl" style={{ marginBottom: 10 }}>Height adders, labor uplift %</div>
            <div className="acard"><div><div className="albl">Above 12 ft</div><div className="asub">Requires lift. Applied to SF above 12 ft.</div></div><div className="aiw"><RateField id="rate-add12" className="ai L" path={['rates', 'adder12Pct']} get={get} dispatch={dispatch} placeholder="15" /><span className="apct">%</span></div></div>
            <div className="acard"><div><div className="albl">Above 20 ft</div><div className="asub">High-lift zone. Stacked on 12 ft adder.</div></div><div className="aiw"><RateField id="rate-add20" className="ai L" path={['rates', 'adder20Pct']} get={get} dispatch={dispatch} placeholder="30" /><span className="apct">%</span></div></div>
          </div>
        </div>
      </div>

      <div className="rgroup">
        <div className="rgroup-hdr">
          <div className="rgroup-icon icon-m">M</div>
          <div><div className="rgroup-title">Material rates</div><div className="rgroup-desc">Current supplier pricing; waste factor from conditions applied automatically</div></div>
        </div>
        <div className="sub-lbl">Stud + track by size ($/LF)</div>
        <div className="rgrid mat-grid" style={{ marginBottom: 14 }}>
          {['1-5/8"', '2-1/2"', '3-5/8"', '4"', '6"'].map((sz) => (
            <div className="stud-card" key={sz}>
              <div className="stud-sz">{sz}</div>
              <div className="stud-sub">incl. track</div>
              <div className="siw"><span className="spfx">$</span><RateField id={'rate-stud' + sz.replace(/[^0-9]/g, '')} className="si M" path={['rates', 'stud', sz]} get={get} dispatch={dispatch} placeholder="0.00" /></div>
              <div className="esc-row"><span>Esc</span><EscField id={'esc-stud' + sz.replace(/[^0-9]/g, '')} path={['rateEscalation', 'stud', sz]} get={get} dispatch={dispatch} /><span>%</span></div>
            </div>
          ))}
        </div>
        <div className="sub-lbl" style={{ marginTop: 28 }}>Drywall board by type ($/SF)</div>
        <div className="rgrid mat-grid" style={{ marginBottom: 14 }}>
          {[
            ['Standard', 'std'], ['Type-X', 'typex'], ['Moisture', 'moist'], ['Impact', 'imp']
          ].map(([boardType, slug]) => (
            <div className="rcard" key={boardType}>
              <div className="rcard-lbl">{boardType === 'Moisture' ? 'Moisture-resistant' : boardType === 'Impact' ? 'Impact-resistant' : boardType} <span className="badge b-sf">$/SF</span></div>
              <div className="iw"><span className="ipfx">$</span><RateField id={'rate-brd-' + slug} className="ri M" path={['rates', 'board', boardType]} get={get} dispatch={dispatch} placeholder="0.00" /></div>
              <div className="esc-row"><span>Esc</span><EscField id={'esc-brd-' + slug} path={['rateEscalation', 'board', boardType]} get={get} dispatch={dispatch} /><span>%</span></div>
            </div>
          ))}
        </div>
        <div className="sub-lbl" style={{ marginTop: 28 }}>Finishing materials</div>
        <div className="rgrid mat-grid">
          <div className="rcard"><div className="rcard-lbl">Tape + compound <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-tape" className="ri M" path={['rates', 'tape']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/SF</span></div><div className="rhint">Flat allowance across all finished SF.</div><div className="esc-row"><span>Esc</span><EscField id="esc-tape" path={['rateEscalation', 'tape']} get={get} dispatch={dispatch} /><span>%</span></div></div>
          <div className="rcard"><div className="rcard-lbl">Insulation <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-insul" className="ri M" path={['rates', 'insul']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/SF</span></div><div className="rhint">Applied to assemblies with insulation flagged.</div><div className="esc-row"><span>Esc</span><EscField id="esc-insul" path={['rateEscalation', 'insul']} get={get} dispatch={dispatch} /><span>%</span></div></div>
          <div className="rcard"><div className="rcard-lbl">Fasteners + adhesives <span className="badge b-sf">per SF</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-fasten" className="ri M" path={['rates', 'fasten']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/SF</span></div><div className="rhint">Flat allowance. Typically $0.08–$0.15/SF.</div><div className="esc-row"><span>Esc</span><EscField id="esc-fasten" path={['rateEscalation', 'fasten']} get={get} dispatch={dispatch} /><span>%</span></div></div>
        </div>
      </div>

      <div className="rgroup">
        <div className="rgroup-hdr">
          <div className="rgroup-icon icon-x">X</div>
          <div><div className="rgroup-title">Logistics</div><div className="rgroup-desc">Per-trip and per-unit costs; quantities from conditions</div></div>
        </div>
        <div className="rgrid g3">
          <div className="rcard"><div className="rcard-lbl">Delivery <span className="badge b-flat">per trip</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-delivery" className="ri X" path={['rates', 'delivery']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/trip</span></div><div className="rhint">Multiplied by estimated delivery trips.</div></div>
          <div className="rcard"><div className="rcard-lbl">Waste disposal <span className="badge b-flat">per pull</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-disposal" className="ri X" path={['rates', 'disposal']} get={get} dispatch={dispatch} placeholder="0.00" /></div></div>
          <div className="rcard"><div className="rcard-lbl">Lift rental <span className="badge b-flat">per week</span></div><div className="iw"><span className="ipfx">$</span><RateField id="rate-lift" className="ri X" path={['rates', 'lift']} get={get} dispatch={dispatch} placeholder="0.00" /><span className="isfx">/wk</span></div><div className="rhint">Only applied if SF above 12 ft &gt; 0.</div></div>
        </div>
      </div>
    </div>
  );
}
