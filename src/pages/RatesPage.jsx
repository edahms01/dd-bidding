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
//
// UI-fixes batch (2026-09-04): migrated from the old per-field
// .rcard/.iw/.fiw/.siw/.aiw "dialects" to the shared .rr-*/.tray system
// (css/components.css, per rates-standardized-layout-v4.html +
// bid-iq-compact-ui-design-system-v2.md). See useUniformRowWidths for
// the --box-width/--sfx-width/--rr-width measurement mechanism this
// relies on. Field ids/classes (rate-*/esc-*, the L/M/X totals-bar
// classing) are unchanged — only the surrounding markup moved.
//
// 2026-09-05: the "Markup" tray (Company overhead / Risk-contingency /
// Profit margin %s) moved here from OutputPage.jsx (Cost Summary). It
// sits at the bottom of the page in a `.tray-row` beside the Logistics
// tray — Logistics as column 1, Markup as column 2. The inputs stay React-
// controlled off state.bid.markupInputs — collectFormData() still reads
// #markup-* by id, and runCalculation()'s contingency-from-confidence
// pre-fill (js/ui.js) still writes #markup-contingency + dispatches
// __hydrateMarkup — none of that cares which page renders the fields.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../state/store.jsx';
import { useUniformRowWidths } from '../state/useUniformRowWidths.js';
import { RRRow } from '../components/RRRow.jsx';

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

// True if state.bid.rateEscalation carries any actually-set value (a
// number, including 0, or a non-empty string). '' — the initialState
// default — and null — seed's "unset" marker — both count as not-set.
// Drives the escalation-fields toggle's default-open exception (see
// RatesPage() below): loading a bid that already has escalation set
// must not silently hide it behind an off-by-default toggle.
function anyRateEscalationSet(esc) {
  if (esc && typeof esc === 'object') return Object.values(esc).some(anyRateEscalationSet);
  return esc !== '' && esc !== null && esc !== undefined;
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
      className="rr-val pct esc-input"
      type="number"
      placeholder="-"
      value={get(path)}
      onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}
    />
  );
}

// Escalation's .rr-connected shape (see components.css's ".tray.esc-open"
// comment for why this isn't the same mechanism as Curved Walls/Phased
// Work): always-mounted child, no per-row expand state — the tray's
// `esc-open` class (driven by the one checkbox) does the showing/hiding
// for every row via CSS. `rowEl` is the row's own <RRRow/> for the $
// rate; this only owns the escalation child wrapped around it.
function EscConnected({ rowEl, id, path, get, dispatch }) {
  return (
    <div className="rr-connected">
      {rowEl}
      <div className="rr-child">
        <span className="rr-child-lbl">Esc</span>
        <div className="rr-input">
          <EscField id={id} path={path} get={get} dispatch={dispatch} />
          <span className="rr-sfx">%</span>
        </div>
      </div>
    </div>
  );
}

export default function RatesPage({ active }) {
  const [state, dispatch] = useStore();
  const rootRef = useRef(null);
  const [totals, setTotals] = useState({ l: 0, m: 0, x: 0 });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [needsImmediateSave, setNeedsImmediateSave] = useState(false);
  // Escalation fields sit behind a per-visit display toggle. Local state
  // only — never dispatched into the reducer, never exported, not bid
  // data. Default closed; the exception below opens it for a bid that
  // already carries an escalation value. Drives the Material tray's
  // `esc-open` class (see the tray's className below and components.css's
  // ".tray.esc-open" block) rather than a per-row `show` prop — the
  // escalation inputs stay always-mounted (CSS-collapsed, not unmounted)
  // regardless, same reasoning as before: collectFormData() scans the DOM
  // by id for esc-* fields, so unmounting them would drop every
  // escalation value from autosave/export/calc. Visibility only.
  const [showEsc, setShowEsc] = useState(false);
  const escUserSetRef = useRef(false);

  // Measures --box-width/--sfx-width/--rr-width for every .rr row on this
  // page (design doc §7/§8/§16) — see useUniformRowWidths.js.
  useUniformRowWidths(rootRef);

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

  // Re-evaluate the escalation toggle's default every time Rates becomes
  // active (and whenever the loaded escalation data changes underneath
  // it — draft switch, seed load, hydration landing a tick late): closed
  // unless the bid already has an escalation value, in which case open so
  // the value isn't silently hidden. Stops auto-tracking for the rest of
  // the visit once the user works the toggle by hand; that latch resets
  // on leaving Rates, so the next visit starts from the default again.
  useEffect(() => {
    if (!active) { escUserSetRef.current = false; return; }
    if (!escUserSetRef.current) setShowEsc(anyRateEscalationSet(state.bid.rateEscalation));
  }, [active, state.bid.rateEscalation]);

  const toggleEsc = useCallback(() => {
    escUserSetRef.current = true;
    setShowEsc((v) => !v);
  }, []);

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

  // Finish-level dots/tooltips — verbatim from rates-standardized-layout-
  // v4.html. Level 3 gets no tooltip (and no .info icon at all): the
  // mockup's own measure-area row has the icon markup with no data-tip,
  // an unresolved content gap, not a Code omission — Eric's call was to
  // drop the icon entirely rather than invent placeholder copy. Levels
  // 1/2/4/5's tooltip text is byte-identical to this app's pre-existing
  // finish-level descriptions (moved into a tooltip per design doc §5,
  // not new copy).
  // Markup %s — moved here from OutputPage.jsx as-is (see file header).
  // Same shape OutputPage used: read state.bid.markupInputs, SET_FIELD on change.
  const mu = state.bid.markupInputs;
  const setMarkup = (field, value) => dispatch({ type: 'SET_FIELD', path: ['bid', 'markupInputs', field], value });

  const finishDots = { 1: '#8a93a6', 2: '#4a8fe8', 3: '#4fbf6a', 4: '#e8a33d', 5: '#4fbf6a' };
  const finishTips = {
    1: 'Tape only, concealed areas',
    2: 'Tape + compound, wet areas',
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

      <div className="tray">
        <div className="tray-hdr">Labor Rates</div>
        <div className="tray-cols">
          <div className="tray-col">
            <div className="sub-lbl">Base rates</div>
            <RRRow name="Metal framing" tip="Standard height. Adders applied automatically." pfx="$" sfx="/LF"
              valueEl={<RateField id="rate-frame" className="rr-val cur L" path={['rates', 'framing']} get={get} dispatch={dispatch} placeholder="0.00" />} />
            <RRRow name="Drywall hanging" tip="Multiplied by board layers per assembly." pfx="$" sfx="/SF"
              valueEl={<RateField id="rate-hang" className="rr-val cur L" path={['rates', 'hanging']} get={get} dispatch={dispatch} placeholder="0.00" />} />
            {/* Orphan fields — see file header comment. Plain uncontrolled inputs, matching current behavior exactly. */}
            <RRRow name="Plastering" pfx="$" sfx="/SF"
              valueEl={<input id="rate-plaster" className="rr-val cur L" type="number" placeholder="0.00" />} />
            <RRRow name="External wall" pfx="$" sfx="/SF"
              valueEl={<input id="rate-extwall" className="rr-val cur L" type="number" placeholder="0.00" />} />
            <RRRow name="Labor burden" tip="Payroll tax, workers comp, benefits. 28–40%." sfx="%"
              valueEl={<RateField id="rate-burden" className="rr-val pct L" path={['rates', 'burdenPct']} get={get} dispatch={dispatch} placeholder="32" />} />
            <RRRow name="Supervision" tip="Foreman as % of total labor. 6–12%." sfx="%"
              valueEl={<RateField id="rate-super" className="rr-val pct L" path={['rates', 'superPct']} get={get} dispatch={dispatch} placeholder="8" />} />
            <div className="sub-lbl" style={{ marginTop: 28 }}>Height adders, labor uplift %</div>
            <RRRow name="Above 12 ft" tip="Requires lift. Applied to SF above 12 ft." sfx="%"
              valueEl={<RateField id="rate-add12" className="rr-val pct L" path={['rates', 'adder12Pct']} get={get} dispatch={dispatch} placeholder="15" />} />
            <RRRow name="Above 20 ft" tip="High-lift zone. Stacked on 12 ft adder." sfx="%"
              valueEl={<RateField id="rate-add20" className="rr-val pct L" path={['rates', 'adder20Pct']} get={get} dispatch={dispatch} placeholder="30" />} />
          </div>
          <div className="tray-col">
            <div className="sub-lbl">Taping + finishing, by finish level ($/SF)</div>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <RRRow key={lvl} name={'Level ' + lvl} dot={finishDots[lvl]} tip={finishTips[lvl]} pfx="$"
                valueEl={<RateField id={'rate-fin' + lvl} className="rr-val cur L" path={['rates', 'finish', lvl]} get={get} dispatch={dispatch} placeholder="0.00" />} />
            ))}
          </div>
        </div>
      </div>

      <div className={'tray' + (showEsc ? ' esc-open' : '')}>
        <div className="tray-hdr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Material Rates</span>
          <label className="esc-toggle" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showEsc} onChange={toggleEsc} />
            Show escalation fields
          </label>
        </div>
        <div className="tray-cols">
          <div className="tray-col">
            <div className="sub-lbl">Stud + track by size ($/LF)</div>
            {['1-5/8"', '2-1/2"', '3-5/8"', '4"', '6"'].map((sz) => {
              const slug = sz.replace(/[^0-9]/g, '');
              return (
                <EscConnected key={sz} id={'esc-stud' + slug} path={['rateEscalation', 'stud', sz]} get={get} dispatch={dispatch}
                  rowEl={<RRRow name={sz} sub="incl. track" pfx="$" sfx="/LF"
                    valueEl={<RateField id={'rate-stud' + slug} className="rr-val cur M" path={['rates', 'stud', sz]} get={get} dispatch={dispatch} placeholder="0.00" />} />} />
              );
            })}
            <div className="sub-lbl" style={{ marginTop: 28 }}>Drywall board by type ($/SF)</div>
            {[['Standard', 'std', 'Standard'], ['Type-X', 'typex', 'Type-X'], ['Moisture', 'moist', 'Moisture-resist.'], ['Impact', 'imp', 'Impact-resist.']].map(([boardType, slug, label]) => (
              <EscConnected key={boardType} id={'esc-brd-' + slug} path={['rateEscalation', 'board', boardType]} get={get} dispatch={dispatch}
                rowEl={<RRRow name={label} pfx="$"
                  valueEl={<RateField id={'rate-brd-' + slug} className="rr-val cur M" path={['rates', 'board', boardType]} get={get} dispatch={dispatch} placeholder="0.00" />} />} />
            ))}
          </div>
          <div className="tray-col">
            <div className="sub-lbl">Finishing materials</div>
            <EscConnected id="esc-tape" path={['rateEscalation', 'tape']} get={get} dispatch={dispatch}
              rowEl={<RRRow name="Tape + compound" tip="Flat allowance across all finished SF." pfx="$" sfx="/SF"
                valueEl={<RateField id="rate-tape" className="rr-val cur M" path={['rates', 'tape']} get={get} dispatch={dispatch} placeholder="0.00" />} />} />
            <EscConnected id="esc-insul" path={['rateEscalation', 'insul']} get={get} dispatch={dispatch}
              rowEl={<RRRow name="Insulation" tip="Applied to assemblies with insulation flagged." pfx="$" sfx="/SF"
                valueEl={<RateField id="rate-insul" className="rr-val cur M" path={['rates', 'insul']} get={get} dispatch={dispatch} placeholder="0.00" />} />} />
            <EscConnected id="esc-fasten" path={['rateEscalation', 'fasten']} get={get} dispatch={dispatch}
              rowEl={<RRRow name="Fasteners + Adh." tip="Flat allowance. Typically $0.08–$0.15/SF." pfx="$" sfx="/SF"
                valueEl={<RateField id="rate-fasten" className="rr-val cur M" path={['rates', 'fasten']} get={get} dispatch={dispatch} placeholder="0.00" />} />} />
          </div>
        </div>
      </div>

      {/* Logistics (col 1) + Markup (col 2) side by side — see .tray-row in components.css. */}
      <div className="tray-row">
        <div className="tray">
          <div className="tray-hdr">Logistics</div>
          <div className="tray-cols">
            <div className="tray-col">
              <RRRow name="Delivery" tip="Multiplied by estimated delivery trips." pfx="$" sfx="/trip"
                valueEl={<RateField id="rate-delivery" className="rr-val cur X" path={['rates', 'delivery']} get={get} dispatch={dispatch} placeholder="0.00" />} />
              <RRRow name="Waste disposal" pfx="$"
                valueEl={<RateField id="rate-disposal" className="rr-val cur X" path={['rates', 'disposal']} get={get} dispatch={dispatch} placeholder="0.00" />} />
              <RRRow name="Lift rental" tip="Only applied if SF above 12 ft > 0." pfx="$" sfx="/wk"
                valueEl={<RateField id="rate-lift" className="rr-val cur X" path={['rates', 'lift']} get={get} dispatch={dispatch} placeholder="0.00" />} />
            </div>
          </div>
        </div>

        <div className="tray">
          <div className="tray-hdr">Markup</div>
          <div className="tray-cols">
            <div className="tray-col">
              <RRRow name="Company overhead" sfx="%" tip="Office, insurance, fleet, as % of direct costs"
                valueEl={
                  <input id="markup-overhead" className="rr-val pct" type="number" min="0" step="0.1" placeholder="10.0"
                    value={mu.overheadPct} onChange={(e) => setMarkup('overheadPct', e.target.value)} />
                } />
              <RRRow name="Risk / contingency" sfx="%" tip="Pre-filled from confidence level; editable"
                valueEl={
                  <input id="markup-contingency" className="rr-val pct" type="number" min="0" step="0.1" placeholder="-"
                    value={mu.contingencyPct} onChange={(e) => setMarkup('contingencyPct', e.target.value)} />
                } />
              <RRRow name="Profit margin" sfx="%" tip="Target profit on direct costs"
                valueEl={
                  <input id="markup-profit" className="rr-val pct" type="number" min="0" step="0.1" placeholder="8.0"
                    value={mu.profitPct} onChange={(e) => setMarkup('profitPct', e.target.value)} />
                } />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
