// ─────────────────────────────────────────────────────────────────────
// bid-agent-request.js — Pure request-building for the bid-agent
// Netlify Function (Track A). No network, no `event`/`context` handling
// — just the system prompt, response schema, and Anthropic request-body
// shape bid-agent.js delegates to. Kept separate so it's unit-testable
// without a running function or a real API call, same reasoning as
// bids-core.js's split from bids.js in Phase 3.
//
// AGENT_SYSTEM and the schema description object used to live in
// js/agent.js and travel to the browser on every page load. They live
// here now instead — the client no longer needs to know the prompt or
// the schema, only the business-data payload it already assembled.
// ─────────────────────────────────────────────────────────────────────

const AGENT_SYSTEM = `You are a bid strategy advisor for Dirigo Drywall, a commercial drywall subcontractor. You analyze bid data and market signals and always return exactly three bid options: competitive, recommended, and ambitious. You respond only in valid JSON matching the exact schema provided. Be direct and specific — your reasoning should reference the actual signals provided, not generic advice.`;

const AGENT_SCHEMA = {
  options: '[{ type: "competitive"|"recommended"|"ambitious", label: string, bidAmount: number, margin: number, winLikelihood: "Very High"|"High"|"Medium"|"Low–Medium"|"Low", rationale: string }] — always exactly 3 entries',
  reasoning:       'string — 2-3 sentences directly referencing the signals provided; explains the overall read on this bid',
  signals:         '[{ label: string, value: string, status: "positive"|"warning"|"neutral", note: string }] — one entry per intelligence field',
  riskFlags:       '[{ severity: "high"|"medium"|"low", message: string }] — empty array if none',
  historicalNotes: '[string] — observations from bid history; empty array if none'
};

// Takes the business-data payload runBidAgent() (js/agent.js) assembles
// client-side — { project, costs, conditions, intelligence, history },
// no `schema` key — and returns the full Anthropic /v1/messages request
// body. The schema is injected here, server-side, not expected from the
// client.
function buildAnthropicRequest(payload) {
  return {
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     AGENT_SYSTEM,
    messages: [{
      role:    'user',
      content: JSON.stringify(Object.assign({}, payload, { schema: AGENT_SCHEMA }), null, 2)
    }]
  };
}

module.exports = {
  AGENT_SYSTEM,
  AGENT_SCHEMA,
  buildAnthropicRequest
};
