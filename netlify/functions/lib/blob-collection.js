// ─────────────────────────────────────────────────────────────────────
// blob-collection.js — shared "list keys, fetch each record" helper for
// one-Blobs-record-per-id stores (Migration Phase 2, Step 2A).
//
// The only place store.list() is used in this codebase (confirmed via
// grep before writing this — bid-agent-jobs.js, the reference per-id
// pattern this migration mirrors, never lists; it only ever knows one
// id at a time). Kept as a small shared module rather than inlined
// separately into bids-core.js and (Step 2B) drafts-core.js, so the
// list-then-fetch-each mechanics and their fakeStore()-based tests live
// in exactly one place.
// ─────────────────────────────────────────────────────────────────────

// Non-paginated store.list() (@netlify/blobs 11.x) resolves
// { blobs: [{key, etag}], directories: [] } in one call. Fetches every
// key's record in parallel and returns a plain { [key]: record } map.
//
// A key whose read races a concurrent delete (or hasn't propagated yet
// under Blobs' eventual-consistency model — see bids.js's readBids()
// header note) resolves null; it's skipped rather than included as a
// null entry, so callers never have to null-check every value.
//
// A key whose value isn't a plain record object — found via a real
// deploy-preview check (Migration Phase 2 Step 2A checkpoint): the
// shared prod bids store still held a legacy 'all'-keyed array blob
// from before this migration, which list()-then-fetch-each would
// otherwise include as one record whose value is itself an array,
// silently corrupting every caller's data (Bid History/Insights both
// misread it with no console error). Skipped the same way a null read
// is, so any pre-per-record-migration leftover key can never again
// silently corrupt a caller — not just the one instance already found
// and cleared from the live store.
function isPlainRecord(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

async function readAllRecords(store) {
  const { blobs } = await store.list();
  const entries = await Promise.all(
    blobs.map(async (b) => [b.key, await store.get(b.key, { type: 'json' })])
  );
  const map = {};
  for (const [key, record] of entries) {
    if (isPlainRecord(record)) map[key] = record;
  }
  return map;
}

module.exports = { readAllRecords };
