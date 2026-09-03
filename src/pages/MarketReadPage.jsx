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
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store.jsx';
import { registerConfidenceReader } from '../state/bridges.js';

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

function Select({ path, dispatch, get, id, children }) {
  return (
    <select id={id} value={get(path)} onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}>
      {children}
    </select>
  );
}

export default function MarketReadPage({ active }) {
  const [state, dispatch] = useStore();
  const c = state.bid.conditions;

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
    <div className={'page' + (active ? ' active' : '')} id="page-market">
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

      <div className="sub-lbl" style={{ marginTop: 4 }}>Market signals</div>
      <div className="flag-grid">
        <div className="flag-card">
          <span className="lbl">Crew availability</span>
          <Select id="intel-crew" path={['intelligence', 'crewAvailability']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="full">Fully available</option>
            <option value="partial">Partially booked</option>
            <option value="tight">Nearly full</option>
          </Select>
          <div className="rhint">Tight crews = higher margin target; agent uses this to set pricing floor</div>
        </div>
        <div className="flag-card">
          <span className="lbl">Pipeline pressure</span>
          <Select id="intel-pipeline" path={['intelligence', 'pipelinePressure']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="need">Need this job</option>
            <option value="neutral">Neutral</option>
            <option value="pass">Can afford to pass</option>
          </Select>
          <div className="rhint">Direct signal on aggressiveness; weighed heavily against the final bid. <span id="pipeline-count-hint" /></div>
        </div>
        <div className="flag-card">
          <span className="lbl">Material price trend</span>
          <Select id="intel-material-trend" path={['intelligence', 'materialTrend']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="stable">Stable</option>
            <option value="rising">Rising</option>
            <option value="falling">Falling</option>
          </Select>
          <div className="rhint">Rising trend may warrant per-line rate escalation or higher contingency</div>
        </div>
        <div className="flag-card">
          <span className="lbl">GC relationship</span>
          <Select id="intel-gc-rel" path={['intelligence', 'gcRelationship']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="strong">Strong</option>
            <option value="neutral">Neutral</option>
            <option value="new">New</option>
            <option value="difficult">Difficult</option>
          </Select>
          <div className="rhint">Strong relationships reduce payment risk and may justify tighter margin</div>
        </div>
        <div className="flag-card">
          <span className="lbl">GC price sensitivity</span>
          <Select id="intel-gc-price" path={['intelligence', 'gcPriceSensitivity']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="lowest">Always lowest price</option>
            <option value="balanced">Balanced</option>
            <option value="quality">Values quality</option>
          </Select>
          <div className="rhint">Quality-focused GCs allow more margin; lowest-price GCs require sharp bids</div>
        </div>
      </div>

      <div className="sub-lbl" style={{ marginTop: 28 }}>Competitive signals</div>
      <div className="flag-grid">
        <div className="flag-card">
          <span className="lbl">Competition level</span>
          <Select id="intel-competition" path={['intelligence', 'competitionLevel']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="light">Light (1–2 bidders)</option>
            <option value="moderate">Moderate (3–4)</option>
            <option value="heavy">Heavy (5+)</option>
            <option value="unknown">Unknown</option>
          </Select>
          <div className="rhint">More competition = tighter spread; agent adjusts recommended price accordingly</div>
        </div>
        <div className="flag-card">
          <span className="lbl">Known competitors</span>
          <Field id="intel-competitors" path={['intelligence', 'knownCompetitors']} get={get} dispatch={dispatch} placeholder="e.g. ABC Drywall, Smith & Co." />
          <div className="rhint">Logged for Phase 5B win-rate pattern analysis; not used in current calculation</div>
        </div>
        <div className="flag-card">
          <span className="lbl">Dirigo's edge</span>
          <Select id="intel-edge" path={['intelligence', 'dirigoEdge']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="strong">Strong, we're best fit</option>
            <option value="neutral">Neutral</option>
            <option value="weak">Weak, others better positioned</option>
          </Select>
          <div className="rhint">Self-assessed fit; strong edge supports premium pricing over competitors</div>
        </div>
      </div>
    </div>
  );
}
