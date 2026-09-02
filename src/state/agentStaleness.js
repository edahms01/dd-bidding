// ─────────────────────────────────────────────────────────────────────
// agentStaleness.js — Phase E, Step 2 (docs/dirigo-ux-decisions.md §9.9,
// the agent-option display-staleness defect held open for this phase).
//
// The agent's competitive/recommended/ambitious option amounts are a
// snapshot from whenever it last ran. Phase B's reactive calculation
// (4.2) made the gap actively visible — the live bid-total rail moves
// while the cards sit frozen. This helper detects that drift so the UI
// can warn about it (Q1 = B: an active warning + an acknowledge checkbox
// gating Confirm + the delta recorded on the bid record).
//
// It compares the live reactive calculation (state.ui.output) against the
// input fingerprint captured when the agent last ran
// (state.ui.agent.generatedAt — { bidPrice, directCost }, set by
// js/ui.js's _launchBidAgent()/runAgentIfNeeded() and carried through
// window.__renderAgentTab, see bridges.js).
//
// Why this is detect-and-warn, not recalculate-the-options: js/agent.js
// runs in DEMO_MODE, and _demoResponse() returns hard-coded option
// amounts that don't track inputs at all — re-running the agent refreshes
// this fingerprint (clearing the warning) but never changes the numbers
// on the cards.
//
// Threshold — OR, not AND. The plan's first pass was AND(>$500, >0.5%),
// but at the demo's ~$284k bid the 0.5% arm is ~$1,420, so it would
// dominate and a real ~$1k line-item edit wouldn't trip the warning at
// all. OR with a $500 absolute floor reads as "the bid moved more than
// $500, or more than 0.5%" — how an estimator actually thinks about a
// meaningful change — and the $500 floor still filters rounding noise.
// ─────────────────────────────────────────────────────────────────────

export const STALE_ABS_USD = 500;
export const STALE_REL = 0.005;

export function agentStaleness(state) {
  const gen = state && state.ui && state.ui.agent ? state.ui.agent.generatedAt : null;
  const out = state && state.ui ? state.ui.output : null;

  if (!gen || gen.bidPrice == null || !out || !out.markupResult) {
    return { stale: false, bidPriceDelta: 0, directCostDelta: 0 };
  }

  const bidPriceDelta = out.markupResult.finalBidPrice - gen.bidPrice;
  const currentDirect = out.summary && out.summary.directCostTotal != null
    ? out.summary.directCostTotal
    : gen.directCost;
  const directCostDelta = (currentDirect ?? 0) - (gen.directCost ?? 0);

  const absPrice = Math.abs(bidPriceDelta);
  const relPrice = gen.bidPrice ? absPrice / Math.abs(gen.bidPrice) : 0;
  const stale = absPrice > STALE_ABS_USD || relPrice > STALE_REL;

  return { stale, bidPriceDelta, directCostDelta };
}
