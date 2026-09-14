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
const { logError, notifyTerminalFailure } = require('./lib/log.js');
const { callAnthropicWithRetry, MAX_ATTEMPTS } = require('./lib/bid-agent-call.js');
const {
  STORE_NAME, isValidJobId, pendingRecord, doneRecord, errorRecord, writeJob
} = require('./lib/bid-agent-jobs.js');

const DONE = { statusCode: 202 };

exports.handler = async (event) => {
  connectLambda(event); // required before getStore() in Lambda-compat mode
  const store = getStore(STORE_NAME);
  const errorsStore = getStore('errors');

  let jobId;
  try {
    const payload = JSON.parse(event.body || '{}');
    jobId = payload.jobId;
    if (!isValidJobId(jobId)) {
      // No key to write an error to — just log; the client will time out.
      logError('bid-agent-background', {}, 'missing/invalid jobId');
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
    // Retries only transient/retryable failures (timeouts, 5xx, 429) —
    // 400/401/etc fail on attempt 1 with no delay, identical to the
    // pre-1C single-attempt behavior. See lib/bid-agent-call.js's header
    // for why this wraps fetch + the status check only, not the parse
    // step below.
    const result = await callAnthropicWithRetry(fetch, anthropicReq, apiKey, {
      log: {
        retrying: (attempt, reason, delayMs) => logError('bid-agent-background',
          { jobId, attempt: `${attempt}/${MAX_ATTEMPTS}`, retrying_in: `${delayMs}ms` }, reason)
      }
    });

    if (!result.ok) {
      let message, logDetail;
      if (result.resp) {
        const errBody = await result.resp.json().catch(() => ({}));
        const kind = errBody && errBody.error && (errBody.error.type || errBody.error);
        message   = 'HTTP ' + result.resp.status + (kind ? ' (' + kind + ')' : '');
        logDetail = 'Anthropic HTTP ' + result.resp.status + ' ' + JSON.stringify(errBody).slice(0, 300);
      } else {
        message   = (result.err && result.err.message) || 'network error';
        logDetail = message;
      }

      const context = { jobId, attempts: `${result.attempts}/${MAX_ATTEMPTS}` };
      if (result.attempts === MAX_ATTEMPTS) {
        // All retry attempts exhausted — the one bid-agent-background.js
        // terminal-failure case that notifies (Step 1B's classification).
        await notifyTerminalFailure(errorsStore, 'bid-agent-background', context, new Error(logDetail));
      } else {
        // Non-retryable status (400/401/etc), failed on attempt 1 — same
        // single-attempt behavior as before 1C, log-only.
        logError('bid-agent-background', context, logDetail);
      }
      await writeJob(store, jobId, errorRecord(message));
      return DONE;
    }

    const resp   = result.resp;
    const data   = await resp.json();
    const parsed = parseAgentResponse(data);
    if (!parsed.ok) {
      logError('bid-agent-background', { jobId, stop_reason: data && data.stop_reason,
        block_types: ((data && data.content) || []).map(b => b && b.type).join(',') }, 'parse error: ' + parsed.error);
      await writeJob(store, jobId, errorRecord('parse_error — ' + parsed.error));
      return DONE;
    }

    await writeJob(store, jobId, doneRecord(parsed.recommendation));
    return DONE;

  } catch (err) {
    logError('bid-agent-background', { jobId }, err);
    try {
      if (jobId && isValidJobId(jobId)) {
        await writeJob(getStore(STORE_NAME), jobId, errorRecord(err && err.message || 'internal error'));
      }
    } catch (_) { /* nothing more we can do — client times out */ }
    return DONE;
  }
};
