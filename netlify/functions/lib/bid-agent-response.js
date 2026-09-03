// ─────────────────────────────────────────────────────────────────────
// bid-agent-response.js — Pure response-parsing for the bid-agent
// Netlify Function (Track A). Takes the raw Anthropic /v1/messages
// response body (already JSON-parsed) and returns either the
// recommendation object or a structured failure — never throws, so
// bid-agent.js can turn a failure into a clean error response without
// its own try/catch.
//
// The request forces a `submit_bid_recommendation` tool call with a
// `strict: true` schema, so the happy path is just: find the tool_use
// block and hand back its already-parsed `.input`. The text-JSON branch
// below is a defensive fallback for the case where a response somehow
// comes back as prose (tool_choice not honored, an API change, etc.) —
// it keeps the old markdown-fence-strip + JSON.parse behaviour.
// ─────────────────────────────────────────────────────────────────────

const TOOL_NAME = 'submit_bid_recommendation';

function parseAgentResponse(anthropicResponseBody) {
  const blocks = anthropicResponseBody && anthropicResponseBody.content;

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, error: 'Anthropic response had no content blocks' };
  }

  // Primary path: the forced tool call.
  const toolUse = blocks.find(b => b && b.type === 'tool_use' && b.name === TOOL_NAME);
  if (toolUse) {
    if (!toolUse.input || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'submit_bid_recommendation tool_use block had no input object' };
    }
    return { ok: true, recommendation: toolUse.input };
  }

  // Fallback: a plain text block that should be JSON.
  const text = (blocks.find(b => b && b.type === 'text') || {}).text || '';
  if (!text) {
    return { ok: false, error: 'Anthropic response had no submit_bid_recommendation tool_use block and no text' };
  }
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return { ok: true, recommendation: JSON.parse(clean) };
  } catch (e) {
    return { ok: false, error: 'No tool_use block; fallback text did not parse as JSON: ' + e.message };
  }
}

module.exports = {
  parseAgentResponse
};
