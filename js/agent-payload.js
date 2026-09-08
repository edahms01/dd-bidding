// ─────────────────────────────────────────────────────────────────────
// agent-payload.js — builds the bid-agent request payload.
//
// Split out of js/agent.js's runBidAgent() so it's unit-testable in
// isolation (agent.js has no module.exports and can't be imported under
// Vitest). Classic <script>, loaded immediately before js/agent.js;
// buildAgentPayload resolves as a plain global there, same as every
// other js/*.js function.
//
// project / conditions are sent whole, minus a denylist, rather than
// hand-picked key by key — so a new field added to state.project /
// state.conditions reaches the agent automatically. See
// src/state/fieldRegistry.js and docs/dirigo-ux-decisions.md §9.10.
//
// `state` here is the collectFormData() shape (js/state.js): flat
// state.project / state.conditions / state.intelligence, NOT the React
// store's nested state.bid.*.
// ─────────────────────────────────────────────────────────────────────

function omit(obj, denyKeys) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (!denyKeys.includes(k)) out[k] = obj[k];
  }
  return out;
}

// Per Eric (2026-09-07): no fields are deliberately withheld from the
// agent today. These exist so a *future* decision to withhold something
// has one obvious place to go. Start empty.
const AGENT_PROJECT_DENYLIST = [];
const AGENT_CONDITIONS_DENYLIST = [];

function buildAgentPayload(state, summary, markupResult, bidHistory) {
  return {
    project: omit(state.project, AGENT_PROJECT_DENYLIST),
    // costs stays a deliberately-computed summary (rounded / formatted),
    // not raw form state — the allowlist concern doesn't apply here.
    costs: {
      directCost:      Math.round(summary.directCostTotal),
      overhead:        Math.round(markupResult.overhead),
      contingency:     Math.round(markupResult.contingency),
      profit:          Math.round(markupResult.profit),
      totalMarkup:     Math.round(markupResult.totalMarkup),
      finalBidPrice:   Math.round(markupResult.finalBidPrice),
      effectiveMargin: +markupResult.effectiveMargin.toFixed(1)
    },
    conditions:   omit(state.conditions, AGENT_CONDITIONS_DENYLIST),
    intelligence: state.intelligence, // already a whole-object passthrough
    history:      bidHistory
    // No `schema` key — the server-side function attaches the forced
    // recommendation tool (Track A). Same request for the dual-demo live
    // button and the real product path — same model, same everything.
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    omit,
    buildAgentPayload,
    AGENT_PROJECT_DENYLIST,
    AGENT_CONDITIONS_DENYLIST
  };
}
