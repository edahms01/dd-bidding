// ─────────────────────────────────────────────────────────────────────
// drafts.js — Pure logic for the multi-draft data model (Phase 2)
// No DOM access, no localStorage access — record shaping, the one-time
// legacy migration, duplication, and deletion bookkeeping all live here
// so they're importable by the Vitest suite without dragging the rest
// of the app's global-script-tag code along with them.
//
// Everything else (localStorage I/O, activeDraftId state, event wiring,
// navigation) lives in js/forms.js, which is the only file that calls
// into this one from the browser.
// ─────────────────────────────────────────────────────────────────────

// In the browser, autosave.js has already loaded and buildExportPayload/
// migrateSchema are plain globals (classic <script> tags share one
// top-level scope). Under Node/Vitest each file is its own module scope,
// so pull them in explicitly there — same dual-mode bridge autosave.js
// itself uses for its CommonJS export below.
if (typeof module !== 'undefined' && module.exports && typeof buildExportPayload === 'undefined') {
  var { buildExportPayload, migrateSchema } = require('./autosave.js');
}

// ── DRAFT RECORD ─────────────────────────────────────────────────────
// state is a collectFormData()-shaped object. Reuses buildExportPayload
// so a draft record is exactly { id, createdAt, lastModifiedAt, ...the
// same shape Phase 1 already established } — no new shape invented.

function buildDraftRecord(state, id, createdAt, lastModifiedAt) {
  return {
    id,
    createdAt,
    lastModifiedAt,
    ...buildExportPayload(state)
  };
}

// ── LEGACY MIGRATION ─────────────────────────────────────────────────
// One-time: wraps a pre-Phase-2 dirigo_current_bid value into the new
// drafts model. Pure — the caller reads dirigo_drafts/dirigo_current_bid
// from localStorage, passes their raw values in here, and persists
// whatever comes back. Returns null as a no-op signal when drafts
// already exist (the exactly-once guarantee), so a second call with the
// same draftsAlreadyExist:true input is a safe no-op, not a double-wrap.
//
// currentBidState: the *already-parsed* legacy bid object, or null/
// undefined if there was nothing there (or it failed to parse — the
// caller's job, since JSON.parse belongs at the localStorage boundary,
// not in pure logic).

function migrateLegacyBidToDrafts({ currentBidState, draftsAlreadyExist, id, now }) {
  if (draftsAlreadyExist) return null;
  if (!currentBidState) return { drafts: {}, activeDraftId: null };

  const migrated = migrateSchema(currentBidState);
  const record   = buildDraftRecord(migrated, id, now, now);
  return { drafts: { [id]: record }, activeDraftId: id };
}

// ── DUPLICATE ─────────────────────────────────────────────────────────
// Deep clone (the record is already plain JSON-serializable) with a
// fresh id/timestamps — guarantees the copy is independent of the
// source; mutating one never touches the other.

function cloneDraftForDuplicate(sourceRecord, newId, now) {
  const copy = JSON.parse(JSON.stringify(sourceRecord));
  copy.id            = newId;
  copy.createdAt     = now;
  copy.lastModifiedAt = now;
  return copy;
}

// ── DELETE ────────────────────────────────────────────────────────────
// Returns the updated map and the id's replacement activeDraftId — null
// only when the removed draft was the active one, unchanged otherwise.

function removeDraftAndClearActiveIfNeeded(draftsMap, id, activeDraftId) {
  const next = { ...draftsMap };
  delete next[id];
  const nextActiveId = (id === activeDraftId) ? null : activeDraftId;
  return { drafts: next, activeDraftId: nextActiveId };
}

// ── OPEN DRAFT COUNT ──────────────────────────────────────────────────
// Pure — takes the drafts map and the currently-active draft id (both
// read from localStorage by the caller, js/forms.js) and returns how
// many *other* drafts are open. Excludes the active draft itself: the
// meaningful number for "how much is competing with this bid" is other
// open work, not including itself (Tier 1 scoping brief).

function getOpenDraftCount(draftsMap, activeDraftId) {
  return Object.keys(draftsMap || {}).filter(id => id !== activeDraftId).length;
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildDraftRecord,
    migrateLegacyBidToDrafts,
    cloneDraftForDuplicate,
    removeDraftAndClearActiveIfNeeded,
    getOpenDraftCount
  };
}
