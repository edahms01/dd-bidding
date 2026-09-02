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

const AGENT_SYSTEM = `You are a bid strategy advisor for Dirigo Drywall, a commercial drywall subcontractor. You analyze bid data and market signals and always return exactly three bid options: competitive, recommended, and ambitious. You respond only in valid JSON matching the exact schema provided. Be direct and specific — your reasoning should reference the actual signals provided, not generic advice.

The payload's history object may include marginOutcomeCurve, seasonality, and competitorPatterns — use them deliberately, not just as background context:
- If history.marginOutcomeCurve.available is true, its bands report actual historical win rate by margin range. Weigh each option's margin against the win rate of the band it falls into when setting that option's winLikelihood — a high-margin option in a band with a low historical win rate should not read as "High" likelihood just because the numbers look strong in isolation. If marginOutcomeCurve.available is false, there isn't enough decided-bid history yet to support that — do not infer a false sense of confidence from too little data.
- If history.seasonality has an entry for the quarter this bid's bidDate falls in, factor that quarter's historical win rate into your read on timing — note it in reasoning or signals when it's a meaningful factor, not just when it happens to be favorable.
- The payload's history object may also include competitorPatterns — competitors Dirigo has specifically lost to before, each with timesLost and, where enough pricing data exists, avgUndercutPct. Cross-reference this against intelligence.knownCompetitors — if a named competitor there matches an entry here, factor their historical undercut pattern directly into pricing guidance, not just general competition-level reasoning. Don't assume a match if the names are clearly different companies.
- The payload's intelligence.openDraftCount reports how many other bids are currently open and competing for attention, separate from the subjective pipelinePressure signal. Treat a nonzero value as added pressure toward the competitive end of the range — more open work competing for the same crew capacity is a real constraint, not a neutral fact.`;

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
    // The full recommendation (3 options with rationales + reasoning +
    // one signal per intelligence field + risk flags + historical notes)
    // serialises to ~2.5-4k output tokens. The original 1024 truncated it
    // mid-string, so parseAgentResponse() always failed with
    // "Unterminated string in JSON" → the function returned 502
    // parse_error. First caught when "Load Demo — live agent" (dual demo
    // mode) actually exercised this path in production, 2026-09-02 — it
    // had never run before because DEMO_MODE was always true. 8192 is
    // ~2x headroom for this bounded schema; billing is per token
    // generated, so the higher ceiling has no idle cost.
    max_tokens: 8192,
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
