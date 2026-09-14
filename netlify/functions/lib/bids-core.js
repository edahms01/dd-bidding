// ─────────────────────────────────────────────────────────────────────
// bids-core.js — Pure logic + store I/O for the bids Netlify Function
// (Migration Phase 2, Step 2A).
//
// Restructured from "operate on the whole bids array" to "operate on
// one record" — the backing store is now one Blobs record per bid,
// keyed by bid_id, mirroring lib/bid-agent-jobs.js's get/setJSON-by-id
// pattern (store passed in as the first param, so these stay testable
// with a hand-rolled fakeStore(), no @netlify/blobs mocking library).
//
// stampNewBid() is unchanged — it only ever shaped a single record.
// mergePatch(bidsArray, id, patch) is replaced by mergeBidPatch(record,
// patch), a plain merge with no array to scan. removeBid(bidsArray, id)
// is dropped entirely — deletion is now store.delete(bid_id), a single
// key removal with no array to filter, so a pure wrapper around it
// would be dead weight.
//
// Lives in functions/lib/, not functions/ directly — confirmed via
// `netlify dev` that Netlify treats every top-level .js file inside
// netlify/functions/ as its own deployable function (it briefly loaded
// this file as a broken no-handler "bids-core" function before the
// move). Only lib/'s siblings (bids.js, dev-seed-bids.js,
// dev-clear-bids.js) are meant to be endpoints.
// ─────────────────────────────────────────────────────────────────────

const { readAllRecords } = require('./blob-collection.js');

// Assigns bid_id/date_submitted the same way the old client-side
// saveBid() did, so existing bid records (and any test fixtures) keep
// the same shape across the migration.
function stampNewBid(bidRecord) {
  return Object.assign({}, bidRecord, {
    bid_id:         'bid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date_submitted: new Date().toISOString().slice(0, 10)
  });
}

// Pure merge — does not mutate existingRecord or patch.
function mergeBidPatch(existingRecord, patch) {
  return Object.assign({}, existingRecord, patch);
}

// Server-generated ids only (stampNewBid()'s own format) plus the
// pre-migration seed fixture ids ('seed-1'..'seed-5', data/seed.json) —
// charset kept permissive enough to cover both rather than hardcoding
// the bid_ prefix.
function isValidBidId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(id);
}

// ── I/O helpers (Vitest / Node) ──────────────────────────────────────
// Store passed in as the first param, same shape bid-agent-jobs.js's
// readJob/writeJob use — unit-testable without a running function.

async function readBid(store, bid_id) {
  const rec = await store.get(bid_id, { type: 'json' });
  return rec || null;
}

async function writeBid(store, bid_id, record) {
  await store.setJSON(bid_id, record);
}

async function deleteBidRecord(store, bid_id) {
  await store.delete(bid_id);
}

// Newest-first, matching the old array's insertion order (every POST
// used to unshift). bid_id embeds a fixed-width Date.now() prefix, so
// lexicographic descending sort is equivalent to chronological — this
// is belt-and-suspenders (BidsPage.jsx already re-sorts client-side),
// kept for any other direct API consumer.
async function readAllBids(store) {
  const map = await readAllRecords(store);
  return Object.values(map).sort((a, b) => (b.bid_id > a.bid_id ? 1 : a.bid_id > b.bid_id ? -1 : 0));
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────
// Netlify Functions run under Node/CommonJS (package.json "type":
// "commonjs"), so bids.js/dev-seed-bids.js/dev-clear-bids.js all
// `require()` this file directly — no browser-global bridge needed
// the way autosave.js/drafts.js need one, since nothing here ever
// loads as a <script> tag.

module.exports = {
  stampNewBid,
  mergeBidPatch,
  isValidBidId,
  readBid,
  writeBid,
  deleteBidRecord,
  readAllBids
};
