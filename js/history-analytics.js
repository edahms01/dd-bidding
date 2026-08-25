// ─────────────────────────────────────────────────────────────────────
// history-analytics.js — Pure computed statistics over bid history
// (Bid Agent Analytics, Tier 1 + Tier 2 data capture). No DOM, no
// network — operates on the plain array getAllBids() (js/history.js)
// resolves to. Dual browser-global/CommonJS module, same convention as
// js/drafts.js, so this is directly importable by the Vitest suite.
//
// Live pipeline concurrency (the other Tier 1 stat) is NOT here — it's
// draft data, not bid history. See getOpenDraftCount() in js/drafts.js.
// ─────────────────────────────────────────────────────────────────────

// Below this many *decided* (won/lost) bids, computeMarginOutcomeCurve()
// refuses to produce a curve — a handful of data points would look just
// as confident on screen as a real trend, and nothing downstream could
// tell the difference. Deliberately gates on decided bids, not on raw
// submission count: a dataset with 20 total bids but only 3 decided is
// exactly the thin-data case this threshold exists to catch, not a
// dataset that should slip past it because "20 total" reads as plenty.
const MIN_BIDS_FOR_MARGIN_CURVE = 15;

function _decidedBidsWithValidMargin(bids) {
  return bids.filter(b =>
    (b.outcome === 'won' || b.outcome === 'lost') &&
    b.final_bid > 0 && b.direct_cost > 0
  );
}

// Buckets decided bids into fixed 5-point margin bands and reports win
// rate per band. Below MIN_BIDS_FOR_MARGIN_CURVE eligible bids, returns
// an explicit "not enough data" signal instead of a curve built on
// noise. The same shape (available:false) is what getHistorySummary()
// returns on zero bids and what _launchBidAgent()'s catch-block fallback
// uses on a storage failure — one shape for "we don't have enough to
// say," not three.
function computeMarginOutcomeCurve(bids) {
  const eligible = _decidedBidsWithValidMargin(bids);

  if (eligible.length < MIN_BIDS_FOR_MARGIN_CURVE) {
    return { available: false, count: eligible.length, minRequired: MIN_BIDS_FOR_MARGIN_CURVE };
  }

  const bandsByKey = {};
  eligible.forEach(b => {
    const margin = ((b.final_bid - b.direct_cost) / b.final_bid) * 100;
    const low    = Math.floor(margin / 5) * 5;
    const high   = low + 5;
    const key    = low;

    if (!bandsByKey[key]) {
      bandsByKey[key] = { label: low + '–' + high + '%', low, high, count: 0, wins: 0 };
    }
    bandsByKey[key].count++;
    if (b.outcome === 'won') bandsByKey[key].wins++;
  });

  const bands = Object.keys(bandsByKey)
    .map(Number)
    .sort((a, b) => a - b)
    .map(key => {
      const band = bandsByKey[key];
      return {
        label:    band.label,
        low:      band.low,
        high:     band.high,
        count:    band.count,
        wins:     band.wins,
        winRate:  Math.round((band.wins / band.count) * 100)
      };
    });

  return { available: true, bands };
}

// Win rate by quarter (not month — at realistic bid volume, monthly
// buckets are mostly empty or single-bid, which is a less honest
// granularity than it looks). Buckets on bid_date (the date the bid was
// actually due/submitted to the GC), not date_submitted (when the
// server happened to stamp the record) — bid_date is the field that's
// actually meaningful for "when in the year does Dirigo bid." Only
// decided (won/lost) bids count toward a quarter's win rate; a quarter
// with none simply doesn't appear in the returned array rather than
// showing as a fabricated zero.
function computeSeasonality(bids) {
  const byQuarter = {};

  bids.forEach(b => {
    if (b.outcome !== 'won' && b.outcome !== 'lost') return;
    if (!b.bid_date) return;

    const d = new Date(b.bid_date);
    if (isNaN(d.getTime())) return;

    const quarter = d.getUTCFullYear() + '-Q' + (Math.floor(d.getUTCMonth() / 3) + 1);
    if (!byQuarter[quarter]) byQuarter[quarter] = { quarter, totalBids: 0, wins: 0 };
    byQuarter[quarter].totalBids++;
    if (b.outcome === 'won') byQuarter[quarter].wins++;
  });

  return Object.keys(byQuarter)
    .sort()
    .map(q => {
      const entry = byQuarter[q];
      return {
        quarter:   entry.quarter,
        totalBids: entry.totalBids,
        wins:      entry.wins,
        winRate:   Math.round((entry.wins / entry.totalBids) * 100)
      };
    });
}

// Below this many losses-with-pricing-data to a specific competitor,
// avgUndercutPct stays null rather than averaging 1 data point into
// something that reads as a trend. Gated independently of timesLost —
// a competitor lost to 5 times might only have pricing data on 1 of
// those losses, and the raw timesLost count is still shown (a count is
// never misleading on its own; an average of 1 value can be).
const MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE = 2;

// Sparse per-competitor array, not a single available:false gate like
// computeMarginOutcomeCurve() — competitors are independent groups
// (rich data on one, none on another, simultaneously), so an
// all-or-nothing gate would be wrong here. Deliberately does no fuzzy
// matching against intelligence.knownCompetitors — both go to the
// agent as separate fields; AGENT_SYSTEM tells the model to
// cross-reference them itself.
function computeCompetitorPatterns(bids) {
  const losses = bids.filter(b => b.outcome === 'lost' && b.competitor_who_won);
  const groups = {};

  losses.forEach(b => {
    const key = b.competitor_who_won.trim().toLowerCase();
    if (!groups[key]) groups[key] = { name: b.competitor_who_won.trim(), timesLost: 0, undercuts: [] };
    groups[key].timesLost++;
    if (b.winning_bid && b.final_bid > 0) {
      groups[key].undercuts.push((b.final_bid - b.winning_bid) / b.final_bid * 100);
    }
  });

  return Object.values(groups)
    .map(g => ({
      name: g.name,
      timesLost: g.timesLost,
      avgUndercutPct: g.undercuts.length >= MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE
        ? Math.round(g.undercuts.reduce((s, v) => s + v, 0) / g.undercuts.length * 10) / 10
        : null
    }))
    .sort((a, b) => b.timesLost - a.timesLost)
    .slice(0, 5);
}

// Update-form cost-variance computation (Tier 2 data capture), pulled
// out of js/ui.js's saveUpdate() so the null-handling below is directly
// unit-testable rather than only reachable through a full browser round
// trip. Takes the already-fetched bid record plus the two parsed
// (number-or-null) actuals from the form and returns the patch fields
// for updateBid().
//
// record having both estimated_labor_cost/estimated_material_cost means
// it was created post-this-phase — variances compute against those
// baselines independently. A legacy record (neither baseline present)
// falls back to the old combined direct_cost-vs-actual-sum formula, but
// — deliberately, a real behavior change from today — only when BOTH
// actualLabor and actualMaterial are entered. Today's single combined
// field made "entered" and "complete" the same thing; splitting the
// field breaks that equivalence, so treating a missing half as 0 would
// silently understate the actual cost and produce a misleading
// variance. Requiring both mirrors the same conservatism already
// applied to the post-phase branch (cost_variance only sums when both
// labor_cost_variance and material_cost_variance are present).
function computeCostVariances({ record, actualLabor, actualMaterial }) {
  const actual_cost = (actualLabor != null && actualMaterial != null)
    ? actualLabor + actualMaterial
    : null;

  const hasBaseline = record &&
    record.estimated_labor_cost != null &&
    record.estimated_material_cost != null;

  let labor_cost_variance    = null;
  let material_cost_variance = null;
  let cost_variance          = null;

  if (hasBaseline) {
    if (actualLabor != null)    labor_cost_variance    = Math.round(actualLabor    - record.estimated_labor_cost);
    if (actualMaterial != null) material_cost_variance = Math.round(actualMaterial - record.estimated_material_cost);
    if (labor_cost_variance != null && material_cost_variance != null) {
      cost_variance = labor_cost_variance + material_cost_variance;
    }
  } else if (record && record.direct_cost && actualLabor != null && actualMaterial != null) {
    cost_variance = Math.round(actual_cost - record.direct_cost);
  }

  return {
    actual_cost:            actual_cost !== null ? Math.round(actual_cost) : null,
    labor_cost_variance,
    material_cost_variance,
    cost_variance
  };
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_BIDS_FOR_MARGIN_CURVE,
    computeMarginOutcomeCurve,
    computeSeasonality,
    MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE,
    computeCompetitorPatterns,
    computeCostVariances
  };
}
