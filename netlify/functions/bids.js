// ─────────────────────────────────────────────────────────────────────
// bids.js — Netlify Function: bid history CRUD (Migration Phase 2, Step 2A)
// Backs js/history.js's saveBid/getAllBids/updateBid/deleteBid. One
// Blobs record per bid, keyed by bid_id — restructured from the prior
// single-array-under-one-key ('all') shape (see git history for that
// version) to eliminate whole-dataset read-modify-write on every
// request. All 4 of js/history.js's call shapes (GET all, POST create,
// PATCH ?bid_id=X, DELETE ?bid_id=X) — request/response bodies — are
// unchanged; this restructure is invisible to the client. Record-
// shaping + store I/O logic lives in bids-core.js so it's unit-testable
// without a running function; this file only does HTTP routing.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const {
  stampNewBid, mergeBidPatch, readBid, writeBid, deleteBidRecord, readAllBids
} = require('./lib/bids-core.js');
const { logError, notifyTerminalFailure } = require('./lib/log.js');

const STORE_NAME = 'bids';

// Every response here is dynamic/per-request — never let a browser, proxy,
// or Netlify's own edge cache serve a stale one. Paired with `cache:
// 'no-store'` on the client fetch() calls (js/history.js) as defense in
// depth. Confirmed this does NOT explain the eventual-consistency lag
// documented below: the lag was re-measured against the live deploy
// preview with this header correctly present and was identical (still
// missing at 0ms, found by ~50ms) — it's genuinely Blobs' own cross-edge-
// node propagation, not an HTTP/CDN caching artifact. Kept anyway on
// general correctness grounds for dynamic API responses.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

// Known characteristic, confirmed against the real deployed preview (not
// reproducible against netlify dev's local emulator, which is
// synchronous): getStore()'s default read path is eventually consistent
// across edge nodes. A GET immediately following a POST from a different
// location/edge node can occasionally miss that write for longer than
// expected — one real test saw same-node reads settle in ~100ms, but a
// reload-triggered read from the browser still missed a just-submitted
// bid at ~1s before it appeared moments later. Ruled out HTTP/CDN caching
// as the cause (see NO_STORE_HEADERS above) — this is Blobs' own
// consistency model. Same "genuinely low risk, not worth solving now"
// bucket as the concurrent-writes tradeoff already accepted for this app
// (single-estimator usage scale) — not fixed here, but flagged since it's
// a real characteristic of this architecture, not a bug. Restructuring
// GET-all to list()-then-fetch-each (readAllBids(), bids-core.js) means N
// independent per-key reads instead of 1 — the *chance* one of N is
// briefly stale right after a write goes up, not the *severity* of any
// single read's staleness. If it ever needs solving: getStore()'s strong-
// consistency API-access mode (passing siteID/token explicitly) trades
// this for higher latency.

exports.handler = async (event) => {
  // This handler uses the classic (v1) `exports.handler` signature, i.e.
  // Blobs' "Lambda compatibility mode" — unlike the newer `export default`
  // function format, the environment isn't wired up automatically there;
  // confirmed via a real MissingBlobsEnvironmentError against `netlify dev`
  // before adding this. Must run before any getStore() call below.
  connectLambda(event);

  const store  = getStore(STORE_NAME);
  const errorsStore = getStore('errors');
  const method = event.httpMethod;
  const bid_id = event.queryStringParameters?.bid_id;

  let result;
  try {
    if (method === 'GET') {
      if (bid_id) {
        // Additive — not currently used by js/history.js's 4 call
        // shapes (that contract stays PATCH/DELETE-only by bid_id),
        // added for symmetry with those two and for any future direct
        // caller. Not a contract change.
        const record = await readBid(store, bid_id);
        result = record
          ? { statusCode: 200, body: JSON.stringify(record) }
          : { statusCode: 404, body: JSON.stringify({ error: 'No bid found for bid_id ' + bid_id }) };
      } else {
        const bids = await readAllBids(store);
        result = { statusCode: 200, body: JSON.stringify(bids) };
      }

    } else if (method === 'POST') {
      const bidRecord = JSON.parse(event.body || '{}');
      const record    = stampNewBid(bidRecord);
      await writeBid(store, record.bid_id, record);
      result = { statusCode: 200, body: JSON.stringify(record) };

    } else if (method === 'PATCH') {
      if (!bid_id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'bid_id query parameter is required' }) };
      } else {
        const patch    = JSON.parse(event.body || '{}');
        const existing = await readBid(store, bid_id);
        if (!existing) {
          result = { statusCode: 404, body: JSON.stringify({ error: 'No bid found for bid_id ' + bid_id }) };
        } else {
          const updated = mergeBidPatch(existing, patch);
          await writeBid(store, bid_id, updated);
          result = { statusCode: 200, body: JSON.stringify(updated) };
        }
      }

    } else if (method === 'DELETE') {
      if (!bid_id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'bid_id query parameter is required' }) };
      } else {
        // No existence check first — matches the prior array-filter
        // behavior's idempotent-delete semantics (deleting a
        // nonexistent id already silently succeeded). store.delete() on
        // a missing key is likewise a no-op.
        await deleteBidRecord(store, bid_id);
        result = { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

    } else {
      result = { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (err) {
    // POST (new bid can't be saved) / PATCH (an update/outcome-log can't
    // persist) are real data-loss risk to the estimator — notify. GET/
    // DELETE failures stay log-only (a read retried, or a delete that
    // can be retried, not lost data).
    if (method === 'POST' || method === 'PATCH') {
      await notifyTerminalFailure(errorsStore, 'bids', { method, bid_id }, err);
    } else {
      logError('bids', { method, bid_id }, err);
    }
    result = { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }

  // Applied to every response, success or error — see NO_STORE_HEADERS above.
  result.headers = Object.assign({}, result.headers, NO_STORE_HEADERS);
  return result;
};
