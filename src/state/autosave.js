// ─────────────────────────────────────────────────────────────────────
// autosave.js — Pure logic for autosave/export/import (Phase 1)
// No DOM access — debounce, payload shaping, import validation, and
// the schema-migration seam all live here so they're importable by
// the Vitest suite (see tests/unit/autosave.test.js) without dragging
// the rest of the app's global-script-tag code along with them.
//
// Everything else (localStorage I/O, event wiring, the indicator UI)
// lives in js/forms.js, which is the only file that calls into this
// one from the browser.
//
// Migration Phase 5, Bucket 1, Step A: ported from js/autosave.js (a
// classic <script>-tag global) to a real ES module. Still called as a
// bare global from js/forms.js/js/ui.js (not yet converted) via the
// window bridge in src/state/legacyBridges.js. src/state/drafts.js
// (ported alongside this file, same step) imports buildExportPayload/
// migrateSchema directly — a real module dependency now, not a bridge.
//
// debounce()/AUTOSAVE_DEBOUNCE_MS deliberately did NOT move here — see
// js/debounce.js for why (their only two callers invoke debounce() at
// classic-script top level, which a module-script-timed window bridge
// can't satisfy; they have zero callers outside forms.js/ui.js anyway,
// so porting them isn't actually in scope until those files convert).
// ─────────────────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 1;

// ── EXPORT PAYLOAD ───────────────────────────────────────────────────
// state is a collectFormData()-shaped object:
// {project, conditions, rates, assemblies, walls, ceilings, intelligence, markupInputs}
// This is also the exact shape populateForm() expects back — autosave
// and export share this same builder so there's only one payload shape.

export function buildExportPayload(state) {
  // tabConfirmations is per-estimator review state, not part of the bid
  // itself — kept on the draft record (buildDraftRecord, src/state/drafts.js)
  // but stripped from exports/imports, so sharing a bid doesn't carry
  // someone else's "I reviewed this" marks, and the golden-export
  // fixture is unaffected by the feature.
  const { tabConfirmations, ...rest } = state || {};
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...rest
  };
}

// ── IMPORT VALIDATION ────────────────────────────────────────────────
// Deliberately minimal per Phase 1 scope: parses JSON and checks for
// the two required top-level keys. Not full section-by-section
// validation — that's out of scope for this phase.

export function validateImportPayload(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { valid: false, error: 'File is not valid JSON.' };
  }
  if (data === null || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain a JSON object.' };
  }
  if (data.schemaVersion === undefined) {
    return { valid: false, error: 'File is missing "schemaVersion".' };
  }
  if (data.project === undefined) {
    return { valid: false, error: 'File is missing "project".' };
  }
  return { valid: true, data };
}

// ── SCHEMA MIGRATION ─────────────────────────────────────────────────
// No-op passthrough at v1, but the seam exists now: on every load/
// import path, data flows through here before populateForm() sees it.
// Future versions add real migration steps in this function instead of
// ad-hoc legacy-fallback reads scattered through forms.js.

export function migrateSchema(data) {
  if (data === null || typeof data !== 'object') return data;
  const version = data.schemaVersion;
  if (version === undefined || version === null || version < CURRENT_SCHEMA_VERSION) {
    return { ...data, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
  return data;
}
