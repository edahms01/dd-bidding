// ─────────────────────────────────────────────────────────────────────
// HistoryPage.jsx — full React port of js/ui.js's renderHistory() +
// toggleUpdate()/saveUpdate()/deleteBidRecord(). A genuine reimplementation,
// not a wrapper around the legacy functions — those write raw HTML
// strings via element.innerHTML, which would fight a React-owned
// container the same way a controlled input fights an external .value
// set (React re-renders this component from its own JSX on any state
// change and would clobber whatever the legacy innerHTML write left
// behind). This is exactly the "innerHTML-replace-to-component"
// conversion pattern the spike exists to validate.
//
// Refetches on every becomes-active transition, matching the original
// showHistory() calling renderHistory() fresh every left-nav click, not
// just once.
// ─────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useState } from 'react';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n) { return (+n).toFixed(1) + '%'; }

function OutcomePill({ outcome }) {
  if (outcome === 'won') return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(58,191,122,.1)', border: '1px solid rgba(58,191,122,.25)', color: 'var(--green)' }}>Won</span>;
  if (outcome === 'lost') return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(232,92,74,.1)', border: '1px solid rgba(232,92,74,.25)', color: 'var(--danger)' }}>Lost</span>;
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text3)' }}>Pending</span>;
}

function ConfLabel({ conf }) {
  if (conf === 'hi') return <span style={{ color: 'var(--green)' }}>High</span>;
  if (conf === 'md') return <span style={{ color: 'var(--status-warn)' }}>Medium</span>;
  if (conf === 'lo') return <span style={{ color: 'var(--danger)' }}>Low</span>;
  return <span style={{ color: 'var(--text3)' }}>—</span>;
}

function UpdateRow({ bid, open, onSaved }) {
  const [outcome, setOutcome] = useState(bid.outcome || 'pending');
  const [winner, setWinner] = useState(bid.competitor_who_won || '');
  const [winBid, setWinBid] = useState(bid.winning_bid || '');
  const [actualLabor, setActualLabor] = useState(bid.actual_labor_cost ?? '');
  const [actualMaterial, setActualMaterial] = useState(bid.actual_material_cost ?? '');
  const [notes, setNotes] = useState(bid.notes || '');

  async function save() {
    const parsedLabor = parseFloat(actualLabor);
    const parsedMaterial = parseFloat(actualMaterial);
    try {
      const bids = await window.getAllBids();
      const rec = bids.find((b) => b.bid_id === bid.bid_id);
      const variances = window.computeCostVariances({
        record: rec,
        actualLabor: isNaN(parsedLabor) ? null : parsedLabor,
        actualMaterial: isNaN(parsedMaterial) ? null : parsedMaterial
      });
      await window.updateBid(bid.bid_id, {
        outcome,
        competitor_who_won: winner.trim() || null,
        winning_bid: parseFloat(winBid) ? Math.round(parseFloat(winBid)) : null,
        actual_labor_cost: isNaN(parsedLabor) ? null : Math.round(parsedLabor),
        actual_material_cost: isNaN(parsedMaterial) ? null : Math.round(parsedMaterial),
        ...variances,
        notes: notes.trim()
      });
      onSaved();
    } catch (e) {
      alert('Failed to save update — check your connection and try again.');
    }
  }

  return (
    <tr id={'uprow-' + bid.bid_id} style={{ display: open ? 'table-row' : 'none', background: 'var(--surface2)' }}>
      <td colSpan={8} style={{ padding: '14px 12px' }}>
        <div className="grid g6" style={{ marginBottom: 12 }}>
          <div className="field">
            <span className="lbl">Outcome</span>
            <select id={'uf-outcome-' + bid.bid_id} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div className="field"><span className="lbl">Competitor who won</span><input id={'uf-winner-' + bid.bid_id} type="text" value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="Company name" /></div>
          <div className="field"><span className="lbl">Winning bid ($)</span><input id={'uf-winbid-' + bid.bid_id} type="number" value={winBid} onChange={(e) => setWinBid(e.target.value)} placeholder="0" /></div>
          <div className="field"><span className="lbl">Actual labor cost ($)</span><input id={'uf-actuallabor-' + bid.bid_id} type="number" value={actualLabor} onChange={(e) => setActualLabor(e.target.value)} placeholder="0" /></div>
          <div className="field"><span className="lbl">Actual material cost ($)</span><input id={'uf-actualmaterial-' + bid.bid_id} type="number" value={actualMaterial} onChange={(e) => setActualMaterial(e.target.value)} placeholder="0" /></div>
          <div className="field"><span className="lbl">Notes</span><input id={'uf-notes-' + bid.bid_id} type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Post-bid notes" /></div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => onSaved(false)}>Cancel</button>
      </td>
    </tr>
  );
}

export default function HistoryPage({ active }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [bids, setBids] = useState([]);
  const [openUpdateId, setOpenUpdateId] = useState(null);

  async function load() {
    setStatus('loading');
    try {
      const data = await window.getAllBids();
      setBids(data);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
    }
  }

  useEffect(() => {
    if (active) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggleUpdate(bid_id) {
    setOpenUpdateId((cur) => (cur === bid_id ? null : bid_id));
  }

  // Real bug found running the suite, not assumed: existing specs call
  // the global toggleUpdate(bid_id) directly (page.evaluate(id =>
  // toggleUpdate(id), bidId)) rather than clicking the Update button —
  // js/ui.js's original toggleUpdate() is dead code now (nothing in this
  // component calls it), so those specs were toggling a function that no
  // longer had any connection to what's on screen. Bridged the same way
  // as goto()/showHistory()/etc.
  useEffect(() => {
    window.toggleUpdate = toggleUpdate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(bid_id) {
    if (!confirm('Delete this bid record? This cannot be undone.')) return;
    try {
      await window.deleteBid(bid_id);
      load();
    } catch (e) {
      alert('Failed to delete bid — check your connection and try again.');
    }
  }

  const total = bids.length;
  const won = bids.filter((b) => b.outcome === 'won').length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  const wonBids = bids.filter((b) => b.outcome === 'won' && b.final_bid > 0 && b.direct_cost > 0);
  const avgMargin = wonBids.length > 0
    ? wonBids.reduce((s, b) => s + ((b.final_bid - b.direct_cost) / b.final_bid * 100), 0) / wonBids.length
    : null;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-history">
      {status === 'loading' && <div className="empty-state">Loading bid history…</div>}

      {status === 'error' && (
        <>
          <div className="page-hdr">
            <div>
              <div className="page-title">Bid history</div>
              <div className="page-sub">Track submitted bids and log outcomes for competitive analysis</div>
            </div>
          </div>
          <div className="empty-state" style={{ color: 'var(--danger)' }}>
            Couldn't load bid history — check your connection and try again.
          </div>
        </>
      )}

      {status === 'ready' && (
        <>
          <div className="page-hdr">
            <div>
              <div className="page-title">Bid history</div>
              <div className="page-sub">Track submitted bids and log outcomes for competitive analysis</div>
            </div>
            <div className="page-actions">
              <button className="btn btn-ghost" onClick={() => window.goto('output')}>← Bid output</button>
            </div>
          </div>

          <div className="totals-bar" style={{ marginBottom: 28 }}>
            <div className="total-item"><div className="total-val">{total}</div><div className="total-lbl">Total bids</div></div>
            <div className="total-div" />
            <div className="total-item"><div className="total-val">{total > 0 ? winRate + '%' : '—'}</div><div className="total-lbl">Win rate</div></div>
            <div className="total-div" />
            <div className="total-item"><div className="total-val">{won}</div><div className="total-lbl">Won</div></div>
            <div className="total-div" />
            <div className="total-item"><div className={'total-val' + (avgMargin !== null ? ' green' : '')}>{avgMargin !== null ? fmtPct(avgMargin) : '—'}</div><div className="total-lbl">Avg margin (wins)</div></div>
          </div>

          <div className="section-block">
            <div className="section-label">Submitted bids</div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Project</th><th>GC</th><th>Building type</th>
                    <th>Final bid</th><th>Confidence</th><th>Outcome</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {bids.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No bids submitted yet — complete a bid and click "Submit bid →" in Tab 7.</td></tr>
                  ) : bids.map((b) => (
                    <Fragment key={b.bid_id}>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)' }}>{b.date_submitted || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{b.project_name || '—'}</td>
                        <td style={{ color: 'var(--text2)' }}>{b.gc || '—'}</td>
                        <td style={{ color: 'var(--text2)' }}>{b.building_type || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--green)' }}>{b.final_bid ? fmtCost(b.final_bid) : '—'}</td>
                        <td><ConfLabel conf={b.confidence} /></td>
                        <td><OutcomePill outcome={b.outcome} /></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleUpdate(b.bid_id)}>Update</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 4 }} onClick={() => handleDelete(b.bid_id)}>×</button>
                        </td>
                      </tr>
                      {/* Always rendered (not conditionally mounted),
                          matching the original's always-present
                          #uprow-X toggled via display:none/table-row —
                          existing specs call the bridged toggleUpdate(id)
                          to make it visible, then page.fill() its fields,
                          which requires the element to already exist
                          (and, since fill() waits for actionability,
                          to already be visible) rather than being created
                          fresh by a conditional render. */}
                      <UpdateRow bid={b} open={openUpdateId === b.bid_id} onSaved={(reload = true) => { setOpenUpdateId(null); if (reload) load(); }} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
