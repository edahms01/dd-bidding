// ─────────────────────────────────────────────────────────────────────
// BidsPage.jsx — Phase C 2.5. One list for every bid, replacing the
// separate Dashboard (drafts) and Bid History (submitted) screens.
//
// Two data sources, reconciled in a view layer only — no storage
// migration (the §9.7 assumption, now confirmed): drafts come from
// window.getAllDrafts() (localStorage, synchronous) and paint
// immediately; submitted bids stream in from window.getAllBids() (a
// Netlify function, async) with a loading/error affordance. Each source
// is normalised to one row view-model (draftRow/bidRow) so nested
// project.* and flat project_name/gc/building_type collapse to the same
// shape, then merge-sorted by date. Status is derived, not stored:
// Draft = in dirigo_drafts; Submitted = a bid record with outcome
// 'pending'; Won/Lost = outcome.
//
// Row actions reuse the existing primitives verbatim (switchToDraft /
// duplicateDraft / deleteDraft / deleteBid / updateBid via
// BidUpdateRow), including their confirm() strings. Opening a draft
// still goes through switchToDraft() -> _flushAndSwitch(), so a pending
// autosave on the outgoing draft is flushed first.
// ─────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';
import BidUpdateRow from '../components/BidUpdateRow.jsx';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n) { return (+n).toFixed(1) + '%'; }
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString();
}

function StatusPill({ status }) {
  const map = {
    Draft:     { bg: 'rgba(255,255,255,.04)', bd: 'var(--border)', fg: 'var(--text3)' },
    Submitted: { bg: 'var(--action-dim)', bd: 'var(--action-border)', fg: 'var(--action)' },
    Won:       { bg: 'rgba(58,191,122,.1)', bd: 'rgba(58,191,122,.25)', fg: 'var(--green)' },
    Lost:      { bg: 'rgba(232,92,74,.1)', bd: 'rgba(232,92,74,.25)', fg: 'var(--danger)' }
  };
  const s = map[status] || map.Draft;
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: s.bg, border: '1px solid ' + s.bd, color: s.fg }}>{status}</span>;
}

function draftRow(d) {
  return {
    kind: 'draft', id: d.id,
    name: (d.project && d.project.name) || 'Untitled bid',
    gc: (d.project && d.project.gc) || '',
    buildingType: (d.project && d.project.buildingType) || '',
    dateVal: d.lastModifiedAt || d.createdAt || '',
    amount: null,
    status: 'Draft'
  };
}

function bidRow(b) {
  return {
    kind: 'bid', id: b.bid_id, raw: b,
    name: b.project_name || 'Untitled bid',
    gc: b.gc || '',
    buildingType: b.building_type || '',
    dateVal: b.date_submitted || '',
    amount: b.final_bid || null,
    status: b.outcome === 'won' ? 'Won' : b.outcome === 'lost' ? 'Lost' : 'Submitted'
  };
}

function applyFilters(rows, f) {
  const gc = f.gc.trim().toLowerCase();
  return rows.filter((r) => {
    if (gc && !r.gc.toLowerCase().includes(gc)) return false;
    if (f.status && r.status !== f.status) return false;
    const day = String(r.dateVal || '').slice(0, 10);
    if ((f.from || f.to) && !day) return false;
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    return true;
  });
}

export default function BidsPage({ active }) {
  const [state, dispatch] = useStore();
  const f = state.ui.bidsFilters;
  const [drafts, setDrafts] = useState([]);
  const [bids, setBids] = useState([]);
  const [bidsStatus, setBidsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [openUpdateId, setOpenUpdateId] = useState(null);

  let activeDraftId = null;
  try { activeDraftId = localStorage.getItem('dirigo_active_draft_id'); } catch (e) { /* private mode */ }

  function loadDrafts() {
    setDrafts(Object.values(window.getAllDrafts()));
  }
  async function loadBids() {
    setBidsStatus('loading');
    try {
      setBids(await window.getAllBids());
      setBidsStatus('ready');
    } catch (e) {
      setBidsStatus('error');
    }
  }

  useEffect(() => {
    if (active) { loadDrafts(); loadBids(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Existing specs call window.toggleUpdate(bid_id) directly rather than
  // clicking the button — bridged the same way HistoryPage did.
  useEffect(() => {
    window.toggleUpdate = (id) => setOpenUpdateId((c) => (c === id ? null : id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDuplicate(id) { window.duplicateDraft(id); loadDrafts(); }
  function handleDeleteDraft(id) {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    window.deleteDraft(id);
    loadDrafts();
  }
  async function handleDeleteBid(id) {
    if (!confirm('Delete this bid record? This cannot be undone.')) return;
    try { await window.deleteBid(id); loadBids(); }
    catch (e) { alert('Failed to delete bid — check your connection and try again.'); }
  }

  const rows = [...drafts.map(draftRow), ...bids.map(bidRow)]
    .sort((a, b) => new Date(b.dateVal || 0) - new Date(a.dateVal || 0));
  const shown = applyFilters(rows, f);
  const anyFilter = !!(f.gc || f.status || f.from || f.to);

  // Totals are scoped to the submitted bids in the filtered set (win
  // rate / margin are meaningless for drafts).
  const submitted = shown.filter((r) => r.kind === 'bid');
  const decided = submitted.filter((r) => r.status === 'Won' || r.status === 'Lost');
  const won = submitted.filter((r) => r.status === 'Won');
  const winRate = decided.length > 0 ? Math.round((won.length / decided.length) * 100) : 0;
  const wonMargin = won.filter((r) => r.raw.final_bid > 0 && r.raw.direct_cost > 0);
  const avgMargin = wonMargin.length > 0
    ? wonMargin.reduce((s, r) => s + ((r.raw.final_bid - r.raw.direct_cost) / r.raw.final_bid * 100), 0) / wonMargin.length
    : null;
  const draftCount = shown.filter((r) => r.kind === 'draft').length;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-bids" data-noautosave>
      <div className="page-hdr">
        <div>
          <div className="page-title">Bids</div>
          <div className="page-sub">Every bid — in progress, submitted, and decided</div>
        </div>
        <div className="page-actions">
          {/* 8.4 — the bid/no-bid gate is reached only from here, not the
              9-step flow. */}
          <button id="bid-decision-btn" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'biddecision' })}>Bid / no-bid gate</button>
        </div>
      </div>

      {bidsStatus === 'error' && (
        <div className="empty-state" style={{ color: 'var(--danger)' }}>
          Couldn't load submitted bids — check your connection. Drafts below are still current.
        </div>
      )}

      <div className="totals-bar" style={{ marginBottom: 24 }}>
        <div className="total-item"><div className="total-val">{submitted.length}</div><div className="total-lbl">Bids</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">{decided.length > 0 ? winRate + '%' : '—'}</div><div className="total-lbl">Win rate</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">{won.length}</div><div className="total-lbl">Won</div></div>
        <div className="total-div" />
        <div className="total-item"><div className={'total-val' + (avgMargin !== null ? ' green' : '')}>{avgMargin !== null ? fmtPct(avgMargin) : '—'}</div><div className="total-lbl">Avg margin (wins)</div></div>
      </div>

      <div className="section-block">
        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span>All bids{draftCount > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text3)', fontSize: 11 }}> · {draftCount} draft{draftCount === 1 ? '' : 's'}</span>}</span>
          {anyFilter && rows.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>Showing {shown.length} of {rows.length}</span>
          )}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Project</th><th>GC</th><th>Building type</th><th>Amount</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && bidsStatus === 'loading' ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No bids yet — start one with “New Bid”.</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No bids match the current filter.</td></tr>
              ) : shown.map((r) => (
                <Fragment key={r.kind + '-' + r.id}>
                  <tr>
                    <td style={{ fontWeight: 500 }}>
                      {r.name}
                      {r.kind === 'draft' && r.id === activeDraftId && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--action)', border: '1px solid var(--action-border)', borderRadius: 8, padding: '1px 6px' }}>current</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text2)' }}>{r.gc || '—'}</td>
                    <td style={{ color: 'var(--text2)' }}>{r.buildingType || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount ? 'var(--green)' : 'var(--text3)' }}>{r.amount ? fmtCost(r.amount) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtDate(r.dateVal)}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.kind === 'draft' ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => window.switchToDraft(r.id)}>Open</button>
                          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDuplicate(r.id)}>Duplicate</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 4 }} onClick={() => handleDeleteDraft(r.id)}>×</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setOpenUpdateId((c) => (c === r.id ? null : r.id))}>Update</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 4 }} onClick={() => handleDeleteBid(r.id)}>×</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {r.kind === 'bid' && (
                    <BidUpdateRow bid={r.raw} open={openUpdateId === r.id} onSaved={(rl = true) => { setOpenUpdateId(null); if (rl) loadBids(); }} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
