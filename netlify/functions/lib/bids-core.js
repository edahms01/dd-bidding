// ─────────────────────────────────────────────────────────────────────
// bids-core.js — Pure logic for the bids Netlify Function (Phase 3)
// No @netlify/blobs, no network, no `event`/`context` handling — just
// the record-shaping and array bookkeeping bids.js delegates to. Kept
// separate so it's importable by the Vitest suite without needing a
// running function, same reasoning as js/autosave.js / js/drafts.js
// being pulled out of forms.js in Phases 1–2.
//
// Lives in functions/lib/, not functions/ directly — confirmed via
// `netlify dev` that Netlify treats every top-level .js file inside
// netlify/functions/ as its own deployable function (it briefly loaded
// this file as a broken no-handler "bids-core" function before the
// move). Only lib/'s siblings (bids.js, dev-seed-bids.js,
// dev-clear-bids.js) are meant to be endpoints.
//
// This is also where saveBid()'s old client-side id/date-stamping logic
// (js/history.js, pre-Phase-3) now lives — it moved server-side, it
// didn't get duplicated.
// ─────────────────────────────────────────────────────────────────────

// Assigns bid_id/date_submitted the same way the old client-side
// saveBid() did, so existing bid records (and any test fixtures) keep
// the same shape across the migration.
function stampNewBid(bidRecord) {
  return Object.assign({}, bidRecord, {
    bid_id:         'bid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date_submitted: new Date().toISOString().slice(0, 10)
  });
}

// Pure merge-patch — does not mutate bidsArray. Returns { bids, updated }
// where `updated` is the merged record, or null if bid_id has no match
// (caller maps that to a 404).
function mergePatch(bidsArray, bid_id, patch) {
  const idx = bidsArray.findIndex(b => b.bid_id === bid_id);
  if (idx === -1) return { bids: bidsArray, updated: null };

  const updated = Object.assign({}, bidsArray[idx], patch);
  const bids    = bidsArray.slice();
  bids[idx]     = updated;
  return { bids, updated };
}

// Pure filter — does not mutate bidsArray.
function removeBid(bidsArray, bid_id) {
  return bidsArray.filter(b => b.bid_id !== bid_id);
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────
// Netlify Functions run under Node/CommonJS (package.json "type":
// "commonjs"), so bids.js/dev-seed-bids.js/dev-clear-bids.js all
// `require()` this file directly — no browser-global bridge needed
// the way autosave.js/drafts.js need one, since nothing here ever
// loads as a <script> tag.

module.exports = {
  stampNewBid,
  mergePatch,
  removeBid
};
