// ─────────────────────────────────────────────────────────────────────
// bid-agent.js — Netlify Function: Anthropic bid-agent proxy (Track A)
// Backs js/agent.js's runBidAgent() live branch (DEMO_MODE = false).
// Receives the business-data payload the client already assembles
// ({ project, costs, conditions, intelligence, history } — no schema
// key), reads ANTHROPIC_API_KEY from the function environment, builds
// the full Anthropic request server-side, and calls
// https://api.anthropic.com/v1/messages directly. Server-to-server, so
// no anthropic-dangerous-direct-browser-access header is needed at all
// — that header only exists to opt into the browser-calling pattern
// this phase retires.
//
// Does NOT touch Netlify Blobs (no bid storage involved here), so
// unlike bids.js it does not need connectLambda(event) before anything
// — that requirement is specific to getStore() calls, confirmed against
// bids.js (Phase 3) and deliberately checked as not applicable here.
//
// Request-building and response-parsing logic live in lib/ (pure,
// unit-testable) — same split bids-core.js established for bids.js.
// Only top-level .js files directly in netlify/functions/ become their
// own deployable functions; lib/'s contents don't.
//
// Real finding: Netlify's own AI Gateway auto-injects ANTHROPIC_API_KEY
// (plus ANTHROPIC_BASE_URL and others) into every compute context
// "unless already set by you" — confirmed via a real netlify dev session
// where process.env.ANTHROPIC_API_KEY held a ~414-char Gateway JWT, not
// the real key configured on this site, because that key is scoped to
// context: "production" only and the injection precedence across
// contexts is genuinely ambiguous (Netlify's own support forum has
// live, unresolved reports of the same inconsistency). This code never
// reads ANTHROPIC_BASE_URL, so a Gateway JWT sent to the real Anthropic
// endpoint below just 401s — never a leak, but a confusing failure mode
// worth failing on clearly instead. Hence the shape check just below.
// ─────────────────────────────────────────────────────────────────────

const { buildAnthropicRequest } = require('./lib/bid-agent-request.js');
const { parseAgentResponse }    = require('./lib/bid-agent-response.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Real Anthropic keys always start with 'sk-ant-'. Cheap insurance
  // against the Gateway-JWT-shadowing scenario documented above —
  // whatever unexpectedly lands in this env var, fail clearly as
  // not_configured rather than sending it to Anthropic and surfacing a
  // confusing 401 further down.
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    // Operations-level failure state (deployment misconfigured), not
    // something an individual user can fix — client checks for this
    // exact error value to show a correspondingly-worded fallback.
    return {
      statusCode: 503,
      body: JSON.stringify({
        error:   'not_configured',
        message: 'ANTHROPIC_API_KEY is not set (or not a recognizable Anthropic key) in the function environment'
      })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const anthropicReq = buildAnthropicRequest(payload);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01'
      },
      body: JSON.stringify(anthropicReq)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('Anthropic API error:', resp.status, err);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'upstream_error', status: resp.status })
      };
    }

    const data   = await resp.json();
    const parsed = parseAgentResponse(data);

    if (!parsed.ok) {
      // Log enough to diagnose without a second live call: the model's
      // stop_reason ("max_tokens" = raise max_tokens in
      // bid-agent-request.js) and the head of the raw text.
      const rawText = (data && data.content && data.content[0] && data.content[0].text) || '';
      console.error('Bid agent response parse error:', parsed.error,
        '| stop_reason:', data && data.stop_reason,
        '| raw head:', rawText.slice(0, 300));
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'parse_error', message: parsed.error })
      };
    }

    return { statusCode: 200, body: JSON.stringify(parsed.recommendation) };
  } catch (err) {
    console.error('bid-agent function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
