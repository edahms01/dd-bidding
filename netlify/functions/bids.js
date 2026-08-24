// ─────────────────────────────────────────────────────────────────────
// bids.js — Netlify Function: bid history CRUD (Phase 3)
// Backs js/history.js's saveBid/getAllBids/updateBid/deleteBid. Single
// JSON array stored as one Blob (key 'all') — same shape localStorage
// held under dirigo_bids, deliberately not refactored to one-blob-per-
// bid in this phase (see Phase 3 handover brief, Part A). All record-
// shaping logic lives in bids-core.js so it's unit-testable without a
// running function; this file only does store I/O and HTTP routing.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { stampNewBid, mergePatch, removeBid } = require('./lib/bids-core.js');

const STORE_NAME = 'bids';
const ALL_KEY    = 'all';

// Every response here is dynamic/per-request — never let a browser, proxy,
// or Netlify's own edge cache serve a stale one. Paired with `cache:
// 'no-store'` on the client fetch() calls (js/history.js) as defense in
// depth. Confirmed this does NOT explain the eventual-consistency lag
// documented in readBids() below: the lag was re-measured against the live
// deploy preview with this header correctly present and was identical
// (still missing at 0ms, found by ~50ms) — it's genuinely Blobs' own
// cross-edge-node propagation, not an HTTP/CDN caching artifact. Kept
// anyway on general correctness grounds for dynamic API responses.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

async function readBids(store) {
  // Blobs stores are created implicitly on first write — a never-written
  // key just resolves to null, same as an empty dirigo_bids key did.
  //
  // Known characteristic, confirmed against the real deployed preview
  // (not reproducible against netlify dev's local emulator, which is
  // synchronous): getStore()'s default read path is eventually
  // consistent across edge nodes. A GET immediately following a POST
  // from a different location/edge node can occasionally miss that
  // write for longer than expected — one real test saw same-node reads
  // settle in ~100ms, but a reload-triggered read from the browser
  // still missed a just-submitted bid at ~1s before it appeared moments
  // later. Ruled out HTTP/CDN caching as the cause (see NO_STORE_HEADERS
  // above) — this is Blobs' own consistency model. Same "genuinely low
  // risk, not worth solving now" bucket as the concurrent-writes tradeoff
  // already accepted for this phase (single-estimator usage scale) — not
  // fixed here, but flagged since it's a real characteristic of this
  // architecture, not a bug. If it ever needs solving: getStore()'s
  // strong-consistency API-access mode (passing siteID/token explicitly)
  // trades this for higher latency.
  const bids = await store.get(ALL_KEY, { type: 'json' });
  return bids || [];
}

exports.handler = async (event) => {
  // This handler uses the classic (v1) `exports.handler` signature, i.e.
  // Blobs' "Lambda compatibility mode" — unlike the newer `export default`
  // function format, the environment isn't wired up automatically there;
  // confirmed via a real MissingBlobsEnvironmentError against `netlify dev`
  // before adding this. Must run before any getStore() call below.
  connectLambda(event);

  const store  = getStore(STORE_NAME);
  const method = event.httpMethod;

  let result;
  try {
    if (method === 'GET') {
      const bids = await readBids(store);
      result = { statusCode: 200, body: JSON.stringify(bids) };

    } else if (method === 'POST') {
      const bidRecord = JSON.parse(event.body || '{}');
      const bids       = await readBids(store);
      const record     = stampNewBid(bidRecord);
      bids.unshift(record);
      await store.setJSON(ALL_KEY, bids);
      result = { statusCode: 200, body: JSON.stringify(record) };

    } else if (method === 'PATCH') {
      const bid_id = event.queryStringParameters?.bid_id;
      if (!bid_id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'bid_id query parameter is required' }) };
      } else {
        const patch      = JSON.parse(event.body || '{}');
        const bids       = await readBids(store);
        const { bids: nextBids, updated } = mergePatch(bids, bid_id, patch);
        if (!updated) {
          result = { statusCode: 404, body: JSON.stringify({ error: 'No bid found for bid_id ' + bid_id }) };
        } else {
          await store.setJSON(ALL_KEY, nextBids);
          result = { statusCode: 200, body: JSON.stringify(updated) };
        }
      }

    } else if (method === 'DELETE') {
      const bid_id = event.queryStringParameters?.bid_id;
      if (!bid_id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'bid_id query parameter is required' }) };
      } else {
        const bids     = await readBids(store);
        const nextBids = removeBid(bids, bid_id);
        await store.setJSON(ALL_KEY, nextBids);
        result = { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

    } else {
      result = { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (err) {
    result = { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }

  // Applied to every response, success or error — see NO_STORE_HEADERS above.
  result.headers = Object.assign({}, result.headers, NO_STORE_HEADERS);
  return result;
};
