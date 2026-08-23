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
// ─────────────────────────────────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 1;
const AUTOSAVE_DEBOUNCE_MS   = 700;

// ── DEBOUNCE ─────────────────────────────────────────────────────────
// Trailing-edge debounce: fn runs once, `wait` ms after the last call.

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ── EXPORT PAYLOAD ───────────────────────────────────────────────────
// state is a collectFormData()-shaped object:
// {project, conditions, rates, assemblies, walls, ceilings, intelligence, markupInputs}
// This is also the exact shape populateForm() expects back — autosave
// and export share this same builder so there's only one payload shape.

function buildExportPayload(state) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...state
  };
}

// ── IMPORT VALIDATION ────────────────────────────────────────────────
// Deliberately minimal per Phase 1 scope: parses JSON and checks for
// the two required top-level keys. Not full section-by-section
// validation — that's out of scope for this phase.

function validateImportPayload(raw) {
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

function migrateSchema(data) {
  if (data === null || typeof data !== 'object') return data;
  const version = data.schemaVersion;
  if (version === undefined || version === null || version < CURRENT_SCHEMA_VERSION) {
    return { ...data, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
  return data;
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────
// Browser <script> tags leave `module` undefined, so this is a no-op
// there — the functions above stay global exactly like the rest of
// the codebase's script-tag files.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CURRENT_SCHEMA_VERSION,
    AUTOSAVE_DEBOUNCE_MS,
    debounce,
    buildExportPayload,
    validateImportPayload,
    migrateSchema
  };
}
