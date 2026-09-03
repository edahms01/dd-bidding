// ─────────────────────────────────────────────────────────────────────
// bid-agent-request.js — Pure request-building for the bid-agent
// Netlify Function (Track A). No network, no `event`/`context` handling
// — just the system prompt, response schema, and Anthropic request-body
// shape bid-agent.js delegates to. Kept separate so it's unit-testable
// without a running function or a real API call, same reasoning as
// bids-core.js's split from bids.js in Phase 3.
//
// AGENT_SYSTEM and the schema used to live in js/agent.js and travel to
// the browser on every page load. They live here now instead — the
// client only sends the business-data payload it already assembled.
//
// The recommendation comes back as a FORCED tool call, not free text:
// the model must call `submit_bid_recommendation` with an input that the
// API validates against RECOMMENDATION_SCHEMA (`strict: true`). This
// replaced an earlier "respond only in JSON" text prompt that Haiku —
// and occasionally Sonnet — got wrong (an unescaped quote inside a
// rationale string → 502 parse_error), first seen when the dual-demo
// "Load Demo — live agent" button actually exercised this path
// (2026-09-02). Structured output guarantees the JSON parses.
// ─────────────────────────────────────────────────────────────────────

const AGENT_SYSTEM = `You are a bid strategy advisor for Dirigo Drywall, a commercial drywall subcontractor. You analyze bid data and market signals and always return exactly three bid options: competitive, recommended, and ambitious. You return your recommendation by calling the submit_bid_recommendation tool — do not write a prose reply. Be direct and specific — your reasoning should reference the actual signals provided, not generic advice.

The payload's history object may include marginOutcomeCurve, seasonality, and competitorPatterns — use them deliberately, not just as background context:
- If history.marginOutcomeCurve.available is true, its bands report actual historical win rate by margin range. Weigh each option's margin against the win rate of the band it falls into when setting that option's winLikelihood — a high-margin option in a band with a low historical win rate should not read as "High" likelihood just because the numbers look strong in isolation. If marginOutcomeCurve.available is false, there isn't enough decided-bid history yet to support that — do not infer a false sense of confidence from too little data.
- If history.seasonality has an entry for the quarter this bid's bidDate falls in, factor that quarter's historical win rate into your read on timing — note it in reasoning or signals when it's a meaningful factor, not just when it happens to be favorable.
- The payload's history object may also include competitorPatterns — competitors Dirigo has specifically lost to before, each with timesLost and, where enough pricing data exists, avgUndercutPct. Cross-reference this against intelligence.knownCompetitors — if a named competitor there matches an entry here, factor their historical undercut pattern directly into pricing guidance, not just general competition-level reasoning. Don't assume a match if the names are clearly different companies.
- The payload's intelligence.openDraftCount reports how many other bids are currently open and competing for attention, separate from the subjective pipelinePressure signal. Treat a nonzero value as added pressure toward the competitive end of the range — more open work competing for the same crew capacity is a real constraint, not a neutral fact.`;

// Real JSON Schema for the forced tool call. `strict: true` on the tool
// definition means the API guarantees `tool_use.input` validates against
// this exactly — so bid-agent-response.js never has to parse or repair a
// model-authored JSON string. additionalProperties:false + required on
// every object level is required for strict mode.
const RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['options', 'reasoning', 'signals', 'riskFlags', 'historicalNotes'],
  properties: {
    options: {
      type: 'array',
      description: 'Exactly three entries — one each of competitive, recommended, ambitious.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label', 'bidAmount', 'margin', 'winLikelihood', 'rationale'],
        properties: {
          type:          { type: 'string', enum: ['competitive', 'recommended', 'ambitious'] },
          label:         { type: 'string' },
          bidAmount:     { type: 'number' },
          margin:        { type: 'number', description: 'Effective margin percentage for this option.' },
          winLikelihood: { type: 'string', enum: ['Very High', 'High', 'Medium', 'Low–Medium', 'Low'] },
          rationale:     { type: 'string', description: '2-3 sentences on when to pick this option.' }
        }
      }
    },
    reasoning: {
      type: 'string',
      description: '2-3 sentences directly referencing the signals provided; the overall read on this bid.'
    },
    signals: {
      type: 'array',
      description: 'One entry per intelligence field provided.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'status', 'note'],
        properties: {
          label:  { type: 'string' },
          value:  { type: 'string' },
          status: { type: 'string', enum: ['positive', 'warning', 'neutral'] },
          note:   { type: 'string' }
        }
      }
    },
    riskFlags: {
      type: 'array',
      description: 'Empty array if none.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'message'],
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          message:  { type: 'string' }
        }
      }
    },
    historicalNotes: {
      type: 'array',
      description: 'Observations from bid history; empty array if none.',
      items: { type: 'string' }
    }
  }
};

const RECOMMENDATION_TOOL = {
  name: 'submit_bid_recommendation',
  description: 'Return the bid strategy recommendation. Call this exactly once with the complete recommendation — this is the only way to respond.',
  input_schema: RECOMMENDATION_SCHEMA,
  strict: true
};

// Takes the business-data payload runBidAgent() (js/agent.js) assembles
// client-side — { project, costs, conditions, intelligence, history } —
// and returns the full Anthropic /v1/messages request body with the
// forced recommendation tool attached.
function buildAnthropicRequest(payload) {
  return {
    model:      'claude-sonnet-4-6',
    // Measured full response ≈ 1.5k output tokens / 6 KB. The original
    // 1024 truncated it mid-string (502 parse_error); 8192 is generous
    // headroom and costs nothing idle (billed per token generated).
    max_tokens: 8192,
    system:     AGENT_SYSTEM,
    tools:      [RECOMMENDATION_TOOL],
    tool_choice: { type: 'tool', name: RECOMMENDATION_TOOL.name },
    messages: [{
      role:    'user',
      content: JSON.stringify(payload, null, 2)
    }]
  };
}

module.exports = {
  AGENT_SYSTEM,
  RECOMMENDATION_SCHEMA,
  RECOMMENDATION_TOOL,
  buildAnthropicRequest
};
