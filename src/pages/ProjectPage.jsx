// ─────────────────────────────────────────────────────────────────────
// ProjectPage.jsx — full React port of index.html's #page-project
// (the former <template id="legacy-tpl-project">). Same targeted-write
// pattern as RatesPage: real controlled inputs against the shared
// reducer, no innerHTML replacement.
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

const SCOPE_PILLS = ['Metal framing', 'Drywall', 'Plastering', 'External wall', 'Subcontractors'];

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

export default function ProjectPage({ active }) {
  const [state, dispatch] = useStore();
  const p = state.bid.project;

  const get = (path) => {
    let v = state.bid;
    for (const key of path) v = v?.[key];
    return v ?? '';
  };

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-project">
      <div className="page-hdr">
        <div><div className="page-title">Project</div><div className="page-sub">Basic info and scope for this bid</div></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => window.goto('conditions')}>Next: Conditions →</button></div>
      </div>
      <div className="grid g3">
        <div className="field"><span className="lbl">Project name</span><Field id="proj-name" path={['project', 'name']} get={get} dispatch={dispatch} placeholder="e.g. 400 Main St Office Tower" /></div>
        <div className="field"><span className="lbl">General contractor</span><Field id="proj-gc" path={['project', 'gc']} get={get} dispatch={dispatch} placeholder="GC company name" /></div>
        <div className="field"><span className="lbl">Bid due date</span><Field id="proj-bid" type="date" path={['project', 'bidDate']} get={get} dispatch={dispatch} /></div>
      </div>
      <div className="grid g3">
        <div className="field"><span className="lbl">Project address</span><Field id="proj-addr" path={['project', 'address']} get={get} dispatch={dispatch} placeholder="Street, city, state" /></div>
        <div className="field"><span className="lbl">Building type</span>
          <select id="proj-type" value={get(['project', 'buildingType'])} onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'project', 'buildingType'], value: e.target.value })}>
            <option value="">Select…</option>
            <option>Office</option><option>Retail</option><option>Healthcare</option>
            <option>Education</option><option>Hospitality</option><option>Mixed use</option><option>Other</option>
          </select>
        </div>
        <div className="field"><span className="lbl">Drawing set ref</span><Field id="proj-drawings" path={['project', 'drawingsRef']} get={get} dispatch={dispatch} placeholder="e.g. Rev B — 2024-03-15" /></div>
      </div>
      <div className="grid g3">
        <div className="field"><span className="lbl">Est. start date</span><Field id="proj-start" type="date" path={['project', 'startDate']} get={get} dispatch={dispatch} /></div>
        <div className="field"><span className="lbl">Duration (weeks)</span><Field id="proj-dur" type="number" path={['project', 'durationWeeks']} get={get} dispatch={dispatch} placeholder="e.g. 12" /></div>
        <div className="field"><span className="lbl">Number of floors</span><Field id="proj-floors" type="number" path={['project', 'floors']} get={get} dispatch={dispatch} placeholder="e.g. 8" /></div>
      </div>
      <div className="divider" />
      <div className="section-label">Scope inclusions</div>
      <div className="pills" style={{ marginBottom: 20 }}>
        {SCOPE_PILLS.map((label) => (
          <div
            key={label}
            className={'pill' + (p.scope.includes(label) ? ' on' : '')}
            data-scope={label}
            onClick={() => dispatch({ type: 'TOGGLE_SCOPE', label })}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="field"><span className="lbl">Exclusions / notes</span>
        <textarea
          id="proj-exclusions"
          placeholder="e.g. Excludes ACT ceiling grid. GC supplying blocking."
          value={p.exclusions}
          onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', 'project', 'exclusions'], value: e.target.value })}
        />
      </div>
    </div>
  );
}
