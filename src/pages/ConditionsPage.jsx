// ─────────────────────────────────────────────────────────────────────
// ConditionsPage.jsx — "Site Conditions" (Phase C 2.1). The
// cost-driving, early half of the old Conditions page: height zones,
// site flags, waste-factor override, delivery trips.
//
// The price-driving half — estimator confidence + notes and the
// "Market + competitive intelligence" block — split out to
// MarketReadPage.jsx (a late step, after Cost Summary). This is a
// UI/routing split only: `confidence`/`notes` still live in the
// bid.conditions slice, `intelligence` still its own slice, so the
// export payload is unchanged. The confidence-reader and pipeline-hint
// on-become-active effects moved to MarketReadPage with their targets.
//
// Curved-walls-LF / phase-count visibility is native React conditional
// rendering (curvedWalls === 'yes' / phasedWork === 'yes').
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

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

  const get = (path) => {
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-conditions">
      <div className="page-hdr">
        <div><div className="page-title">Site Conditions</div><div className="page-sub">Site facts that drive labor rates, equipment needs, and waste</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('project')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('assemblies')}>Next: Assemblies →</button>
        </div>
      </div>

      <div className="section-label">Height zones</div>
      <div className="grid g3" style={{ marginBottom: 24 }}>
        <div className="field"><span className="lbl">Max ceiling height (ft)</span><Field id="cond-maxht" type="number" path={['conditions', 'maxHt']} get={get} dispatch={dispatch} placeholder="e.g. 24" /></div>
        <div className="field"><span className="lbl">SF above 12 ft</span><Field id="cond-sf12" type="number" path={['conditions', 'sfAbove12']} get={get} dispatch={dispatch} placeholder="sq ft, triggers lift adder" /></div>
        <div className="field"><span className="lbl">SF above 20 ft</span><Field id="cond-sf20" type="number" path={['conditions', 'sfAbove20']} get={get} dispatch={dispatch} placeholder="sq ft, high-lift zone" /></div>
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
          <Field id="cond-waste" type="number" path={['conditions', 'wastePct']} get={get} dispatch={dispatch} placeholder="%, blank = default (10%)" />
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 20 }}>
        <div className="field"><span className="lbl">Estimated delivery trips</span><Field id="cond-trips" type="number" path={['conditions', 'trips']} get={get} dispatch={dispatch} placeholder="e.g. 4" /></div>
      </div>
    </div>
  );
}
