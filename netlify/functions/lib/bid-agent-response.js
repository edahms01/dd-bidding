// ─────────────────────────────────────────────────────────────────────
// bid-agent-response.js — Pure response-parsing for the bid-agent
// Netlify Function (Track A). Takes the raw Anthropic /v1/messages
// response body (already JSON-parsed) and returns either the parsed
// recommendation object or a structured failure — never throws, so
// bid-agent.js can turn a parse failure into a clean error response
// without wrapping this call in its own try/catch. Same markdown-fence
// stripping logic that used to live at the end of runBidAgent()'s live
// branch (js/agent.js, pre-Track-A) — relocated here since the Function
// is now the only thing that ever sees a raw Anthropic response.
// ─────────────────────────────────────────────────────────────────────

function parseAgentResponse(anthropicResponseBody) {
  const text = anthropicResponseBody?.content?.[0]?.text || '';

  if (!text) {
    return { ok: false, error: 'Anthropic response had no text content' };
  }

  // Strip markdown code fences if the model wraps the JSON
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return { ok: true, recommendation: JSON.parse(clean) };
  } catch (e) {
    return { ok: false, error: 'Failed to parse agent response as JSON: ' + e.message };
  }
}

module.exports = {
  parseAgentResponse
};
