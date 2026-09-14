// ─────────────────────────────────────────────────────────────────────
// log.js — Structured error logging + terminal-failure alerting shared
// by every netlify/functions/*.js handler.
//
// logError(): a plain, grep-able console.error line — function name
// first (bracket-tagged), then whatever IDs are in scope, message last.
// No structured JSON — no log aggregator exists to consume it, and a
// plain line matches every other convention already in this codebase's
// Netlify Functions log stream.
//
// notifyTerminalFailure(): logs the same line (with an ALERT=true tag)
// AND writes a record to the 'errors' Blobs store, same getStore()
// pattern lib/bid-agent-jobs.js already uses — a passive store Eric
// checks directly, not an active notification channel (Slack/email were
// considered and explicitly rejected — see docs/Phase 1 plan). Reserved
// for genuinely terminal, business-impacting failures (a bid that
// couldn't be saved, a bid-agent job that exhausted all retries) — most
// call sites should use logError() alone.
// ─────────────────────────────────────────────────────────────────────

function logError(fnName, context, err) {
  const ctx = Object.entries(context || {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  const msg = (err && err.message) || String(err || 'unknown error');
  console.error(`[${fnName}]${ctx ? ' ' + ctx : ''} error=${msg}`);
}

async function notifyTerminalFailure(store, fnName, context, err) {
  logError(fnName, { ...context, ALERT: 'true' }, err);
  const msg = (err && err.message) || String(err || 'unknown error');
  try {
    await store.setJSON(`${Date.now()}_${fnName}`, {
      fn: fnName,
      ts: Date.now(),
      context: context || {},
      error: msg
    });
  } catch (writeErr) {
    // Don't let a failed alert-record write mask the original failure
    // being reported — log it and move on; the caller's own error
    // handling (e.g. a 500 response) still happens regardless.
    console.error(`[log] failed to write errors record for ${fnName}: ${(writeErr && writeErr.message) || writeErr}`);
  }
}

module.exports = { logError, notifyTerminalFailure };
