// ─────────────────────────────────────────────────────────────────────
// forms.js — Dynamic form row management (ported from js/forms.js,
// Migration Phase 5, Bucket 2)
//
// All mutable table rows (assemblies, walls, ceilings), net SF
// auto-calculation, confidence selector, pill toggles, and draft save.
//
// Future: row mutations dispatch actions to a state store; net SF
//         calculations move to the calculation engine in formState.js.
// ─────────────────────────────────────────────────────────────────────

import { collectFormData, STATE } from './formState.js';
import { calc, _resetAgentCache } from './ui.js';
import { debounce, AUTOSAVE_DEBOUNCE_MS } from './debounce.js';
import {
  buildDraftRecord,
  cloneDraftForDuplicate,
  removeDraftAndClearActiveIfNeeded,
  migrateLegacyBidToDrafts
} from './drafts.js';
import { buildExportPayload, validateImportPayload, migrateSchema } from './autosave.js';

// ── POPULATE FORM ─────────────────────────────────────────────────────
// Inverse of collectFormData() — reads a state object and writes values
// back into all form DOM elements. Used by loadSeedData() and
// resumeActiveDraft(). Foundation for the save-and-resume workflow.

export function populateForm(state) {
  function set(id, val) {
    const el = document.getElementById(id);
    if (el !== null && val !== undefined && val !== null) el.value = val;
  }

  // ── Project / Conditions / Intelligence / Rates ──
  // A2: all four sections are React-owned now. Each does BOTH a plain
  // set(id, val) write AND a window.__hydrateX dispatch — not one or the
  // other, on purpose, after getting this wrong twice on real code paths
  // (see CLAUDE.md's "Converting a page" checklist, items 4 and 5, for
  // the fuller writeup; both were found by reproducing the failure
  // directly, not assumed):
  //   1. Dispatch alone left every synchronous DOM read done before
  //      React's next commit reading stale data. loadSeedData() calls
  //      runCalculation() (reads the DOM via collectFormData())
  //      immediately after this function returns, in the same tick —
  //      Tab 7 showed "$0" right after "Load seed data" until something
  //      else re-triggered a calculation later. The plain set() writes
  //      below fix that: they're synchronous, so any read right after
  //      this function returns already sees the right values.
  //   2. The set() writes alone are exactly what a React-controlled
  //      input silently reverts on its *next* unrelated re-render
  //      (checklist item 3) — so the dispatch is still required too, not
  //      redundant with the writes. Both land the exact same final
  //      value, so there's no flicker to a *wrong* value in either
  //      direction — just two paths converging on one answer, the same
  //      shape as the resetFormFields() fix above.
  const p = state.project || {};
  set('proj-name',     p.name);
  set('proj-gc',       p.gc);
  set('proj-bid',      p.bidDate);
  set('proj-addr',     p.address);
  set('proj-type',     p.buildingType);
  set('proj-drawings', p.drawingsRef);
  set('proj-start',    p.startDate);
  // durationWeeks lives in project (new) or conditions (legacy) — try both
  set('proj-dur',    p.durationWeeks != null ? p.durationWeeks : (state.conditions || {}).durationWeeks);
  set('proj-floors', p.floors);

  if (Array.isArray(p.scope)) {
    document.querySelectorAll('.pills .pill').forEach(pill => {
      pill.classList.toggle('on', p.scope.includes(pill.dataset.scope || pill.textContent.trim()));
    });
  }
  set('proj-exclusions', p.exclusions);

  window.__hydrateProject?.({
    ...p,
    durationWeeks: p.durationWeeks != null ? p.durationWeeks : (state.conditions || {}).durationWeeks
  });

  // Update header badge — always a direct DOM write: the header's badge
  // span is static JSX ProjectPage never touches (see CLAUDE.md's
  // "static JSX = safe for external mutation" pattern), so there's no
  // reducer copy of this value to dispatch in the first place.
  const badge = document.querySelector('.proj-badge span');
  if (badge && p.name) badge.textContent = p.name;

  // Curved-walls-LF/phase-count visibility is CSS now (.rr-connected's
  // `expanded` class, css/components.css, toggled by React off
  // curvedWalls/phasedWork state) — NOT the style.display toggle this
  // block used to also set as a belt-and-suspenders measure.
  //
  // UI-fixes batch (2026-09-05): removed that display toggle outright,
  // not just left as "redundant." It was harmless back when the field
  // was conditionally MOUNTED — an unmount wipes any inline style for
  // free, so a stale one could never survive to the next render. Now
  // that the field is always mounted (required for the new expand/
  // collapse animation to have something to animate open from), the
  // same inline style persists indefinitely instead. Reproduced
  // directly, not assumed: load seed (phasedWork starts 'no', collapsed)
  // then flip the Phased-work select to 'yes' live in the browser — the
  // row visually expands via the CSS class, but #f-phase-n stays
  // display:none from this line's earlier seed-load write, permanently
  // uninteractable until the next full hydration happens to set it back
  // to 'block'. React's reconciler never touches this attribute either,
  // since no JSX here ever declared a `style` prop for React to own.
  // Value-only writes below are still required (checklist item 4 — a
  // synchronous DOM read right after this function returns needs the
  // correct value before React's own dispatch has flushed).
  const c = state.conditions || {};
  set('cond-maxht', c.maxHt);
  set('cond-sf12',  c.sfAbove12);
  set('cond-sf20',  c.sfAbove20);

  const curvedEl = document.getElementById('f-curved');
  const curvedLF = document.getElementById('f-curved-lf');
  if (curvedEl && c.curvedWalls) {
    curvedEl.value = c.curvedWalls;
    if (curvedLF && c.curvedWallsLF) curvedLF.value = c.curvedWallsLF;
  }

  set('f-exterior', c.exteriorExposure);

  const phaseEl = document.getElementById('f-phase');
  const phaseN  = document.getElementById('f-phase-n');
  if (phaseEl && c.phasedWork) {
    phaseEl.value = c.phasedWork;
    if (phaseN && c.phaseCount) phaseN.value = c.phaseCount;
  }

  set('f-access',    c.accessDifficulty);
  set('f-parking',   c.parking);
  set('cond-waste',  c.wastePct);
  set('cond-trips',  c.trips);
  set('cond-notes',  c.notes);
  // setConf() is dead in the browser path (ConditionsPage's confidence
  // buttons dispatch SET_FIELD directly) but still updates STATE.conf,
  // which window.__getConfidence's fallback (formState.js) needs correct
  // before ConditionsPage has ever mounted — keep calling it.
  if (c.confidence) setConf(c.confidence);

  window.__hydrateConditions?.(c);

  // ── Intelligence (part of ConditionsPage — same tab, same page in the
  // original markup) ──
  const intel = state.intelligence || {};
  set('intel-crew',           intel.crewAvailability);
  set('intel-pipeline',       intel.pipelinePressure);
  set('intel-material-trend', intel.materialTrend);
  set('intel-gc-rel',         intel.gcRelationship);
  set('intel-gc-price',       intel.gcPriceSensitivity);
  set('intel-competition',    intel.competitionLevel);
  set('intel-competitors',    intel.knownCompetitors);
  set('intel-edge',           intel.dirigoEdge);

  window.__hydrateIntelligence?.(intel);

  // ── Rates ──
  const r = state.rates || {};
  set('rate-frame',   r.framing);
  set('rate-hang',    r.hanging);
  set('rate-extwall', r.extwall);
  set('rate-burden',  r.burdenPct);
  set('rate-super',   r.superPct);
  if (r.finish) {
    set('rate-fin1', r.finish[1]);
    set('rate-fin2', r.finish[2]);
    set('rate-fin3', r.finish[3]);
    set('rate-fin4', r.finish[4]);
    set('rate-fin5', r.finish[5]);
  }
  set('rate-add12', r.adder12Pct);
  set('rate-add20', r.adder20Pct);
  if (r.stud) {
    set('rate-stud158', r.stud['1-5/8"']);
    set('rate-stud212', r.stud['2-1/2"']);
    set('rate-stud358', r.stud['3-5/8"']);
    set('rate-stud4',   r.stud['4"']);
    set('rate-stud6',   r.stud['6"']);
  }
  if (r.board) {
    set('rate-brd-std',   r.board['Standard']);
    set('rate-brd-typex', r.board['Type-X']);
    set('rate-brd-moist', r.board['Moisture']);
    set('rate-brd-imp',   r.board['Impact']);
  }
  set('rate-tape',     r.tape);
  set('rate-insul',    r.insul);
  set('rate-fasten',   r.fasten);
  set('rate-delivery', r.delivery);
  set('rate-disposal', r.disposal);
  set('rate-lift',     r.lift);

  const re = state.rateEscalation || {};
  if (re.stud) {
    set('esc-stud158', re.stud['1-5/8"']);
    set('esc-stud212', re.stud['2-1/2"']);
    set('esc-stud358', re.stud['3-5/8"']);
    set('esc-stud4',   re.stud['4"']);
    set('esc-stud6',   re.stud['6"']);
  }
  if (re.board) {
    set('esc-brd-std',   re.board['Standard']);
    set('esc-brd-typex', re.board['Type-X']);
    set('esc-brd-moist', re.board['Moisture']);
    set('esc-brd-imp',   re.board['Impact']);
  }
  set('esc-tape',   re.tape);
  set('esc-insul',  re.insul);
  set('esc-fasten', re.fasten);
  calc(); // refresh rates running totals bar — also required synchronously, same reason as the writes above

  window.__hydrateRates?.(state.rates, state.rateEscalation);

  // ── Markup (part of OutputPage now) ── same dual-write shape as
  // Project/Conditions/Intelligence/Rates above (checklist item 4) —
  // both the plain writes (for any synchronous read right after this
  // function returns) and the dispatch (so the next unrelated
  // re-render doesn't revert them) are required.
  const mu = state.markupInputs || {};
  set('markup-overhead',    mu.overheadPct);
  set('markup-contingency', mu.contingencyPct);
  set('markup-profit',      mu.profitPct);
  window.__hydrateMarkup?.(mu);

  // ── Tab confirmations ── reducer-only (no DOM). A pre-feature draft
  // has no such key; LOAD_SECTION's mergeDeep no-ops on undefined, so the
  // reducer keeps its default all-unconfirmed map.
  window.__hydrateTabConfirmations?.(state.tabConfirmations);

  // ── Assemblies (AssembliesPage is now React-owned) ──
  // window.__hydrateAssemblies dispatches into the reducer; AssembliesPage
  // owns the row list via .map(). Registered unconditionally at app load
  // (src/state/bridges.js, from AppShell's mount effect), before this
  // function can ever run — so no fallback is needed or kept (a classic-
  // script DOM rebuild here would fight React's own reconciliation of that
  // same list; see CLAUDE.md's "Converting a page" checklist items 7-8 for
  // the full reasoning, and this file's git history for the removed
  // addAsm()-based fallback and why it existed).
  if (state.assemblies !== undefined) window.__hydrateAssemblies?.(state.assemblies);

  // ── Walls (WallsPage is now React-owned) ── same shape/reasoning as
  // Assemblies above.
  // 3.3: state.wallsMode is undefined for any pre-3.3 draft/import —
  // LOAD_WALL_ROWS (store.jsx) falls back to the schema default
  // ('dimensions') itself, not handled here.
  if (state.walls !== undefined) window.__hydrateWalls?.(state.walls, state.wallsMode);

  // ── Ceilings (CeilingsPage is now React-owned) ── same shape as Walls above.
  if (state.ceilings !== undefined) window.__hydrateCeilings?.(state.ceilings, state.ceilingsMode);
}

// ── DRAFTS DATA LAYER (Migration Phase 2, Step 2B) ──────────────────
// Server is now the SOLE source of truth for drafts — no dual-write to
// localStorage as a "cache," no sync-conflict logic. _draftsCache is a
// plain in-memory mirror, reset every page load (never persisted): every
// successful read/write updates it, and every mutation fires
// 'dirigo:drafts-changed' so React consumers (useDraftsList(), see
// src/state/useDraftsList.js) can stay in sync without polling.
//
// dirigo_active_draft_id stays local-only, deliberately — it's per-
// *browser* state ("which draft is this tab looking at"), not per-bid
// data; see the migration plan for the full reasoning. activeDraftId
// mirrors that key in memory (same pattern as hasUnsavedChanges below).

const ACTIVE_DRAFT_KEY = 'dirigo_active_draft_id';
const LEGACY_BID_KEY   = 'dirigo_current_bid';
// Repurposed as an inert "has the one-time legacy migration already run"
// marker only — see _runLegacyMigrationIfNeeded() below. Drafts
// themselves no longer live under this key.
const DRAFTS_KEY = 'dirigo_drafts';

const DRAFTS_ENDPOINT = '/.netlify/functions/drafts';

// Migration Phase 5, Bucket 2: exported as real, live ES module bindings
// — formState.js's collectFormData() and ui.js's _renderPipelineHint()
// both import these directly now instead of reading them as bare
// identifiers via shared classic-script global scope. An importer sees
// live updates when this file reassigns them (a standard ESM `export
// let` guarantee) but cannot itself reassign them — only this file does.
export let activeDraftId = null;
export let _draftsCache  = {};

// Read-direction bridge for React/module-scope consumers (useDraftsList())
// — a real `import` isn't an option for React's separately-bundled call
// sites (see this file's own header note on why bridges still exist for
// those, even though they no longer exist between formState.js/forms.js/
// ui.js themselves).
//
// Guarded — Migration Phase 5, Bucket 2: this file is a real ES module
// now, and ui.js (imported by tests/unit/ui.test.js under Vitest's plain
// 'node' environment, no `window`) imports from this one — so every
// top-level `window.*` touch in this file needs the same guard ui.js's
// own top-level statements already carry (CLAUDE.md checklist item 9),
// not just the ones this file happened to need before it was reachable
// from Vitest at all.
if (typeof window !== 'undefined') {
  window.__getDraftsCacheSync = () => _draftsCache;
}

// Migration Phase 5, Bucket 2, Step 2 (pending): data/seed.js still bare-
// assigns `_draftsCache = {}` directly today, which only works because
// classic scripts share one global lexical scope — a real ES module
// export is a read-only live binding to every importer, so there is no
// equivalent bare-assignment path once forms.js is a module. This setter
// is data/seed.js's replacement, bridged in legacyBridges.js until
// data/seed.js itself converts (Bucket 2, Step 2), at which point it can
// import and call this directly and the bridge goes away.
export function _resetDraftsCache() {
  _draftsCache = {};
}

export async function getAllDrafts() {
  const res = await fetch(DRAFTS_ENDPOINT, { cache: 'no-store' });
  if (!res.ok) throw new Error('getAllDrafts failed: ' + res.status);
  const map = await res.json();
  _draftsCache = map;
  window.dispatchEvent(new CustomEvent('dirigo:drafts-changed'));
  return map;
}

async function _readDraftRemote(id) {
  const res = await fetch(DRAFTS_ENDPOINT + '?id=' + encodeURIComponent(id), { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('readDraft failed: ' + res.status);
  return res.json();
}

export async function _writeDraft(id, record) {
  const res = await fetch(DRAFTS_ENDPOINT + '?id=' + encodeURIComponent(id), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(record)
  });
  if (!res.ok) throw new Error('draft save failed: ' + res.status);
  const saved = await res.json();
  // Optimistic in-memory update from the response — no extra round-trip.
  _draftsCache = { ..._draftsCache, [id]: saved };
  window.dispatchEvent(new CustomEvent('dirigo:drafts-changed'));
  return saved;
}

async function _deleteDraftRemote(id) {
  const res = await fetch(DRAFTS_ENDPOINT + '?id=' + encodeURIComponent(id), { method: 'DELETE', cache: 'no-store' });
  if (!res.ok) throw new Error('draft delete failed: ' + res.status);
  const next = { ..._draftsCache };
  delete next[id];
  _draftsCache = next;
  window.dispatchEvent(new CustomEvent('dirigo:drafts-changed'));
}

export function setActiveDraftId(id) {
  activeDraftId = id;
  if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
  else localStorage.removeItem(ACTIVE_DRAFT_KEY);
}

export function _generateDraftId() {
  return 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── LEGACY MIGRATION ─────────────────────────────────────────────────
// Out of scope for Step 2B — explicitly not to be redesigned. One-time:
// wraps a pre-Phase-2 dirigo_current_bid value into a draft.
// migrateLegacyBidToDrafts() itself (src/state/drafts.js) and the
// draftsAlreadyExist exactly-once guard are untouched, pure logic.
//
// The one necessary adaptation: this function's WRITE step used to be a
// bulk localStorage map save (_saveDraftsMap()), which no longer exists
// — drafts have no functional localStorage persistence at all now, only
// the server does. The migrated draft (if any) is written through the
// same server-backed _writeDraft() every other mutation in this file
// now uses. DRAFTS_KEY stays as the exactly-once marker only — its
// content is never read as real draft data again, so writing an inert
// '{}' into it after migration is enough to keep the guard working.
async function _runLegacyMigrationIfNeeded() {
  const draftsAlreadyExist = localStorage.getItem(DRAFTS_KEY) !== null;
  let currentBidState = null;
  try {
    currentBidState = JSON.parse(localStorage.getItem(LEGACY_BID_KEY) || 'null');
  } catch (e) {
    currentBidState = null; // corrupt legacy value — start clean rather than crash
  }

  const result = migrateLegacyBidToDrafts({
    currentBidState,
    draftsAlreadyExist,
    id:  _generateDraftId(),
    now: new Date().toISOString()
  });
  if (result === null) return; // already migrated — no-op

  if (result.activeDraftId) {
    await _writeDraft(result.activeDraftId, result.drafts[result.activeDraftId]);
  }
  setActiveDraftId(result.activeDraftId);
  localStorage.removeItem(LEGACY_BID_KEY);
  localStorage.setItem(DRAFTS_KEY, '{}'); // marker only — see comment above
}

// ── RESUME ACTIVE DRAFT ──────────────────────────────────────────────
// Invariant: the workflow view is never shown without an active draft.
// If none exists yet (fresh install) or the referenced record is
// missing (corrupt state), _createAndActivateBlankDraft() creates one
// on the spot rather than leaving activeDraftId null under an editable
// form.
//
// Now async — "does the draft exist" is a network call, not a
// synchronous map lookup. Every navigation entry point into the
// workflow (createDraft(), switchToDraft(), AppShell's #/bids/<id> hash
// route) awaits the captured window.__draftsBootPromise (set by
// _initApp() below) before doing anything else, so no code path can
// navigate into the workflow with an unresolved activeDraftId — the
// invariant holds even though boot is no longer instant. Exposes
// state.ui.draftBootStatus ('loading'|'ready'|'error') via the
// window.__setDraftBootStatus bridge (src/state/bridges.js) — 'error'
// is the one genuinely new failure surface this step introduces, since
// today's synchronous version could never fail at all.
export async function resumeActiveDraft() {
  const id = localStorage.getItem(ACTIVE_DRAFT_KEY);
  try {
    const drafts = await getAllDrafts(); // warms _draftsCache for every sync reader in one shot
    const record = id ? drafts[id] : null;

    if (!record) {
      await _createAndActivateBlankDraft();
    } else {
      activeDraftId = id;
      populateForm(migrateSchema(record));
      hasUnsavedChanges = false;
      _setIndicator('saved', new Date(record.lastModifiedAt));
    }
    window.__setDraftBootStatus?.('ready');
  } catch (e) {
    window.__setDraftBootStatus?.('error');
  }
}

// ── RESET FORM FIELDS ────────────────────────────────────────────────
// Inverse of populateForm() — blanks every field back to the same state
// a truly fresh page load starts in. Used whenever a blank draft
// becomes active. Doesn't touch Tab 7/Tab 8 output — goto() already
// unconditionally calls runCalculation()/renderAgentTab() on every
// visit to those tabs, so they self-refresh from whatever draft is
// active by the time the user gets there.

export function resetFormFields() {
  function clear(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }

  // ── Project ──
  ['proj-name', 'proj-gc', 'proj-bid', 'proj-addr', 'proj-type', 'proj-drawings',
   'proj-start', 'proj-dur', 'proj-floors', 'proj-exclusions'].forEach(clear);

  // Scope pills — back to the two static HTML defaults
  document.querySelectorAll('.pills .pill').forEach(pill => {
    const scope = pill.dataset.scope || pill.textContent.trim();
    pill.classList.toggle('on', scope === 'Metal framing' || scope === 'Drywall');
  });

  // ── Conditions ──
  ['cond-maxht', 'cond-sf12', 'cond-sf20', 'f-exterior', 'f-access', 'f-parking',
   'cond-waste', 'cond-trips', 'cond-notes'].forEach(clear);

  clear('f-curved');
  clear('f-curved-lf');

  clear('f-phase');
  clear('f-phase-n');

  setConf('');

  // ── Intelligence ──
  ['intel-crew', 'intel-pipeline', 'intel-material-trend', 'intel-gc-rel',
   'intel-gc-price', 'intel-competition', 'intel-competitors', 'intel-edge'].forEach(clear);

  // ── Rates ──
  ['rate-frame', 'rate-hang', 'rate-extwall', 'rate-burden', 'rate-super',
   'rate-fin1', 'rate-fin2', 'rate-fin3', 'rate-fin4', 'rate-fin5',
   'rate-add12', 'rate-add20',
   'rate-stud158', 'rate-stud212', 'rate-stud358', 'rate-stud4', 'rate-stud6',
   'rate-brd-std', 'rate-brd-typex', 'rate-brd-moist', 'rate-brd-imp',
   'rate-tape', 'rate-insul', 'rate-fasten', 'rate-delivery', 'rate-disposal', 'rate-lift',
   'esc-stud158', 'esc-stud212', 'esc-stud358', 'esc-stud4', 'esc-stud6',
   'esc-brd-std', 'esc-brd-typex', 'esc-brd-moist', 'esc-brd-imp',
   'esc-tape', 'esc-insul', 'esc-fasten'
  ].forEach(clear);
  calc(); // refresh rates running totals bar to zero, mirroring populateForm()

  // ── A2: also reset the React-owned copy of all four sections above ──
  // The plain clear() calls above are still required, not superseded:
  // _createAndActivateBlankDraft() calls collectFormData() (reads live
  // DOM .value) immediately after this function returns, in the same
  // tick, before React ever gets a chance to flush a dispatch — so the
  // DOM has to already be correct synchronously. But a dispatch is
  // *also* required, separately: React dispatches are batched/async, so
  // without this, the next time anything re-renders ProjectPage/
  // ConditionsPage/RatesPage (e.g. the goto('project') dispatch
  // createDraft() issues right after this call), React would silently
  // restore the OLD reducer values into the DOM, undoing every clear()
  // above the instant the user looked at the screen. Reproduced
  // directly, not assumed: fill #rate-frame, click New Bid, and find
  // "77" still showing on the Rates tab afterward — that was the first
  // version of this fix, dispatch-only, no plain clear() calls; fixed by
  // keeping both, not by picking one. No-ops outside the browser
  // (Vitest, or before AppShell has mounted).
  window.__resetBidState?.();

  const badge = document.querySelector('.proj-badge span');
  if (badge) badge.textContent = 'New bid';

  // ── Markup ──
  ['markup-overhead', 'markup-contingency', 'markup-profit'].forEach(clear);

  // ── Assemblies — AssembliesPage now owns #asm-body's children via
  // .map() over state.bid.assemblies; window.__resetBidState() above
  // already resets that array to one blank row (store.jsx's RESET_BID),
  // flushSync'd so it's already reflected in the DOM by the time this
  // function returns. Directly rebuilding #asm-body here too — the way
  // this used to, and the way Walls/Ceilings below still do — would
  // fight React's own ownership of that list (a real, different hazard
  // than the leaf-value case every other section's fallback branch
  // handles; see CLAUDE.md's "Converting a page" checklist and
  // bridges.js's window.__hydrateAssemblies comment). Non-browser
  // fallback: window.__resetBidState won't exist (Vitest doesn't mount
  // React), so this leaves #asm-body empty in that context — harmless,
  // since this module isn't imported by any Vitest test today.

  // ── Walls / Ceilings — WallsPage/CeilingsPage now own #wall-body/
  // #ceil-body's children via .map(); window.__resetBidState() above
  // already reset both arrays to one blank row each (flushSync'd, same
  // as Assemblies — see its comment above for why direct DOM rebuild
  // here would fight React's ownership of those lists now).
}

// ── DRAFT LIFECYCLE ──────────────────────────────────────────────────

// Shared guard for every path about to hand the visible form to a
// *different existing* draft: flushes the outgoing draft's pending
// autosave — not via the debounced wrapper, and not a confirm()
// interrupt — so no keystroke is ever lost (resolves the mid-debounce-
// switch edge case the same way import-overwrite is already gated by
// hasUnsavedChanges, just as a flush instead of a prompt, since there's
// nothing external to validate here). Also resets Tab 8's cached agent
// result so it can't leak across drafts.
//
// Deliberately NOT async, and deliberately NOT awaited by its callers
// before they do their own DOM work (resetFormFields()/populateForm()) —
// found via a real Playwright race, not assumed: an earlier version
// awaited _autosave() here before returning, which pushed the caller's
// DOM-mutating step behind a real network round trip. That turned what
// used to be a same-tick synchronous guarantee (the old sync
// _flushAndSwitch()) into a several-millisecond gap — long enough for a
// fast fill() (or, in principle, a fast typist) landing in that window
// to get silently wiped once the deferred reset/populate finally ran.
// _autosave() itself calls collectFormData() synchronously before its
// own first internal await, so calling it here — without awaiting —
// still correctly captures the OUTGOING draft's current data before the
// caller's very next (synchronous) line changes the DOM. Callers await
// the returned promise afterward, once their own synchronous DOM work is
// done, to preserve the "outgoing edit is sent before we're finished
// switching" ordering guarantee (bids-open-draft-switch-race.spec.js).
function _flushAndSwitch() {
  const flushed = hasUnsavedChanges ? _autosave() : Promise.resolve();
  _resetAgentCache();
  return flushed;
}

// The only place any code path creates/activates a blank draft — the
// shared primitive behind createDraft(), the "no active draft" auto-heal
// in resumeActiveDraft() above, deleteDraft()'s active-branch, and
// clearFinalizedDraft() below. Always resets the Tab 8 agent cache
// itself (rather than trusting every caller to remember the pairing) —
// idempotent, so the redundant call from _flushAndSwitch() in the
// createDraft() path is harmless. Does not navigate.
async function _createAndActivateBlankDraft({ announce } = {}) {
  resetFormFields();
  const id  = _generateDraftId();
  const now = new Date().toISOString();
  await _writeDraft(id, buildDraftRecord(collectFormData(), id, now, now));
  setActiveDraftId(id);
  hasUnsavedChanges = false;
  _setIndicator('idle');
  _resetAgentCache();
  if (announce) _showFormToast('Started a new bid', 'success');
  return id;
}

export async function createDraft() {
  await window.__draftsBootPromise;
  // _flushAndSwitch() is called (not awaited) immediately before
  // _createAndActivateBlankDraft() so its resetFormFields() — and this
  // function's own new-draft setup — runs in the same synchronous tick
  // as this line, not deferred behind the outgoing draft's network
  // flush. Both promises are awaited below, after the DOM work is
  // already done. See _flushAndSwitch()'s own comment for the race this
  // ordering fixes.
  const flush = _flushAndSwitch();
  const created = _createAndActivateBlankDraft();
  await flush;
  await created;
  window.goto('project');
}

export async function switchToDraft(id) {
  await window.__draftsBootPromise;
  // Existence check first (matches the prior sync-map-lookup order) —
  // a single-id GET, not a full-list fetch, since only this one record
  // is needed. If it's gone (stale UI, deleted elsewhere), bail before
  // flushing the outgoing draft's autosave for nothing. Unavoidably
  // async (we need the incoming draft's data before populating) — but
  // an edit landing on the OUTGOING draft during this wait isn't lost:
  // _flushAndSwitch() below captures collectFormData() synchronously
  // at call time, after this read resolves, so it picks up anything
  // typed in the meantime.
  const record = await _readDraftRemote(id);
  if (!record) return;

  // Same ordering fix as createDraft() above — trigger the flush, then
  // do the synchronous DOM work (populateForm) immediately, then await.
  const flush = _flushAndSwitch();
  populateForm(migrateSchema(record));
  setActiveDraftId(id);
  hasUnsavedChanges = false;
  _setIndicator('saved', new Date(record.lastModifiedAt));
  await flush;
  window.goto('project');
}

export async function duplicateDraft(id) {
  const source = await _readDraftRemote(id);
  if (!source) return;

  const newId = _generateDraftId();
  await _writeDraft(newId, cloneDraftForDuplicate(source, newId, new Date().toISOString()));
}

// Dialog-free by design so it stays directly unit-testable — the
// confirm() from the brief lives in BidsPage.jsx's UI-layer wrapper, not
// here.
export async function deleteDraft(id) {
  // Pure decision (does this removal clear activeDraftId) runs against
  // the current in-memory cache — no network read needed just to decide
  // that.
  const result = removeDraftAndClearActiveIfNeeded(_draftsCache, id, activeDraftId);
  await _deleteDraftRemote(id);
  // Invariant: never leave activeDraftId null. removeDraftAndClearActiveIfNeeded()
  // only returns null here when the deleted draft was the active one (or there
  // already wasn't one, which shouldn't happen post-init) — either way, replace
  // it immediately rather than leaving a draftless editable form.
  if (result.activeDraftId === null) await _createAndActivateBlankDraft({ announce: true });
}

// Called by submitBid() (src/state/ui.js) right after saveBid() succeeds — the
// finalized draft now lives permanently in the bids store, so it's
// deleted from the drafts store and immediately replaced with a fresh
// blank active draft (never a bare null — same invariant as
// deleteDraft() above). The Tab 7 "Bid submitted ✓" confirmation screen
// currently on-screen is untouched; resetFormFields() only affects Tabs
// 1–6 underneath it.
//
// announce:false, unlike deleteDraft() — post-finalize FinalizeModal.jsx
// navigates the user to Home, not this blank draft, so a "Started a new
// bid" toast would announce something they didn't ask for and would
// collide with BidSubmitToast at the same screen corner. deleteDraft()
// keeps announce:true — that path does land the user on the blank draft.
export async function clearFinalizedDraft() {
  if (!activeDraftId) return;
  await _deleteDraftRemote(activeDraftId);
  await _createAndActivateBlankDraft({ announce: false });
}

// ── CONFIDENCE ────────────────────────────────────────────────────────

export function setConf(v) {
  STATE.conf = v;
  ['hi', 'md', 'lo'].forEach(c => {
    document.getElementById('c-' + c).className = 'conf-btn' + (c === v ? ' ' + c : '');
  });
}

// ── AUTOSAVE ─────────────────────────────────────────────────────────
// Continuous debounced autosave to localStorage. Delegated on
// .workflow-area rather than per-field, so rows added later by
// addWall()/addCeil()/addAsm() are covered without rebinding.

export let hasUnsavedChanges = false;

// A2 spike: real bug found, not assumed. hasUnsavedChanges is a plain
// top-level `let` — unlike a `function` declaration, `let`/`const` at
// classic-script top level do NOT become window properties, only bare
// script-scope bindings. React code (RatesPage.jsx) can't read a bare
// identifier from another file, so `window.hasUnsavedChanges` from
// there was always undefined — silently skipping the "overwrite my
// unsaved changes?" confirm() before loading a rate template. One
// accessor, not retrofitting every one of this flag's assignment sites.
// Guarded — same reason as window.__getDraftsCacheSync above.
if (typeof window !== 'undefined') {
  window.__getHasUnsavedChanges = () => hasUnsavedChanges;
}

export function _setIndicator(status, when) {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.className = 'autosave-indicator ' + status;
  if (status === 'saving') {
    el.textContent = 'Saving…';
  } else if (status === 'saved') {
    const t = (when || new Date()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    el.textContent = 'Saved ✓ ' + t;
  } else if (status === 'error') {
    // Copy updated for Step 2B — a failed save is now (almost always) a
    // network/function failure, not a browser-storage failure, so the
    // old "Check storage" text would be actively misleading.
    el.textContent = 'Save failed. Check your connection';
  } else {
    el.textContent = '';
  }
}

export function _showFormToast(message, kind) {
  const existing = document.getElementById('form-toast');
  if (existing) existing.remove();

  const isError = kind === 'error';
  const toast = document.createElement('div');
  toast.id = 'form-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'background:var(--surface)',
    'border:1px solid ' + (isError ? 'rgba(232,92,74,.4)' : 'rgba(58,191,122,.35)'),
    'border-radius:var(--rl)', 'padding:12px 18px',
    'color:' + (isError ? '#e85c4a' : 'var(--green)'), 'font-size:13px', 'font-weight:500',
    'box-shadow:0 4px 12px rgba(0,0,0,.3)', 'z-index:1100',
    'transition:opacity .4s ease'
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, isError ? 5000 : 3000);
}

// Now async — a network write. The debounce wrapper below is unchanged:
// it wraps this whole function, so it still fires at most once per
// 700ms of inactivity regardless of how long the network call itself
// takes. On failure, hasUnsavedChanges deliberately stays true (only
// cleared on success, same as before) — this gives two free retry paths
// with no new mechanism: the next keystroke re-arms the debounce, and
// _flushAndSwitch() (a draft switch, or the beforeunload guard) retries
// directly. No automatic timer-based retry — avoids hammering a down
// network or double-writing a save that actually succeeded server-side
// but timed out on the response (Open Question 2, plan-approved).
export async function _autosave() {
  try {
    const record = buildDraftRecord(collectFormData(), activeDraftId,
      _draftsCache[activeDraftId]?.createdAt || new Date().toISOString(), new Date().toISOString());
    await _writeDraft(activeDraftId, record);
    hasUnsavedChanges = false;
    _setIndicator('saved');
  } catch (e) {
    _setIndicator('error');
  }
}

const _debouncedAutosave = debounce(_autosave, AUTOSAVE_DEBOUNCE_MS);

// Migration Phase 5, Bucket 2: exported for real, direct import by
// React/module consumers that used to reach this via `window.X` because
// classic-script `function` declarations happened to become window
// properties automatically — a real ES module export doesn't do that,
// so every remaining `window.*` consumer needs an explicit bridge now
// (src/state/legacyBridges.js), same as every other function in this
// file that crosses the vanilla/React boundary.
export function _handleFormChange() {
  hasUnsavedChanges = true;
  _setIndicator('saving');
  _debouncedAutosave();
  // 4.2: reactive calculation. Independent debounced timer from the
  // autosave one above (ui.js's window.scheduleRecalc, its own 500ms).
  window.scheduleRecalc?.();
}

// Guarded — same reason as window.__getDraftsCacheSync above.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ── EXPORT / IMPORT ──────────────────────────────────────────────────

export function exportBid() {
  const payload = buildExportPayload(collectFormData());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'dirigo_bid_export.json';
  a.click();
}

export function handleImportFile(event) {
  const input = event.target;
  const file  = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const result = validateImportPayload(reader.result);
    if (!result.valid) {
      _showFormToast('Import failed: ' + result.error, 'error');
      input.value = ''; // allow reselecting the same filename after fixing it
      return;
    }

    if (hasUnsavedChanges && !confirm('Importing will overwrite your current unsaved changes. Continue?')) {
      input.value = '';
      return;
    }

    const migrated = migrateSchema(result.data);
    populateForm(migrated);
    try {
      // Imports replace the currently active draft's contents (same
      // semantics as before Phase 2 — "import overwrites the current
      // bid" — just now a server write instead of a bulk localStorage
      // map save). The invariant that the workflow view is never shown
      // without an active draft means activeDraftId is always set here,
      // regardless of which view the Import button was clicked from.
      const record = buildDraftRecord(migrated, activeDraftId,
        _draftsCache[activeDraftId]?.createdAt || new Date().toISOString(), new Date().toISOString());
      await _writeDraft(activeDraftId, record);
      hasUnsavedChanges = false;
      _setIndicator('saved');
      _showFormToast('Bid imported ✓', 'success');
    } catch (e) {
      _setIndicator('error');
    }
    input.value = '';
  };
  reader.onerror = () => {
    _showFormToast('Import failed. Could not read the file.', 'error');
    input.value = '';
  };
  reader.readAsText(file);
}

// ── INIT ─────────────────────────────────────────────────────────────
//
// A2 spike: this whole section used to run at plain classic-<script>-load
// time (originally gated only on DOMContentLoaded for the drafts/resume
// part — see the preserved comment below). That was safe when every page
// was static HTML already present the instant the parser reached this
// script tag. It is NOT safe now that AppShell (React) owns the page
// shell and Assemblies/Walls/Ceilings/etc. only get their real markup
// cloned in from a <template> inside a post-mount effect — confirmed by
// reproducing the failure directly: addAsm() threw on a null #asm-body,
// and separately, .workflow-area not existing yet meant the input/change
// listener that drives autosave was silently never attached at all.
// DOMContentLoaded doesn't fix this either — module scripts run before
// DOMContentLoaded fires, but React's useEffect is scheduled for after
// paint, a race against it, not a guarantee of ordering.
//
// Fix: everything in this section that touches React-owned DOM now runs
// off AppShell's 'dirigo:shell-ready' event (src/AppShell.jsx), dispatched
// once every LegacyPage child's mount effect has already cloned its
// template in (children's effects fire before a parent's, in the same
// commit — by the time AppShell's own effect dispatches this, every
// template is in).
//
// Migration Phase 5, Bucket 2: this file is a real ES module now, so
// calc() (ui.js) is a guaranteed-resolved import rather than a bare
// identifier that only worked once ui.js's <script> tag had also
// finished loading — the load-order hazard the original version of this
// comment warned about (populateForm() -> calc() throwing "calc is not
// defined" if called too early) can no longer happen via that mechanism.
// The 'dirigo:shell-ready' gating stays regardless: the real remaining
// hazard is DOM elements that don't exist yet (React hasn't cloned the
// <template>s in), not module load order.
function _initApp() {
  // addAsm()/addWall()/addCeil() all removed from this unconditional
  // boot-time call — AssembliesPage/WallsPage/CeilingsPage now each own
  // their own <tbody> via .map() over state.bid.{assemblies,walls,
  // ceilings}, which already start with one blank row apiece
  // (store.jsx's initialState, matching what these calls used to
  // establish here). Calling them directly would append a rogue <tr>
  // that React doesn't know about into a list it also renders — found
  // by reproducing it directly on Assemblies first (a debug read showed
  // a leftover addAsm()-generated row, complete with its inline
  // style="width:...px" and onchange="updateAsmId(...)" attributes,
  // sitting in #asm-body despite AssembliesPage.jsx never rendering
  // anything that looks like that) — audited every other addAsm()/
  // addWall()/addCeil() call site across the whole app before starting
  // Walls/Ceilings specifically because of that (duplicateDraft() only
  // clones plain data via drafts.js, never touches the DOM;
  // switchToDraft() only goes through populateForm(); this was the only
  // other unconditional direct call site, for the same reason the
  // addAsm() one was).

  // Both now async (Step 2B — draft storage is a network call). Captured
  // on window so createDraft()/switchToDraft() (any navigation entry
  // point into the workflow) can await it before doing anything else —
  // the mechanism that keeps the "never editable with nowhere to save"
  // invariant holding once "does the draft exist" is no longer a
  // synchronous lookup. _runLegacyMigrationIfNeeded() must finish first
  // (its own await) — it can be the thing that actually creates the
  // draft resumeActiveDraft() then resolves.
  window.__draftsBootPromise = (async () => {
    await _runLegacyMigrationIfNeeded();
    await resumeActiveDraft();
  })();

  // Delegated on .workflow-area (so rows added later are covered without
  // rebinding), but Phase C put non-workflow UI inside that container
  // too — the Bids-list filter toolbar (2.4/2.5) and the bid/no-bid gate
  // (8.4). Their inputs are not bid form fields; letting their events
  // reach _handleFormChange() would spuriously re-autosave the active
  // draft (bumping lastModifiedAt, re-arming beforeunload) on every
  // filter keystroke or gate selection. Skip anything under a
  // [data-noautosave] subtree.
  const _workflowArea = document.querySelector('.workflow-area');
  if (_workflowArea) {
    const _onWorkflowChange = (e) => {
      if (e.target.closest && e.target.closest('[data-noautosave]')) return;
      _handleFormChange();
    };
    _workflowArea.addEventListener('input', _onWorkflowChange);
    _workflowArea.addEventListener('change', _onWorkflowChange);
  }
}

// Guarded — same reason as window.__getDraftsCacheSync above.
if (typeof window !== 'undefined') {
  window.addEventListener('dirigo:shell-ready', _initApp, { once: true });
}
