// ─────────────────────────────────────────────────────────────────────
// drafts.js — Netlify Function: server-side draft storage (Migration
// Phase 2, Step 2B). One Blobs record per draft, keyed by id — the
// server is now the SOLE source of truth for drafts (no dual-write to
// localStorage as a cache, no sync-conflict logic — matches how bids
// already work). Backs js/forms.js's getAllDrafts()/_writeDraft()/
// _deleteDraftRemote().
//
// Simpler verb set than bids.js on purpose: the client always sends a
// *complete* draft record (js/drafts.js's buildDraftRecord()) and owns
// id generation, so there's no POST-stamps-an-id or PATCH-merges-a-
// partial need the way bids has.
//   GET            -> every draft, { [id]: record }
//   GET  ?id=X      -> one draft record, or 404
//   PUT  ?id=X      -> upsert (create, autosave, and import-overwrite
//                      are all identical server-side writes)
//   DELETE ?id=X    -> remove one draft
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const {
  isValidDraftId, readDraft, writeDraft, deleteDraftRecord, readAllDrafts, STORE_NAME
} = require('./lib/drafts-core.js');
const { logError, notifyTerminalFailure } = require('./lib/log.js');

// Same rationale as bids.js's NO_STORE_HEADERS — every response here is
// dynamic/per-request.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

exports.handler = async (event) => {
  // Classic (v1) exports.handler = Blobs' "Lambda compatibility mode" —
  // must run before any getStore() call. See bids.js for how this was
  // confirmed via a real MissingBlobsEnvironmentError against
  // `netlify dev`.
  connectLambda(event);

  const store       = getStore(STORE_NAME);
  const errorsStore = getStore('errors');
  const method = event.httpMethod;
  const id     = event.queryStringParameters?.id;

  let result;
  try {
    if (method === 'GET') {
      if (id) {
        const record = await readDraft(store, id);
        result = record
          ? { statusCode: 200, body: JSON.stringify(record) }
          : { statusCode: 404, body: JSON.stringify({ error: 'No draft found for id ' + id }) };
      } else {
        const drafts = await readAllDrafts(store);
        result = { statusCode: 200, body: JSON.stringify(drafts) };
      }

    } else if (method === 'PUT') {
      if (!id || !isValidDraftId(id)) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'id query parameter is required' }) };
      } else {
        const record = JSON.parse(event.body || '{}');
        await writeDraft(store, id, record);
        result = { statusCode: 200, body: JSON.stringify(record) };
      }

    } else if (method === 'DELETE') {
      if (!id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'id query parameter is required' }) };
      } else {
        // No existence check first — same idempotent-delete semantics
        // as bids.js's DELETE (deleting a nonexistent id already
        // silently succeeds; store.delete() on a missing key is a
        // no-op).
        await deleteDraftRecord(store, id);
        result = { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

    } else {
      result = { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (err) {
    // PUT failures are real estimator data loss (an autosave or a
    // draft creation that silently didn't persist) — notify. GET/DELETE
    // failures stay log-only (a read that can retry, or a delete that
    // can be retried, not lost data).
    if (method === 'PUT') {
      await notifyTerminalFailure(errorsStore, 'drafts', { method, id }, err);
    } else {
      logError('drafts', { method, id }, err);
    }
    result = { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }

  result.headers = Object.assign({}, result.headers, NO_STORE_HEADERS);
  return result;
};
