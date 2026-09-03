// ─────────────────────────────────────────────────────────────────────
// BidUpdateRow.jsx — the expandable "log this bid's outcome" row.
// Extracted verbatim from HistoryPage.jsx's inline UpdateRow so the
// unified Bids list (BidsPage.jsx) and the now-superseded HistoryPage
// share one implementation of the outcome/split-cost capture (the
// computeCostVariances() legacy-fallback logic in particular is subtle
// enough that a second copy would be a real drift risk).
//
// Element ids (#uprow-<id>, #uf-outcome-<id>, #uf-actuallabor-<id>, …)
// are unchanged — existing specs fill them by id after calling the
// bridged window.toggleUpdate(id).
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';

export default function BidUpdateRow({ bid, open, onSaved }) {
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
      alert('Failed to save update. Check your connection and try again.');
    }
  }

  return (
    <tr className="bid-update-row" id={'uprow-' + bid.bid_id} style={{ display: open ? 'table-row' : 'none', background: 'var(--surface2)' }}>
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
