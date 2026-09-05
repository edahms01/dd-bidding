// ─────────────────────────────────────────────────────────────────────
// MarketReadPage.jsx — Phase C 2.1. The price-driving half of the old
// Conditions page, split off into its own late step (after Cost
// Summary, before Bid Strategy): estimator confidence + notes, and the
// "Market + competitive intelligence" block.
//
// State is unchanged by the split — `confidence`/`notes` still live in
// the bid.conditions slice, the eight market fields still in
// bid.intelligence. Only which page renders them moved, so the export
// payload / golden fixture are untouched.
//
// Carries the two on-become-active side effects that used to live on
// ConditionsPage because their targets moved here:
//   - registerConfidenceReader() — window.__getConfidence for
//     collectFormData() (js/state.js) and the agent.
//   - _renderPipelineHint() (js/ui.js) — writes #pipeline-count-hint,
//     which is inside the Pipeline pressure card below.
//
// UI-fixes batch (2026-09-05): migrated the Market signals / Competitive
// signals selects to the shared .rr-*/.tray system (see RatesPage.jsx's
// migration note) — one tray, two columns (Market signals fuller, so it
// leads, per design doc §11's newspaper-column rule). Two deliberate
// exceptions, not migrated, per design doc §15's own scope limit (a
// numeric/select-field playbook, not a forced fit for free text):
//   - Estimator confidence (button group) and Estimator notes (textarea)
//     stay exactly as they were, above the tray.
//   - Known competitors (free-text) stays a plain .flag-card below the
//     tray — an unbounded competitor-name list doesn't belong in a
//     uniform-box row built for short numeric/select values.
// Pipeline pressure keeps a small `.rhint` line under its row (not a
// tooltip like every other field here) because #pipeline-count-hint is
// live DOM content injected by js/ui.js's _renderPipelineHint() — that
// target has to stay a real, visible element, not text inside a
// `data-tip` attribute.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store.jsx';
import { registerConfidenceReader } from '../state/bridges.js';
import { SelectRow } from '../components/RRRow.jsx';
import { useUniformRowWidths } from '../state/useUniformRowWidths.js';

function Field({ path, dispatch, get, id, type = 'text', placeholder }) {
  return (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={get(path)}
      onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}
    />
  );
}

export default function MarketReadPage({ active }) {
  const [state, dispatch] = useStore();
  const c = state.bid.conditions;
  const rootRef = useRef(null);
  useUniformRowWidths(rootRef);

  const confRef = useRef(c.confidence);
  confRef.current = c.confidence;

  useEffect(() => {
    registerConfidenceReader(() => confRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) window._renderPipelineHint?.();
  }, [active]);

  const get = (path) => {
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-market" ref={rootRef}>
      <div className="page-hdr">
        <div><div className="page-title">Market Read</div><div className="page-sub">Price-driving judgement: read the market now that the job's scope and cost are known</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('output')}>← Back</button>
          {/* Deliberate send: this is the one conscious hand-off of the bid
              to the AI agent. It runs the calculation + launches the agent
              (window.runCalculation), then opens Bid Strategy to show the
              result. Navigating to Bid Strategy any other way no longer
              pushes anything to the agent. */}
          <button className="btn btn-primary" onClick={() => { window.runCalculation?.(); window.goto('agent'); }}>Send to Agent →</button>
        </div>
      </div>

      <div className="section-label" style={{ marginBottom: 10 }}>Estimator confidence</div>
      <div className="conf-row" style={{ marginBottom: 20, maxWidth: 500 }}>
        <button
          className={'conf-btn' + (c.confidence === 'hi' ? ' hi' : '')}
          id="c-hi"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'hi' })}
        >High, straightforward</button>
        <button
          className={'conf-btn' + (c.confidence === 'md' ? ' md' : '')}
          id="c-md"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'md' })}
        >Medium, some unknowns</button>
        <button
          className={'conf-btn' + (c.confidence === 'lo' ? ' lo' : '')}
          id="c-lo"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'lo' })}
        >Low, significant risk</button>
      </div>
      <div className="field"><span className="lbl">Estimator notes</span>
        <textarea
          id="cond-notes"
          style={{ minHeight: 100 }}
          placeholder="Gut feelings, GC history, site concerns, anything not captured above…"
          value={c.notes}
          onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'notes'], value: e.target.value })}
        />
      </div>

      <div className="divider" style={{ marginTop: 24 }} />
      <div className="section-label">Market + competitive intelligence</div>

      <div className="tray">
        <div className="tray-cols">
          <div className="tray-col">
            <div className="sub-lbl" style={{ marginTop: 0 }}>Market signals</div>
            <SelectRow id="intel-crew" name="Crew availability" tip="Tight crews = higher margin target; agent uses this to set pricing floor" path={['intelligence', 'crewAvailability']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'full', label: 'Fully available' },
                { value: 'partial', label: 'Partially booked' },
                { value: 'tight', label: 'Nearly full' }
              ]} />
            {/* Pipeline pressure: no .info tooltip like its siblings — the
                live #pipeline-count-hint span (js/ui.js's
                _renderPipelineHint(), see file header) has to stay a real,
                visible DOM node, not text inside a data-tip attribute. The
                static explanation still becomes a tooltip; only the
                dynamic count keeps the old .rhint line. */}
            <div>
              <div className="rr">
                <div className="rr-l">
                  <span className="rr-name">Pipeline pressure</span>
                  <span className="info" data-tip="Direct signal on aggressiveness; weighed heavily against the final bid.">i</span>
                </div>
                <select id="intel-pipeline" className="rr-select" value={get(['intelligence', 'pipelinePressure'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'intelligence', 'pipelinePressure'], value: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="need">Need this job</option>
                  <option value="neutral">Neutral</option>
                  <option value="pass">Can afford to pass</option>
                </select>
              </div>
              <div className="rhint" style={{ marginTop: -2, marginBottom: 8 }}><span id="pipeline-count-hint" /></div>
            </div>
            <SelectRow id="intel-material-trend" name="Material price trend" tip="Rising trend may warrant per-line rate escalation or higher contingency" path={['intelligence', 'materialTrend']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'stable', label: 'Stable' },
                { value: 'rising', label: 'Rising' },
                { value: 'falling', label: 'Falling' }
              ]} />
            <SelectRow id="intel-gc-rel" name="GC relationship" tip="Strong relationships reduce payment risk and may justify tighter margin" path={['intelligence', 'gcRelationship']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'strong', label: 'Strong' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'new', label: 'New' },
                { value: 'difficult', label: 'Difficult' }
              ]} />
            <SelectRow id="intel-gc-price" name="GC price sensitivity" tip="Quality-focused GCs allow more margin; lowest-price GCs require sharp bids" path={['intelligence', 'gcPriceSensitivity']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'lowest', label: 'Always lowest price' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'quality', label: 'Values quality' }
              ]} />
          </div>
          <div className="tray-col">
            <div className="sub-lbl" style={{ marginTop: 0 }}>Competitive signals</div>
            <SelectRow id="intel-competition" name="Competition level" tip="More competition = tighter spread; agent adjusts recommended price accordingly" path={['intelligence', 'competitionLevel']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'light', label: 'Light (1–2 bidders)' },
                { value: 'moderate', label: 'Moderate (3–4)' },
                { value: 'heavy', label: 'Heavy (5+)' },
                { value: 'unknown', label: 'Unknown' }
              ]} />
            <SelectRow id="intel-edge" name="Dirigo's edge" tip="Self-assessed fit; strong edge supports premium pricing over competitors" path={['intelligence', 'dirigoEdge']} get={get} dispatch={dispatch}
              options={[
                { value: '', label: 'Select…' },
                { value: 'strong', label: "Strong, we're best fit" },
                { value: 'neutral', label: 'Neutral' },
                { value: 'weak', label: 'Weak, others better positioned' }
              ]} />
          </div>
        </div>
      </div>

      {/* Known competitors — free text, deliberately NOT migrated into
          the tray (design doc §15: this is a numeric/select playbook, an
          unbounded competitor-name list doesn't fit a uniform-box row). */}
      <div className="flag-card" style={{ marginTop: 20, maxWidth: 500 }}>
        <span className="lbl">Known competitors</span>
        <Field id="intel-competitors" path={['intelligence', 'knownCompetitors']} get={get} dispatch={dispatch} placeholder="e.g. ABC Drywall, Smith & Co." />
        <div className="rhint">Logged for Phase 5B win-rate pattern analysis; not used in current calculation</div>
      </div>
    </div>
  );
}
