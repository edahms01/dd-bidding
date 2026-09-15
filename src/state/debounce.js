// ─────────────────────────────────────────────────────────────────────
// debounce.js — Trailing-edge debounce.
//
// Split out of autosave.js in Migration Phase 5, Bucket 1, Step A and
// kept as its own small classic script through Bucket 1 because its only
// two callers (js/forms.js, js/ui.js) called debounce() at classic-script
// top level, before a module-script bridge would have existed yet.
//
// Migration Phase 5, Bucket 2: forms.js/ui.js are real ES modules now and
// import debounce()/AUTOSAVE_DEBOUNCE_MS directly — no bridge needed for
// either. Nothing else calls this file's exports.
// ─────────────────────────────────────────────────────────────────────

export const AUTOSAVE_DEBOUNCE_MS = 700;

export function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
