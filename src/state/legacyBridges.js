// ─────────────────────────────────────────────────────────────────────
// legacyBridges.js — window bridges for src/state/ modules that real
// browser code still reaches via `window.X`.
//
// Migration Phase 5, Bucket 2 rewrote this file's purpose. Through
// Phase 3 and Bucket 1, every entry here existed for exactly one reason:
// some other file (js/ui.js, js/forms.js, js/state.js) was still a
// classic <script>, so it could only reach a newly-ported ES module's
// exports via `window.X` — a temporary crutch, deleted as soon as that
// specific classic-script caller converted (Bucket 1 Steps A–D each
// deleted a slice this way; Bucket 2 Step 1 deleted the rest, since
// formState.js/forms.js/ui.js/debounce.js are the last of them and now
// import each other directly — see those four files themselves for the
// real import/export graph between them).
//
// What's left below is a different, PERMANENT kind of bridge: real
// production React code (pages/components) that calls these functions
// via `window.X` and is explicitly not being rewritten to import them
// directly — that rewrite is out of scope for this migration (see the
// Bucket 2 brief's own non-goal: "not in scope: rewriting this into
// React components/hooks"). These entries won't disappear just because
// every vanilla file eventually becomes a module; they're the same kind
// of standing bridge src/state/bridges.js's registerBridges() already
// provides for goto()/the __hydrateX family, just shaped as flat
// `window.X = fn` since none of these need a `dispatch` reference or a
// React lifecycle hook.
//
// The one temporary block still here: data/seed.js is a fifth classic-
// script consumer of formState.js/forms.js/ui.js the original Bucket-2
// brief didn't name (Migration Phase 5, Bucket 2, plan Finding 1) — its
// bridges are marked below and go away in Bucket 2 Step 2, once
// data/seed.js itself converts to a real module and imports them
// directly.
// ─────────────────────────────────────────────────────────────────────

import { collectFormData } from './formState.js';

import {
  exportBid,
  handleImportFile,
  _showFormToast,
  getAllDrafts,
  resumeActiveDraft,
  createDraft,
  switchToDraft,
  duplicateDraft,
  deleteDraft,
  _handleFormChange,
  _autosave,
  populateForm,
  _writeDraft,
  _generateDraftId,
  setActiveDraftId,
  _resetDraftsCache
} from './forms.js';

import {
  calculateOnly,
  runCalculation,
  submitBid,
  renderAgentTab,
  runAgentIfNeeded,
  _resetAgentCache,
  _renderPipelineHint
} from './ui.js';

// buildDraftRecord is the one drafts.js export still needed here —
// data/seed.js bare-calls it directly (Finding 1). cloneDraftForDuplicate/
// removeDraftAndClearActiveIfNeeded/migrateLegacyBidToDrafts/
// getOpenDraftCount were only ever bridged for forms.js's/ui.js's/
// formState.js's own sake — all three now import each of those directly
// from drafts.js instead (grep-confirmed no other caller).
import { buildDraftRecord } from './drafts.js';

// Real, non-obvious finding from running the full suite, not assumed
// clean from a `grep -rn "window\." src/` alone: several Playwright specs
// call these six via a *bare* (non-`window.`) identifier inside
// page.evaluate() — e.g. `page.evaluate(() => getHistorySummary(...))` —
// which only worked pre-Bucket-2 because classic <script>-declared
// `function`s become real global-object properties, reachable by bare
// identifier from any injected/evaluated script, not just other classic
// scripts (unlike the `let`-scoped globals like `_draftsCache`, which
// were never reachable that way even before this migration). A real ES
// module export doesn't do that, so these five specs broke the moment
// calculator.js's/history.js's own bridges here were deleted (they'd
// been carried, unnoticed, on the coattails of ui.js's now-superseded
// bridge need). Fixed at both ends: the five specs were updated to call
// `window.<fn>(...)` instead (rate-escalation.spec.js,
// agent-history-fallback.spec.js, agent-receives-real-history.spec.js,
// competitor-patterns.spec.js — the mechanism-only fix already
// established for this exact situation, e.g. Migration Phase 4's
// `_renderAgentResult()`-deletion fix), and these six bridges are
// restored — permanently, not migration-temporary, same category as the
// React-facing block above, just for a different real caller.
import {
  calculateWallCosts,
  calculateCeilingCosts,
  calculateLogistics,
  buildCostSummary,
  applyRateEscalation
} from './calculator.js';
import { getHistorySummary } from './history.js';

// ── Permanent — real React callers, confirmed with `grep -rn
// "window\.<name>\b" src/` (not comments, not tests) before adding each
// one. See the Bucket 2 plan's Finding 2 table for the full caller list
// per function. ──
window.collectFormData    = collectFormData;
window.exportBid          = exportBid;
window.handleImportFile   = handleImportFile;
window._showFormToast     = _showFormToast;
window._renderPipelineHint = _renderPipelineHint;
window.getAllDrafts       = getAllDrafts;
window.resumeActiveDraft  = resumeActiveDraft;
window.createDraft        = createDraft;
window.switchToDraft      = switchToDraft;
window.duplicateDraft     = duplicateDraft;
window.deleteDraft        = deleteDraft;
window._handleFormChange  = _handleFormChange;
window._autosave          = _autosave;
window.calculateOnly      = calculateOnly;
window.runCalculation     = runCalculation;
window.submitBid          = submitBid;
window.renderAgentTab     = renderAgentTab;

// ── Permanent — Playwright test-harness callers only (page.evaluate()
// bare-calling into the running page's globals). Not a React need, not a
// migration-temporary one; see the import comment above for how this
// was found. ──
window.calculateWallCosts    = calculateWallCosts;
window.calculateCeilingCosts = calculateCeilingCosts;
window.calculateLogistics    = calculateLogistics;
window.buildCostSummary      = buildCostSummary;
window.applyRateEscalation   = applyRateEscalation;
window.getHistorySummary     = getHistorySummary;

// ── Temporary — data/seed.js only. Bare-calls each of these directly
// (not via `window.`) today, exactly the way forms.js/ui.js used to call
// each other, because it's still a classic <script> sharing their old
// global scope. Delete this whole block in Bucket 2 Step 2 once
// data/seed.js is a real module and imports them instead. ──
window.populateForm       = populateForm;
window._writeDraft        = _writeDraft;
window._generateDraftId   = _generateDraftId;
window.setActiveDraftId   = setActiveDraftId;
window.runAgentIfNeeded   = runAgentIfNeeded;
window._resetAgentCache   = _resetAgentCache;
window.buildDraftRecord   = buildDraftRecord;
// data/seed.js currently does `_draftsCache = {}` as a bare reassignment
// of forms.js's private variable — no longer possible once forms.js is a
// module (an ES import is a read-only live view). _resetDraftsCache()
// (forms.js) is the real equivalent; bridged here under its established
// window.__x naming (matches window.__getDraftsCacheSync, the read-
// direction counterpart forms.js already defines itself).
window.__resetDraftsCache = _resetDraftsCache;
