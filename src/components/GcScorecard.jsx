// ─────────────────────────────────────────────────────────────────────
// GcScorecard.jsx — Phase F, 8.3. A section within the Insights page:
// bid count, win rate, avg margin on wins, and avg cost variance, one
// row per general contractor. Read-only; the aggregation is the pure
// computeGcScorecard() (src/state/gcScorecard.js), which reuses the same
// per-metric formulas BidsPage.jsx / getHistorySummary() already use.
//
// .tbl-wrap + sticky-col, the shared table system from BidsPage.jsx —
// GC names are long and the row is 5 columns wide, so the pinned first
// column earns its place here (confirmed on a 390px viewport, unlike the
// 3-column competitor-patterns table, which doesn't get it).
// ─────────────────────────────────────────────────────────────────────
import { computeGcScorecard } from '../state/gcScorecard.js';

function fmtSignedCost(n) {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString();
}

export default function GcScorecard({ bids }) {
  const rows = computeGcScorecard(bids);

  if (rows.length === 0) {
    return <div className="empty-state">No submitted bids with a general contractor yet.</div>;
  }

  const anyVariance = rows.some((r) => r.avgCostVariance != null);

  return (
    <div className="tbl-wrap sticky-col">
      <table className="insight-tbl">
        <thead>
          <tr>
            <th>General contractor</th>
            <th>Bids</th>
            <th>Win rate</th>
            <th>Avg margin (wins)</th>
            <th>Avg cost variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gc}>
              <td style={{ fontWeight: 500 }}>{r.gc}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.bidCount}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: r.winRate == null ? 'var(--text3)' : 'var(--text)' }}>
                {r.winRate == null ? '-' : r.winRate + '%'}
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: r.avgMarginPct == null ? 'var(--text3)' : 'var(--text)' }}>
                {r.avgMarginPct == null ? '-' : r.avgMarginPct + '%'}
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: r.avgCostVariance == null ? 'var(--text3)' : 'var(--text)' }}>
                {r.avgCostVariance == null ? '-' : fmtSignedCost(r.avgCostVariance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyVariance && (
        <div className="insight-note">Cost variance needs a won bid with its actual costs logged; none recorded yet.</div>
      )}
    </div>
  );
}
