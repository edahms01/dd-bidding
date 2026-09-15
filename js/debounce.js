// ─────────────────────────────────────────────────────────────────────
// debounce.js — Trailing-edge debounce (split out of js/autosave.js,
// Migration Phase 5, Bucket 1, Step A)
//
// autosave.js ported to src/state/autosave.js this step, but debounce()
// and AUTOSAVE_DEBOUNCE_MS stay here, as their own small classic script,
// deliberately NOT ported alongside it. Their only two callers —
// js/forms.js:725 and js/ui.js:217 — both call debounce() at classic-
// script top level (module-scope, evaluated the instant the script
// parses), not from inside a function. That only works because this
// file, as a classic <script>, still loads and executes synchronously
// before forms.js/ui.js do; a src/state/ export reached through the
// window bridge in legacyBridges.js would not exist yet at that point,
// since legacyBridges.js runs from src/main.jsx — a `type="module"`
// script, which HTML always defers until after every classic script
// has already run. (Confirmed empirically: porting debounce alongside
// the rest of autosave.js broke __draftsBootPromise for the entire
// suite — forms.js's top-level `debounce(...)` call threw a
// ReferenceError before reaching its own `dirigo:shell-ready` listener.)
//
// debounce() has zero callers outside js/forms.js and js/ui.js — no
// React side, nothing in drafts.js — so it isn't actually in scope to
// port yet. It moves into src/state/ for real in Bucket 2, when
// forms.js/ui.js themselves convert and can import it directly instead
// of needing it as a synchronous global.
// ─────────────────────────────────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 700;

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AUTOSAVE_DEBOUNCE_MS, debounce };
}
