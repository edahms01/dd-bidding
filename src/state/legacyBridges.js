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

// js/ui.js's calculateOnly()/submitBid() call these as bare globals.
// Both are reachable only via user-triggered paths (debounced form-change/
// state-watcher, explicit navigation, Finalize-confirm click) — never at
// script-load time — so there's no load-order race with this assignment.
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

window.calculateWallCosts = calculateWallCosts;
window.calculateCeilingCosts = calculateCeilingCosts;
window.calculateLogistics = calculateLogistics;
window.disposalMonthsFor = disposalMonthsFor;
window.applyLaborBurden = applyLaborBurden;
window.buildCostSummary = buildCostSummary;
window.applyMarkup = applyMarkup;
window.computeWeightedWastePct = computeWeightedWastePct;
window.applyRateEscalation = applyRateEscalation;
