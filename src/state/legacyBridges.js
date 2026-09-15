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
//
// computeMarginOutcomeCurve/computeSeasonality/computeCompetitorPatterns
// are NOT imported here as of Migration Phase 5, Bucket 1, Step C — they
// were only ever bridged for js/history.js's sake, which is now a real
// module (src/state/history.js) and imports them directly.
import { MIN_BIDS_FOR_MARGIN_CURVE } from './historyAnalytics.js';

import {
  buildExportPayload,
  validateImportPayload,
  migrateSchema
} from './autosave.js';

import {
  buildDraftRecord,
  cloneDraftForDuplicate,
  removeDraftAndClearActiveIfNeeded,
  migrateLegacyBidToDrafts,
  getOpenDraftCount
} from './drafts.js';

import { saveBid, getHistorySummary } from './history.js';

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

// js/ui.js's _launchBidAgent() references this bare, in its
// catch-block fallback shape for a history-fetch failure.
window.MIN_BIDS_FOR_MARGIN_CURVE = MIN_BIDS_FOR_MARGIN_CURVE;

// js/forms.js/js/ui.js call these as bare globals (Migration Phase 5,
// Bucket 1, Step A — js/forms.js/js/ui.js stay classic scripts this
// bucket, Bucket 2, out of scope). src/state/drafts.js (below) imports
// buildExportPayload/migrateSchema directly — a real module dependency,
// not reached through this bridge.
//
// debounce/AUTOSAVE_DEBOUNCE_MS are NOT bridged here — see js/debounce.js.
// Their only callers (forms.js:725, ui.js:217) invoke debounce() at
// classic-script top level, before this module-script bridge exists;
// debounce.js stays its own small classic script for exactly that reason.
window.buildExportPayload = buildExportPayload;
window.validateImportPayload = validateImportPayload;
window.migrateSchema = migrateSchema;

// js/forms.js/js/state.js/js/ui.js call these as bare globals
// (Migration Phase 5, Bucket 1, Step A — same out-of-scope callers as
// autosave.js above).
window.buildDraftRecord = buildDraftRecord;
window.cloneDraftForDuplicate = cloneDraftForDuplicate;
window.removeDraftAndClearActiveIfNeeded = removeDraftAndClearActiveIfNeeded;
window.migrateLegacyBidToDrafts = migrateLegacyBidToDrafts;
window.getOpenDraftCount = getOpenDraftCount;

// js/ui.js calls these as bare globals (Migration Phase 5, Bucket 1,
// Step C — js/ui.js stays a classic script this bucket, Bucket 2, out
// of scope). getAllBids/updateBid/deleteBid are NOT bridged here — their
// React callers (BidUpdateRow.jsx, InsightsPage.jsx, BidsPage.jsx) all
// import them directly from src/state/history.js this same step.
window.saveBid = saveBid;
window.getHistorySummary = getHistorySummary;
