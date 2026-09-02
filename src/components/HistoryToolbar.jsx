// ─────────────────────────────────────────────────────────────────────
// HistoryToolbar.jsx — Phase C 2.4. Renders in the same slot the
// workflow step bar (#app-tabs) occupies, but while
// activeSection === 'history'. Before this, that slot was simply empty
// on History, so the app read as a different application (the decision
// record's exact wording). Now the frame stays: header, left nav, and a
// toolbar band are all still there.
//
// Filter controls only — the state lives in state.ui.historyFilters
// (store.jsx) and HistoryPage.jsx does the actual filtering of both its
// table and its totals bar. GC is a case-insensitive substring match;
// outcome is an exact match ('' = all); from/to bracket date_submitted
// (a YYYY-MM-DD string, so plain string comparison is correct).
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

export default function HistoryToolbar() {
  const [state, dispatch] = useStore();
  const f = state.ui.historyFilters;
  const set = (key, value) => dispatch({ type: 'SET_HISTORY_FILTER', key, value });
  const anyActive = !!(f.gc || f.outcome || f.from || f.to);

  return (
    <div className="history-toolbar" id="history-toolbar">
      <span className="ht-label">Filter</span>
      <input
        id="hf-gc"
        className="ht-input"
        type="text"
        placeholder="GC name…"
        value={f.gc}
        onChange={(e) => set('gc', e.target.value)}
      />
      <select id="hf-outcome" className="ht-input" value={f.outcome} onChange={(e) => set('outcome', e.target.value)}>
        <option value="">All outcomes</option>
        <option value="pending">Pending</option>
        <option value="won">Won</option>
        <option value="lost">Lost</option>
      </select>
      <span className="ht-sep">Submitted</span>
      <input id="hf-from" className="ht-input ht-date" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="Submitted from" />
      <span className="ht-dash">–</span>
      <input id="hf-to" className="ht-input ht-date" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="Submitted to" />
      <button
        id="hf-clear"
        className="btn btn-ghost btn-sm"
        style={{ marginLeft: 'auto', visibility: anyActive ? 'visible' : 'hidden' }}
        onClick={() => dispatch({ type: 'CLEAR_HISTORY_FILTERS' })}
      >
        Clear filters
      </button>
    </div>
  );
}
