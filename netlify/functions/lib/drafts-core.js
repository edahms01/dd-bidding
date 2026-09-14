// ─────────────────────────────────────────────────────────────────────
// drafts-core.js — Record shapes + store I/O for the drafts Netlify
// Function (Migration Phase 2, Step 2B). One Blobs record per draft,
// keyed by the same id js/forms.js's _generateDraftId() already
// produces client-side (id generation stays client-side — at this
// usage scale, one person working one project at a time, collision risk
// is a non-issue, no need to move it server-side).
//
// Mirrors lib/bid-agent-jobs.js's shape directly (the brief's designated
// reference pattern for this step) rather than bids-core.js's CRUD-verb
// shape: the client always sends a *complete* record (via the unchanged
// js/drafts.js's buildDraftRecord()) and owns id generation, so there's
// no server-side stamping or partial-merge need the way bids has.
//
// Store passed in as the first param to every I/O helper, same as
// bid-agent-jobs.js's readJob/writeJob — unit-testable without a
// running function (getStore() throws outside one), with a hand-rolled
// fakeStore(), no @netlify/blobs mocking library.
// ─────────────────────────────────────────────────────────────────────

const { readAllRecords } = require('./blob-collection.js');

const STORE_NAME = 'drafts';

// Client-generated ids (js/forms.js's _generateDraftId(): 'draft_' +
// Date.now() + '_' + a 5-char base36 suffix). Charset/length kept
// permissive — same shape as bid-agent-jobs.js's isValidJobId().
function isValidDraftId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(id);
}

async function readDraft(store, id) {
  const rec = await store.get(id, { type: 'json' });
  return rec || null;
}

async function writeDraft(store, id, record) {
  await store.setJSON(id, record);
}

async function deleteDraftRecord(store, id) {
  await store.delete(id);
}

// Returns { [id]: record } — already the exact shape js/forms.js's old
// getAllDrafts() returned from localStorage, so the client's
// _draftsCache can be populated directly from this with no reshaping.
async function readAllDrafts(store) {
  return readAllRecords(store);
}

module.exports = {
  STORE_NAME,
  isValidDraftId,
  readDraft,
  writeDraft,
  deleteDraftRecord,
  readAllDrafts
};
