// ─────────────────────────────────────────────────────────────────────
// legacyBridges.js — window bridges for pure-logic modules ported from
// js/*.js classic-script globals to real src/state/ ES modules
// (Migration Phase 3).
//
// Unlike src/state/bridges.js's registerBridges(dispatch), these are
// flat, unconditional `window.X = fn` assignments — no dispatch, no
// React lifecycle dependency, since every function here is a pure
// calculation with no state to hydrate. Imported once, top-level, from
// src/main.jsx (not called from a mount effect) for the same reason.
//
// index.html loads every classic <script> before the React module
// bundle (src/main.jsx, always last), so these assignments are
// guaranteed to exist before any classic-script caller can reach them —
// verified caller-by-caller in the Phase 3 plan, not assumed.
//
// Each block here should be deleted once its own classic-script
// caller(s) convert to real imports and no longer need the global.
// ─────────────────────────────────────────────────────────────────────

import {
  calculateWallCosts,
  calculateCeilingCosts,
  calculateLogistics,
  disposalMonthsFor,
  applyLaborBurden,
  buildCostSummary,
  applyMarkup,
  computeWeightedWastePct,
  applyRateEscalation
} from './calculator.js';

import {
  omit,
  buildAgentPayload,
  AGENT_PROJECT_DENYLIST,
  AGENT_CONDITIONS_DENYLIST,
  AGENT_ASSEMBLY_DENYLIST,
  AGENT_WALL_DENYLIST,
  AGENT_CEILING_DENYLIST
} from './agentPayload.js';

// computeCostVariances is deliberately NOT imported here — its only
// caller is src/components/BidUpdateRow.jsx, which imports it directly
// (Migration Phase 3, Step 3C). A bridge for it would be dead on
// arrival. MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE has no classic-script
// caller either (grep-confirmed) and is likewise not bridged.
// MIN_BIDS_FOR_MARGIN_CURVE IS bridged — js/ui.js's _launchBidAgent()
// catch-block fallback references it as a bare global (a real caller
// missed on first pass; caught by agent-history-fallback.spec.js).
import {
  MIN_BIDS_FOR_MARGIN_CURVE,
  computeMarginOutcomeCurve,
  computeSeasonality,
  computeCompetitorPatterns
} from './historyAnalytics.js';

// js/ui.js's calculateOnly()/submitBid() call these as bare globals.
// Both are reachable only via user-triggered paths (debounced form-change/
// state-watcher, explicit navigation, Finalize-confirm click) — never at
// script-load time — so there's no load-order race with this assignment.
window.calculateWallCosts = calculateWallCosts;
window.calculateCeilingCosts = calculateCeilingCosts;
window.calculateLogistics = calculateLogistics;
window.disposalMonthsFor = disposalMonthsFor;
window.applyLaborBurden = applyLaborBurden;
window.buildCostSummary = buildCostSummary;
window.applyMarkup = applyMarkup;
window.computeWeightedWastePct = computeWeightedWastePct;
window.applyRateEscalation = applyRateEscalation;

// js/agent.js's runBidAgent() calls buildAgentPayload as a bare global,
// only when DEMO_MODE is false (production only) — still user-triggered
// (Send to Agent / Re-run agent), never at script-load time. agent.js
// loads after agent-payload.js in index.html's classic-script chain,
// and both load before the React module bundle that owns this bridge.
window.omit = omit;
window.buildAgentPayload = buildAgentPayload;
window.AGENT_PROJECT_DENYLIST = AGENT_PROJECT_DENYLIST;
window.AGENT_CONDITIONS_DENYLIST = AGENT_CONDITIONS_DENYLIST;
window.AGENT_ASSEMBLY_DENYLIST = AGENT_ASSEMBLY_DENYLIST;
window.AGENT_WALL_DENYLIST = AGENT_WALL_DENYLIST;
window.AGENT_CEILING_DENYLIST = AGENT_CEILING_DENYLIST;

// js/history.js's getHistorySummary() calls these three as bare globals
// (both its zero-bids and real-data branches) — js/history.js stays a
// classic script this phase, out of scope. computeCostVariances has no
// classic-script caller (see the import comment above) and is
// deliberately not bridged.
window.computeMarginOutcomeCurve = computeMarginOutcomeCurve;
window.computeSeasonality = computeSeasonality;
window.computeCompetitorPatterns = computeCompetitorPatterns;

// js/ui.js's _launchBidAgent() references this bare, in its
// catch-block fallback shape for a history-fetch failure.
window.MIN_BIDS_FOR_MARGIN_CURVE = MIN_BIDS_FOR_MARGIN_CURVE;
