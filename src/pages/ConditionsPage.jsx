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
// UI-fixes batch (2026-09-05): migrated from the old .flag-card/
// .field-with-sfx dialect to the shared .rr-*/.tray system (see
// RatesPage.jsx's own migration note + site-conditions-redesign-v2.html
// / bid-iq-compact-ui-design-system-v2.md). One tray ("Site Conditions"
// is one thematic group), 2 hand-assembled columns.
//
// Real behavior change, not just visual: Curved-walls-LF / phase-count
// used to be conditionally MOUNTED (`{c.curvedWalls==='yes' && <Field/>}`)
// — the new .rr-connected animated expand/collapse needs the child row
// ALWAYS mounted, with only an `expanded` class toggling visibility, or
// there's nothing to animate open from. Reducer state (SET_FIELD) already
// holds curvedWallsLF/phaseCount regardless of DOM presence, so this is a
// safe swap — no value is lost when a row collapses.
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';
import { useUniformRowWidths } from '../state/useUniformRowWidths.js';
import { useRef } from 'react';
import { RRRow, SelectRow, ConnectedRow } from '../components/RRRow.jsx';

export default function ConditionsPage({ active }) {
  const [state, dispatch] = useStore();
  const c = state.bid.conditions;
  const rootRef = useRef(null);
  useUniformRowWidths(rootRef);

  const get = (path) => {
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-conditions" ref={rootRef}>
      <div className="page-hdr">
        <div><div className="page-title">Site Conditions</div><div className="page-sub">Site facts that drive labor rates, equipment needs, and waste</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('project')}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.goto('assemblies')}>Next: Assemblies →</button>
        </div>
      </div>

      <div className="tray">
        <div className="tray-hdr">Site Conditions</div>
        <div className="tray-cols">
          <div className="tray-col">
            <div className="sub-lbl">Site flags</div>
            <ConnectedRow
              name="Curved walls" expanded={c.curvedWalls === 'yes'}
              selectId="f-curved" selectPath={['conditions', 'curvedWalls']} get={get} dispatch={dispatch}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
              childId="f-curved-lf" childPath={['conditions', 'curvedWallsLF']} childPlaceholder="length" childSfx="LF"
            />
            <ConnectedRow
              name="Phased work" expanded={c.phasedWork === 'yes'}
              selectId="f-phase" selectPath={['conditions', 'phasedWork']} get={get} dispatch={dispatch}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
              childId="f-phase-n" childPath={['conditions', 'phaseCount']} childPlaceholder="count" childSfx="phases"
            />
            <SelectRow
              id="f-exterior" name="Exterior exposure" path={['conditions', 'exteriorExposure']} get={get} dispatch={dispatch}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            />
            <SelectRow
              id="f-access" name="Access difficulty" path={['conditions', 'accessDifficulty']} get={get} dispatch={dispatch}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'restricted', label: 'Restricted' }]}
            />
            <SelectRow
              id="f-parking" name="Parking / Unloading" path={['conditions', 'parking']} get={get} dispatch={dispatch}
              options={[{ value: 'yes', label: 'Available' }, { value: 'no', label: 'Restricted' }]}
            />
            <RRRow name="Waste factor override" sfx="%"
              tip="Job-wide waste % on board material. Blank = 10%. Individual assemblies can override this on the Assemblies tab."
              valueEl={
                <input id="cond-waste" className="rr-val pct" type="number" placeholder="10"
                  value={get(['conditions', 'wastePct'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'wastePct'], value: e.target.value })} />
              } />
          </div>
          <div className="tray-col">
            <div className="sub-lbl">Height zones</div>
            <RRRow name="Max ceiling height" sfx="ft"
              valueEl={
                <input id="cond-maxht" className="rr-val qty" type="number" placeholder="24"
                  value={get(['conditions', 'maxHt'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'maxHt'], value: e.target.value })} />
              } />
            <RRRow name="SF above 12 ft" sfx="sq ft"
              valueEl={
                <input id="cond-sf12" className="rr-val qty" type="number" placeholder="0"
                  value={get(['conditions', 'sfAbove12'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'sfAbove12'], value: e.target.value })} />
              } />
            <RRRow name="SF above 20 ft" sfx="sq ft"
              valueEl={
                <input id="cond-sf20" className="rr-val qty" type="number" placeholder="0"
                  value={get(['conditions', 'sfAbove20'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'sfAbove20'], value: e.target.value })} />
              } />
          </div>
          <div className="tray-col">
            <div className="sub-lbl">Delivery</div>
            <RRRow name="Estimated delivery trips" sfx="trips"
              tip="Used to calculate delivery cost on the Rates tab."
              valueEl={
                <input id="cond-trips" className="rr-val qty" type="number" placeholder="4"
                  value={get(['conditions', 'trips'])}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'conditions', 'trips'], value: e.target.value })} />
              } />
          </div>
        </div>
      </div>
    </div>
  );
}
