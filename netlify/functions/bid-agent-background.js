// ─────────────────────────────────────────────────────────────────────
// bid-agent-background.js — Netlify *background* function (Track A).
// Replaces the synchronous bid-agent.js: a full structured-output
// Sonnet 4.6 recommendation takes ~40-45s and Netlify's synchronous
// function HTTP path cuts off around ~26-30s → 504 (a timeout there is
// killed before it can even log). Background functions get a 15-minute
// budget and answer 202 immediately with no body.
//
// Flow: client POSTs { jobId, ...businessData } → this writes a
// `pending` record to the bid-agent-jobs Blobs store, calls Anthropic
// (via lib/bid-agent-request.js + lib/bid-agent-response.js), then
// overwrites the record with `done` (+ recommendation) or `error`
// (+ message). The client polls bid-agent-result.js for that record.
//
// MUST NOT throw. Netlify retries a failed background invocation (after
// 1 min, then 2 min) — an unhandled error would mean duplicate billable
// Anthropic calls. Every path catches, writes a terminal record, and
// returns 202.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { buildAnthropicRequest }   = require('./lib/bid-agent-request.js');
const { parseAgentResponse }      = require('./lib/bid-agent-response.js');
const {
  STORE_NAME, isValidJobId, pendingRecord, doneRecord, errorRecord, writeJob
} = require('./lib/bid-agent-jobs.js');

const DONE = { statusCode: 202 };

exports.handler = async (event) => {
  connectLambda(event); // required before getStore() in Lambda-compat mode
  const store = getStore(STORE_NAME);

  let jobId;
  try {
    const payload = JSON.parse(event.body || '{}');
    jobId = payload.jobId;
    if (!isValidJobId(jobId)) {
      // No key to write an error to — just log; the client will time out.
      console.error('bid-agent-background: missing/invalid jobId');
      return DONE;
    }
    const { jobId: _drop, ...businessData } = payload;

    await writeJob(store, jobId, pendingRecord());

    const apiKey = process.env.ANTHROPIC_API_KEY;
    // Real Anthropic keys start with 'sk-ant-'. Anything else (unset, or
    // a Netlify AI-Gateway JWT shadowing the var) fails here rather than
    // 401ing downstream — same guard the old sync bid-agent.js had.
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      await writeJob(store, jobId, errorRecord('not_configured — ANTHROPIC_API_KEY is not set (or not a recognizable Anthropic key) in the function environment'));
      return DONE;
    }

    const anthropicReq = buildAnthropicRequest(businessData);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicReq)
    });

    if (!resp.ok) {
      const err  = await resp.json().catch(() => ({}));
      const kind = err && err.error && (err.error.type || err.error);
      console.error('bid-agent-background: Anthropic', resp.status, JSON.stringify(err).slice(0, 300));
      await writeJob(store, jobId, errorRecord('HTTP ' + resp.status + (kind ? ' (' + kind + ')' : '')));
      return DONE;
    }

    const data   = await resp.json();
    const parsed = parseAgentResponse(data);
    if (!parsed.ok) {
      console.error('bid-agent-background: parse error', parsed.error, '| stop_reason:', data && data.stop_reason,
        '| block types:', ((data && data.content) || []).map(b => b && b.type).join(','));
      await writeJob(store, jobId, errorRecord('parse_error — ' + parsed.error));
      return DONE;
    }

    await writeJob(store, jobId, doneRecord(parsed.recommendation));
    return DONE;

  } catch (err) {
    console.error('bid-agent-background: unexpected', err && err.message);
    try {
      if (jobId && isValidJobId(jobId)) {
        await writeJob(getStore(STORE_NAME), jobId, errorRecord(err && err.message || 'internal error'));
      }
    } catch (_) { /* nothing more we can do — client times out */ }
    return DONE;
  }
};
