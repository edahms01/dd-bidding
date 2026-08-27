// ─────────────────────────────────────────────────────────────────────
// ConditionsPage.jsx — full React port of index.html's #page-conditions
// (the former <template id="legacy-tpl-conditions">), which also carries
// the "Market + competitive intelligence" section (same tab, same page
// in the original markup — intelligence is a separate bid.intelligence
// slice in the reducer, same as it's a separate collectFormData() key,
// but there is no separate Intelligence tab to put it on).
//
// Curved-walls-LF / phase-count visibility is native React conditional
// rendering here (curvedWalls === 'yes' / phasedWork === 'yes') instead
// of the original's imperative style.display toggling.
//
// Confidence buttons dispatch straight into the reducer instead of
// calling the old setConf(); registerConfidenceReader() (src/state/
// bridges.js) exposes the live value back out as window.__getConfidence
// for collectFormData() (js/state.js) and every other legacy caller.
//
// #pipeline-count-hint stays static JSX + external mutation (js/ui.js's
// _renderPipelineHint(), called from the effect below on becoming
// active) — same "static JSX = safe for external mutation" pattern as
// the header's autosave indicator and project badge (see CLAUDE.md).
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

export default function ConditionsPage({ active }) {
  const [state, dispatch] = useStore();
  const c = state.bid.conditions;
  const intel = state.bid.intelligence;

  // Always-current ref so the registered getter never returns a stale
  // closure value — registered once on mount, not re-registered every
  // render (registerConfidenceReader itself is idempotent either way,
  // but there's no reason to reassign window.__getConfidence on every
  // keystroke elsewhere on the page).
  const confRef = useRef(c.confidence);
  confRef.current = c.confidence;

  useEffect(() => {
    registerConfidenceReader(() => confRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Matches goto()'s old `if (id === 'conditions') _renderPipelineHint()`
  // — refresh the hint every time this page becomes active, not just
  // once on first mount (same pattern as RatesPage's template refetch).
  useEffect(() => {
    if (active) window._renderPipelineHint?.();
  }, [active]);

  const get = (path) => {
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-conditions">
      <div className="page-hdr">
        <div><div className="page-title">Conditions</div><div className="page-sub">Factors that affect labor rates, equipment needs, and contingency</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('project')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('rates')}>Next: Rates →</button>
        </div>
      </div>

      <div className="section-label">Height zones</div>
      <div className="grid g3" style={{ marginBottom: 24 }}>
        <div className="field"><span className="lbl">Max ceiling height (ft)</span><Field id="cond-maxht" type="number" path={['conditions', 'maxHt']} get={get} dispatch={dispatch} placeholder="e.g. 24" /></div>
        <div className="field"><span className="lbl">SF above 12 ft</span><Field id="cond-sf12" type="number" path={['conditions', 'sfAbove12']} get={get} dispatch={dispatch} placeholder="sq ft — triggers lift adder" /></div>
        <div className="field"><span className="lbl">SF above 20 ft</span><Field id="cond-sf20" type="number" path={['conditions', 'sfAbove20']} get={get} dispatch={dispatch} placeholder="sq ft — high-lift zone" /></div>
      </div>

      <div className="section-label">Site flags</div>
      <div className="flag-grid">
        <div className="flag-card">
          <span className="lbl">Curved walls</span>
          <Select id="f-curved" path={['conditions', 'curvedWalls']} get={get} dispatch={dispatch}>
            <option value="no">No</option><option value="yes">Yes</option>
          </Select>
          {c.curvedWalls === 'yes' && (
            <Field id="f-curved-lf" type="number" path={['conditions', 'curvedWallsLF']} get={get} dispatch={dispatch} placeholder="LF of curved walls" />
          )}
        </div>
        <div className="flag-card">
          <span className="lbl">Exterior exposure</span>
          <Select id="f-exterior" path={['conditions', 'exteriorExposure']} get={get} dispatch={dispatch}>
            <option value="no">No</option><option value="yes">Yes</option>
          </Select>
        </div>
        <div className="flag-card">
          <span className="lbl">Phased work</span>
          <Select id="f-phase" path={['conditions', 'phasedWork']} get={get} dispatch={dispatch}>
            <option value="no">No</option><option value="yes">Yes</option>
          </Select>
          {c.phasedWork === 'yes' && (
            <Field id="f-phase-n" type="number" path={['conditions', 'phaseCount']} get={get} dispatch={dispatch} placeholder="Number of phases" />
          )}
        </div>
        <div className="flag-card">
          <span className="lbl">Access difficulty</span>
          <Select id="f-access" path={['conditions', 'accessDifficulty']} get={get} dispatch={dispatch}>
            <option value="normal">Normal</option><option value="restricted">Restricted</option>
          </Select>
        </div>
        <div className="flag-card">
          <span className="lbl">Parking / unloading</span>
          <Select id="f-parking" path={['conditions', 'parking']} get={get} dispatch={dispatch}>
            <option value="yes">Available</option><option value="no">Restricted</option>
          </Select>
        </div>
        <div className="flag-card">
          <span className="lbl">Waste factor override</span>
          <Field id="cond-waste" type="number" path={['conditions', 'wastePct']} get={get} dispatch={dispatch} placeholder="% — blank = default (10%)" />
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="field"><span className="lbl">Estimated delivery trips</span><Field id="cond-trips" type="number" path={['conditions', 'trips']} get={get} dispatch={dispatch} placeholder="e.g. 4" /></div>
      </div>

      <div className="divider" />
      <div className="section-label" style={{ marginBottom: 10 }}>Estimator confidence</div>
      <div className="conf-row" style={{ marginBottom: 20, maxWidth: 500 }}>
        <button
          className={'conf-btn' + (c.confidence === 'hi' ? ' hi' : '')}
          id="c-hi"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'hi' })}
        >High — straightforward</button>
        <button
          className={'conf-btn' + (c.confidence === 'md' ? ' md' : '')}
          id="c-md"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'md' })}
        >Medium — some unknowns</button>
        <button
          className={'conf-btn' + (c.confidence === 'lo' ? ' lo' : '')}
          id="c-lo"
          onClick={() => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'confidence'], value: 'lo' })}
        >Low — significant risk</button>
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
          <div className="rhint">Tight crews = higher margin target — agent uses this to set pricing floor</div>
        </div>
        <div className="flag-card">
          <span className="lbl">Pipeline pressure</span>
          <Select id="intel-pipeline" path={['intelligence', 'pipelinePressure']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="need">Need this job</option>
            <option value="neutral">Neutral</option>
            <option value="pass">Can afford to pass</option>
          </Select>
          <div className="rhint">Direct signal on aggressiveness — agent weighs this heavily against final bid</div>
          <div className="rhint" id="pipeline-count-hint" />
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

      <div className="sub-lbl">Competitive signals</div>
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
          <div className="rhint">Logged for Phase 5B win-rate pattern analysis — not used in current calculation</div>
        </div>
        <div className="flag-card">
          <span className="lbl">Dirigo's edge</span>
          <Select id="intel-edge" path={['intelligence', 'dirigoEdge']} get={get} dispatch={dispatch}>
            <option value="">Select…</option>
            <option value="strong">Strong — we're best fit</option>
            <option value="neutral">Neutral</option>
            <option value="weak">Weak — others better positioned</option>
          </Select>
          <div className="rhint">Self-assessed fit — strong edge supports premium pricing over competitors</div>
        </div>
      </div>
    </div>
  );
}
