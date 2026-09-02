// ─────────────────────────────────────────────────────────────────────
// BidsToolbar.jsx — Phase C 2.4 + 2.5. Renders in the #app-tabs slot
// while activeSection === 'bids', so the frame stays stable instead of
// the step bar vanishing when you leave the workflow.
//
// Filter controls only — state lives in state.ui.bidsFilters (store.jsx)
// and BidsPage.jsx does the filtering. `status` covers the unified
// list's derived Draft / Submitted / Won / Lost; `gc` is a
// case-insensitive substring; from/to bracket each row's date (a draft's
// last-modified date or a submitted bid's submitted date).
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

export default function BidsToolbar() {
  const [state, dispatch] = useStore();
  const f = state.ui.bidsFilters;
  const set = (key, value) => dispatch({ type: 'SET_BIDS_FILTER', key, value });
  const anyActive = !!(f.gc || f.status || f.from || f.to);

  return (
    <div className="bids-toolbar" id="bids-toolbar" data-noautosave>
      <span className="ht-label">Filter</span>
      <input
        id="hf-gc"
        className="ht-input"
        type="text"
        placeholder="GC name…"
        value={f.gc}
        onChange={(e) => set('gc', e.target.value)}
      />
      <select id="hf-status" className="ht-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
        <option value="">All statuses</option>
        <option value="Draft">Draft</option>
        <option value="Submitted">Submitted</option>
        <option value="Won">Won</option>
        <option value="Lost">Lost</option>
      </select>
      <span className="ht-sep">Date</span>
      <input id="hf-from" className="ht-input ht-date" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="Date from" />
      <span className="ht-dash">–</span>
      <input id="hf-to" className="ht-input ht-date" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="Date to" />
      <button
        id="hf-clear"
        className="btn btn-ghost btn-sm"
        style={{ marginLeft: 'auto', visibility: anyActive ? 'visible' : 'hidden' }}
        onClick={() => dispatch({ type: 'CLEAR_BIDS_FILTERS' })}
      >
        Clear filters
      </button>
    </div>
  );
}
