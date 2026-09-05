// ─────────────────────────────────────────────────────────────────────
// gcScorecard.js — Phase F, 8.3. Pure aggregation of bid records grouped
// by general contractor: bid count, win rate, average margin on wins,
// average cost variance.
//
// No new domain math — every per-metric formula here is one this app
// already computes elsewhere, just grouped by `gc`:
//   - win rate            BidsPage.jsx's totals-bar `winRate`
//   - avg margin (wins)    BidsPage.jsx's `avgMargin` (wins only, both
//                          final_bid/direct_cost > 0)
//   - avg cost variance    js/history.js getHistorySummary()'s
//                          `avgCostVariance` (won bids, cost_variance
//                          not null)
//
// Deliberately NOT added to js/history-analytics.js — Phase F's non-goal
// is "consume existing exports only" from that file. It lives here in
// src/ instead, and is unit-tested like every other piece of calc math
// in this app (tests/unit/gcScorecard.test.js — Q3 at plan review).
//
// Operates on the plain array window.getAllBids() resolves to — submitted
// bid records only; drafts never reach the Insights page. Bids with no
// `gc` are omitted from the scorecard, not bucketed under a placeholder.
// ─────────────────────────────────────────────────────────────────────

export function computeGcScorecard(bids) {
  const groups = new Map(); // lowercased gc -> accumulator

  (bids || []).forEach((b) => {
    const gc = (b && b.gc ? String(b.gc) : '').trim();
    if (!gc) return;

    const key = gc.toLowerCase();
    if (!groups.has(key)) {
      // `gc` keeps the first-seen casing, the way computeCompetitorPatterns
      // does — the key is normalised, the label is not.
      groups.set(key, {
        gc, bidCount: 0, decided: 0, wins: 0,
        marginSum: 0, marginN: 0, varianceSum: 0, varianceN: 0
      });
    }
    const g = groups.get(key);
    g.bidCount++;

    const decided = b.outcome === 'won' || b.outcome === 'lost';
    if (decided) g.decided++;

    if (b.outcome === 'won') {
      g.wins++;
      if (b.final_bid > 0 && b.direct_cost > 0) {
        g.marginSum += ((b.final_bid - b.direct_cost) / b.final_bid) * 100;
        g.marginN++;
      }
      if (b.cost_variance != null) {
        g.varianceSum += b.cost_variance;
        g.varianceN++;
      }
    }
  });

  return Array.from(groups.values())
    .map((g) => ({
      gc: g.gc,
      bidCount: g.bidCount,
      decidedCount: g.decided,
      winRate: g.decided > 0 ? Math.round((g.wins / g.decided) * 100) : null,
      avgMarginPct: g.marginN > 0 ? Math.round((g.marginSum / g.marginN) * 10) / 10 : null,
      avgCostVariance: g.varianceN > 0 ? Math.round(g.varianceSum / g.varianceN) : null
    }))
    // Most-active GC first; alphabetical tiebreak so the order is stable.
    .sort((a, b) => b.bidCount - a.bidCount || a.gc.localeCompare(b.gc));
}
