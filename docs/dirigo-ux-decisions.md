# Dirigo Drywall Bidding Platform — UX Decision Record

**Supersedes:** `dirigo-ux-analysis.md` (26 Aug 2026). That document was written against a project-knowledge snapshot that mixed pre-Phase-1 and current files; several findings were already resolved in shipped code. This version reflects verified current state plus every approve/reject decision from the walkthrough.

**Status:** all sections walked, all items decided. Technical infrastructure reviewed separately (§9) after the UX walkthrough — that review changed the shape of Phase A. Next deliverable is the Phase A handover brief.

---

## 1. Corrections to the original analysis

Findings that were **already built** and are removed from scope:

| Original finding | Actual state |
|---|---|
| §6.8 "Save draft doesn't save a draft" | Dead. Phase 1 shipped `exportBid()` / `handleImportFile()` plus a live `#autosave-indicator` with saving/saved/error states. The old JSON-download `saveDraft()` is gone. |
| §2.5 "No bids list" | Dashboard exists (Phase 2) with Open / Duplicate / Delete, sorted by last modified, backed by `dirigo_drafts`. Scope narrowed accordingly — see 2.5 below. |
| §5.6 "Ephemeral submission confirmation" | Half-built. A persistent submitted panel exists but renders into `#output-bid` (Tab 7) while finalize happens on Tab 8. Reframed rather than removed. |
| §8 win-rate-vs-margin curve, competitor intelligence | Already computed and unit-tested in `history-analytics.js` — `computeMarginOutcomeCurve()`, `computeCompetitorPatterns()`, `computeSeasonality()`, `computeCostVariances()`. Never surfaced in the UI. Reframed as a rendering task (8.1). |

Useful assets found that reduce downstream effort:

- `.tab.done` styling already exists in CSS — step completion (2.2) is partly a wiring job
- `.leftnav.collapsed` 48px icon-only mode already exists — usable as the mobile nav fallback
- Viewport meta tag is already correct
- History now captures `actual_labor_cost` and `actual_material_cost` separately with variance baselines — strengthens 8.2

New defect found during verification, not in the original report:

- `.shell{height:100vh}` combined with `html,body{overflow:hidden}` means the bottom of the app is cut off on mobile browsers with dynamic address bars, with no way to scroll to it. Needs `100dvh`. Folded into Phase D.

---

## 2. Decisions — Information architecture

**2.1 Step reorder + Conditions split — APPROVED (9 steps). Implemented (Phase C, Step 2, 2026-09-01).**
Rates currently precedes any quantities, so unit prices are entered with nothing to multiply against. Conditions currently mixes cost-driving site facts with price-driving market judgement, and asks the market questions before the estimator knows the job's size.

New sequence: Project → Site Conditions → Assemblies → Walls → Ceilings → Rates → Cost Summary → Market Read → Bid Strategy.

"Initial Bid" renames to Cost Summary (it is a cost sheet, not a bid). "Agent Recommendation" renames to Bid Strategy — name the outcome, not the vendor.

Implementation: only `label`s changed and one new key (`market`) was added — the internal tab keys `conditions`/`output`/`agent` stay (see the key-rename decision in `CLAUDE.md`), so the wrong-tab finalize bug (`#output-bid`, still on the `output` page) reproduces identically and the reorder itself leaves the golden-export fixture untouched (one unrelated field, `intelligence.openDraftCount`, changed later in Step 4's seed-loader fix — see 2.5). The Conditions split is UI/routing only: `confidence`/`notes` still live in the `bid.conditions` slice, `intelligence` still its own slice — `MarketReadPage.jsx` just renders them on a later step, and carries the two on-become-active effects (`registerConfidenceReader`, `_renderPipelineHint`) whose targets moved with it. Public route slugs are now `#/site-conditions`, `#/cost-summary`, `#/market-read`, `#/bid-strategy` (`src/state/router.js`).

**2.2 Step completion state + URL routing — APPROVED. Implemented (Phase C, Step 1, 2026-09-01).**
Empty / partial / complete indication per step, derived from whether required fields hold values. Deep-linkable steps (`#/walls`) so browser back works and a step can be bookmarked. Navigation stays unrestricted — show completion, don't gate. Block only final submit.

Built as a hash router with no new dependency (`src/state/router.js` — a slug↔state table plus `parseHash`/`routeToHash`/`canonicalHash`; two sync effects in `AppShell.jsx`). `replaceState` normalises an empty/garbage hash, `pushState` on every navigation, and a `hash !== desired` guard makes a Back/Forward-driven dispatch a no-op — that guard is what prevents the bounce-between-two-history-entries failure. Route slugs this step are the internal tab keys verbatim (`#/output`, `#/agent`, `#/conditions`); Step 2's reorder swaps in the public slugs named above (`#/site-conditions`, `#/cost-summary`, `#/market-read`, `#/bid-strategy`) and adds the `market` step, Steps 4–5 add `#/bids` / `#/bids/<id>` / `#/bid-decision` — all a single-table edit.

Completion (`src/state/stepStatus.js`, pure `stepStatus(bid, ui)`) is built only on signals that already existed — no new "is this step done" validation. Rates reuses the L/M/X class-sum the Rates totals bar already shows (RatesPage now publishes it into `ui.rateTotals`); Walls/Ceilings require `isOrphanTypeId()` to be clean, so a table with an orphaned reference never shows a green check — and **Cost Summary and Bid Strategy inherit the same rule** (`complete` also needs `hasUnresolvedReferences()` false), so a total or recommendation built on an unresolved reference reads amber alongside the Walls step feeding it, never green. Project/Site Conditions key on field presence. **Assemblies uses a self-contained "has the estimator engaged with the table" signal** — a second row, or any field moved off its `blankAssemblyRow()` default, or a note/waste override; a single untouched default row stays neutral. (An earlier version keyed Assemblies off whether a Walls/Ceilings row referenced it, which answered "has a later step caught up" rather than "is this step done" — changed at Eric's review.)

**2.3 Remove numbered step references from copy — APPROVED. Implemented (Phase C, Step 2, 2026-09-01).**
`agent.js` still directs users to a setup panel on "Tab 9"; the agent is Tab 8. Reference steps by name, ideally as a button that navigates there. No numbers in prose — they break silently on every reorder, and we are about to reorder.

Implementation: the live numbered strings were `AgentPage.jsx`'s empty state ("…on Tab 6…" → "Fill in your bid through the Cost Summary step" + a nav button) and the Bid History empty state ("…in Tab 7." → "…finalize a bid from the Bid Strategy step…"). The dead `js/ui.js` twins (`renderHistory`/`renderAgentTab` empty branches, unreachable since A2) were updated to match rather than left showing stale numbers. `js/agent.js` itself has carried no "Tab N" string since the Track A rework — the §2.3 text above predates that. (Step 4 later deleted `HistoryPage.jsx` when Bid History merged into the unified Bids list; `BidsPage.jsx` carries its own number-free empty-state copy.)

**2.4 Stable shell on History — APPROVED. Implemented (Phase C, Step 3, 2026-09-01).**
Selecting Bid History currently hides the step bar entirely, so the app reads as a different application. Keep the frame; replace the step bar with a History toolbar (filter by GC, outcome, date range).

Implementation (as it shipped in Step 3): a toolbar renders in the `#app-tabs` slot while off the workflow — GC substring, an outcome/status select, and a date range, plus a Clear button that only appears while a filter is active. Filter state lives in the reducer (not persisted); the list page applies it to both the table and the totals bar (so a GC/status filter doubles as a scoped win-rate read), with a "Showing N of M" line and a distinct "No bids match the current filter." message.

**Step 4 renamed the specifics here** when Dashboard + History merged into one Bids list (2.5): `HistoryToolbar.jsx` → `BidsToolbar.jsx`, `activeSection === 'history'` → `'bids'`, `state.ui.historyFilters` → `bidsFilters`, the outcome filter became a Draft/Submitted/Won/Lost **status** filter, and `HistoryPage.jsx` was replaced by `BidsPage.jsx`. The `.bids-toolbar` CSS and `#hf-gc` / `#hf-status` / `#hf-from` / `#hf-to` / `#hf-clear` control ids are the current surface.

**2.5 Navigation model — APPROVED (both parts). Implemented (Phase C, Step 4, 2026-09-01).**
- *"New Bid" behaves like a button, not a destination.* It sits among nav destinations but calls `createDraft()`, so the obvious route back to work-in-progress instead spawns a blank bid. Move "+ New Bid" to a header button; the nav item becomes the current bid.
- *Unify Dashboard and Bid History into one Bids list* with a status column (Draft / Submitted / Won / Lost). One bid, one home, filtered views rather than separate screens.

Implementation: `+ New Bid` is a header action (`#new-bid-btn`) now; the left-nav workflow item is "Current bid", labelled with the active draft's project name, and returns you to whatever step you left off (`GOTO_SECTION 'workflow'` keeps `activeTab`). `activeSection` collapsed from `'workflow' | 'history' | 'dashboard'` to `'workflow' | 'bids'` — no aliases, ~19 specs updated to the new selectors directly. `BidsPage.jsx` merges the two sources in a view layer only (no storage migration — the §9.7 assumption confirmed): drafts from `getAllDrafts()` (sync, paint immediately), submitted bids from `getAllBids()` (async, with a scoped error note if it fails while drafts still render), each normalised to one row shape (`draftRow`/`bidRow` collapsing nested `project.*` vs flat `project_name`/`gc`/`building_type`), merge-sorted by date. Status is derived (Draft = in `dirigo_drafts`; Submitted = a bid record with `outcome` pending; Won/Lost = outcome); the active draft is marked "current". Amount shows `final_bid` for submitted rows, "—" for drafts (no calculator run outside the workflow). Row actions reuse `switchToDraft` / `duplicateDraft` / `deleteDraft` / `deleteBid` / `updateBid` (via the extracted `BidUpdateRow.jsx`) verbatim, `confirm()` strings included. `HistoryToolbar` → `BidsToolbar` with a Draft/Submitted/Won/Lost status filter; `#/history` + `#/dashboard` routes → one `#/bids` (`#/bids/<draftId>` opens that draft, same as the row's Open button).

**Deviation from house style, recorded deliberately:** `DashboardPage.jsx` and `HistoryPage.jsx` were *deleted*, not left in the tree as dead code. Every prior phase (notably the A2 migration) kept superseded code in place — but that was to have a reference to diff behaviour against during a parity-sensitive port. These two pages are a straight 1:1 replacement by `BidsPage.jsx` with no parity question; leaving ~370 lines of unrendered React that still referenced a since-renamed reducer field (`historyFilters`) would be a maintenance hazard, not a safety net. `js/ui.js`'s classic-script `renderHistory()`/`renderDashboard()`/`deleteBidRecord()` were left alone (genuinely out of scope; one is still test-referenced).

**UX regression this phase caused and fixed in the same step:** before the unification, `loadSeedData()` appending its draft to the map (rather than replacing it) was invisible — Dashboard and Bid History never showed the full draft list beside the bids. The unified list surfaced the orphaned blank "Untitled bid" draft on every seed load. Fixed in `data/seed.js`: Load Seed now replaces the drafts map (it already replaces bid history wholesale; `clearSeedData()` clears drafts wholesale — a demo reset, not an append). Not deferred to §9.9 because it was cheap, self-contained, and demo-facing rather than a latent data-integrity gap. One export-payload consequence, hand-diffed and recaptured: `intelligence.openDraftCount` after a clean seed load is now `0` (no *other* open drafts), not `1` — the `1` counted the phantom. `tests/fixtures/golden-export.json` updated accordingly; it's the only intentional golden change in Phase C.

---

## 3. Decisions — Takeoff tables

**3.1 Type ID becomes a dropdown bound to Assemblies — APPROVED. Highest severity item in the report. Implemented (Phase B, Step 3, 2026-08-28).**
Wall and ceiling rows take Type ID as free text. `collectFormData()` trims whitespace, so that failure mode is covered, but case mismatch, typos, and deleting an assembly still referenced by takeoff rows all produce a wrong total with no warning. The new per-assembly Waste % override adds more data riding on that reference.

Spec: select populated live from Assemblies, option label `W1 — 3-5/8" / Type-X / L4`; inline warning when a reference goes orphaned; block submit while unresolved references exist.

New `src/components/TypeIdSelect.jsx` replaces the free-text `<input>` — case mismatch and typos are now structurally impossible, since a value can only come from a real assembly id or the field's own blank default. The one deliberately controlled field in an otherwise fully uncontrolled row (`SET_ROW_FIELD`, `src/state/store.jsx`), since orphan detection needs to react across pages. `src/state/validation.js`'s `hasUnresolvedReferences()`/`isOrphanTypeId()` is the shared rule behind the inline warning, the "Finalize bid →" button, and the finalize modal's Confirm button — **deliberately narrower than `calculator.js`'s own per-row `error` flag**, which also fires for a genuinely blank typeId (every fresh draft's default starter row). Found by direct investigation before shipping: reusing that flag as originally planned would have blocked Finalize on every brand-new, untouched draft. "A reference goes orphaned" means a row that HAD a real reference now invalid (an assembly deleted, or a stale imported/legacy value) — not a row nobody has filled in yet.

`js/state.js`'s `collectFormData()` rewritten from positional NodeList indexing to class-based `querySelector` lookups for Walls/Ceilings rows — required because Type ID converting from `<input>` to `<select>` would otherwise have silently shifted every field after it out of the old `inp[n]` index math (a `<select>` isn't an `<input>`). Verified with a real before/after export-payload diff (not just a passing spec, per Eric's explicit standard): captured the exported seed-data payload against the pre-rewrite code (git stash to the prior commit, same running dev server) and against the post-rewrite code, byte-for-byte identical.

**3.2 Remove hard-coded pixel widths — APPROVED, but ABSORBED by the React migration (§9).**
Generated cells carry `style="width:52px"` and similar. Cramped on desktop, truncates at browser zoom, and physically overrides any responsive breakpoint. No longer a separate task: the row generators in `forms.js` become components during the Phase A migration, and the inline widths do not survive that transition. Retained here as an acceptance criterion, not a work item — no pixel widths in generated markup after Phase A.

**3.3 Explicit dimensions/area mode toggle — APPROVED (revised from auto-derivation). Implemented (Phase B, Step 5, 2026-08-28).**
Rationale from the walkthrough: estimators frequently arrive with SF already totalled from a takeoff tool, so forcing granular dimension entry is wrong. Rejected automatic bidirectional derivation in favour of an explicit toggle.

Spec: page-level toggle on Walls and Ceilings — "Enter by dimensions" / "Enter by area". Persists per draft. Switching hides columns without discarding entered values. LF framing stays visible and required in **both** modes, since framing is priced per LF and cannot be recovered from SF alone.

Height is the only column that toggles — confirmed by reading `calculator.js` before building this, not assumed: it's never read by `calcWall()`/`calcCeil()`'s cost math, so hiding it changes nothing about pricing. `wallsMode`/`ceilingsMode` are plain `state.bid` scalars (`initialState.bid`, `src/state/store.jsx`), so they flow through `collectFormData()`/export/drafts the same way every other bid field already does — no separate persistence path, and `RESET_BID` resets them for free via its existing wholesale deep-clone. Column hiding is CSS (`display:none`/`visibility:collapse`), never conditional unmount — an unmounted uncontrolled input would have discarded whatever the user typed the moment the mode switched, silently violating "hides columns without discarding values."

**Real bug found and fixed via the actual reload-persistence check, not assumed safe from the reducer logic being correct on paper:** the toggle is a plain button dispatch, not a native DOM `input`/`change` event, so `js/forms.js`'s autosave listener never saw it — a mode switch with no other edit afterward silently reverted to "dimensions" on reload. Fixed with the same `needsImmediateSave` shape `RatesPage.jsx`'s template-load handler already established for this exact class of hazard (a reducer dispatch with no native DOM event to trigger autosave).

A pre-3.3 draft/import with no saved mode defaults to `'dimensions'` (the schema default) on load — deliberately *not* falling back to whatever mode happens to be active in the current browser session, which would leak one draft's mode into an unrelated one.

**3.4 Validation guardrails — APPROVED. All four implemented (Phase B, Steps 4–5, 2026-08-28).** The LF-empty-in-area-mode warning (Walls only — `calculateCeilingCosts()` uses SF-based framing, no LF concept for ceilings at all) landed alongside 3.3 as planned.
`calcWall()` clamps net SF at zero, so openings exceeding gross SF display a plausible number and hide the mistake. Add soft warnings for: openings > gross, zero-height rows, blank rows (dimmed and excluded from totals), and — tied to 3.3 — LF empty in area mode, which silently drops framing cost.

One page-level derived pass in `WallsPage.jsx`/`CeilingsPage.jsx` (mirroring `RatesPage.jsx`'s existing `recomputeTotals()`/root-`onInput` pattern, not a new mechanism) computes all three read-only, from the same class-named fields 3.1's `collectFormData()` rewrite introduced — the same pass will feed 3.5's column totals later rather than a second, competing read of the same rows. `--status-warn` styling, deliberately distinct from 3.1's `--danger` orphan warning (soft vs. blocking severity, per `css/tokens.css`'s own documented split). Zero-height only flags a row that otherwise has real data — a fully blank row gets its own (dimmed) treatment instead, not a redundant second badge. **Explicit constraint honored, not touched:** `calcWall()`/`calcCeil()`'s clamp-at-zero math, and every existing calculation, is unmodified — these are display-only warnings over already-computed values.

**3.5 Table affordances — APPROVED: column totals, duplicate row, undo on delete. Paste-from-spreadsheet REJECTED. Implemented (Phase B, Step 6, 2026-08-28).**
- *Column totals* (LF, gross SF, net SF): estimators cross-check against the drawing set. Without it they export to Excel, defeating the product.
- *Duplicate row*: takeoffs are repetitive — adjacent zones differ by one number.
- *Undo on delete*: deleting a bid *record* asks for confirmation; deleting a takeoff row after 40 minutes of entry does not. Inverted risk. Undo toast, not a confirm dialog — confirms on repetitive actions get click-throughed within a day.

Column totals: a `<tfoot>` row in each of Walls/Ceilings, summing the same page-level `computeDerived()` pass 3.4 already runs, over non-blank rows only. Not added to Assemblies (no quantity fields there to total).

Duplicate row: new `DUPLICATE_ROW` reducer case. Assemblies mint a fresh Type ID (`W{n}`/`C{n}`, next `asmCounter`) rather than copying the source verbatim — copying `id` would collide in `calculator.js`'s `asmMap` (`Object.fromEntries` keeps only the last of any duplicate key, silently shadowing the original). Walls/Ceilings duplicates copy `typeId` as-is — sharing a reference across rows is normal, no rename needed. **Real design flaw caught before shipping, not assumed safe:** the initial design read the source row from `state.bid[section][index]` directly, but every row field except Type ID is deliberately uncontrolled (no per-keystroke dispatch) — the reducer's own copy can be stale relative to whatever's actually typed in the DOM. Fixed by live-capturing via `window.collectFormData()` at the moment Duplicate (or Delete) is clicked, not trusting the reducer's snapshot.

Undo on delete: `DELETE_ROW` stashes the removed row (same live-capture fix as Duplicate) into `state.ui.rowUndo`; a new `UNDO_DELETE_ROW` re-inserts it at the same index with a fresh `_key`. New `RowUndoToast.jsx` (shell-owned, always mounted, ~6s auto-dismiss) — a new component rather than extending the existing generic toasts (`_showFormToast`/`_showBidToast`), which have several unrelated callers an action button would risk regressing. A pending undo is explicitly cleared on every draft switch/reset (`RESET_BID`, and `js/ui.js`'s `_resetAgentCache()` — the same choke point both real draft-switch call sites already use) — unlike the deliberately-preserved `submitResult` wrong-tab quirk, a stale undo surviving a switch is actively data-corrupting, not cosmetic.

**Both of Eric's required empirical checks passed as real Playwright assertions** (`tests/e2e/row-undo-restores-position-and-values.spec.js`): delete → undo restores the exact row count, position, and values; duplicate → delete the original → undo correctly restores the original at its original index while the duplicate (shifted by the delete) survives completely untouched — the one piece of this phase with genuinely non-obvious state interaction, given the same scrutiny the row-key bug and the cache-fallthrough bug got during A2.

**A real, substantial bug found and fixed via that same empirical standard, not assumed safe on paper — worth recording at length since it very nearly shipped:** the first implementation drove autosave for row add/delete/duplicate/undo with a single blanket `useEffect` in `AppShell.jsx` watching `state.bid` (mirroring 4.2's reactive-calc watcher) and calling `window._handleFormChange()` on every change. This looked reasonable and initially seemed to fix the target bug (a deleted row silently reappearing after a draft switch, since row mutations are plain reducer dispatches with no native DOM event for the existing autosave listener to see). Running the *full* suite against it broke **11 unrelated specs** — the watcher fires on hydration too (draft switch/import/reset/boot-resume), not just genuine user edits, and every one of those flows already has its own deliberate `hasUnsavedChanges`/save handling. Most visibly: marking `hasUnsavedChanges` true right after any hydration made `handleImportFile()`'s own "overwrite unsaved changes?" `confirm()` guard fire on the *next* import, auto-dismissed by Playwright's default dialog handling, silently aborting it with the field left blank. A first attempted fix (skip only the component's true first render) did not resolve it — boot-time auto-resume hydration is a *second* wave of `state.bid` changes shortly after mount, past that guard. **Correct fix: abandoned the blanket watcher entirely.** `window._handleFormChange()` is now called directly at each specific row add/delete/duplicate/undo action (`AssembliesPage.jsx`/`WallsPage.jsx`/`CeilingsPage.jsx`/`RowUndoToast.jsx`), the same per-action shape 3.3's mode toggle already used (`RatesPage.jsx`'s `needsImmediateSave` precedent) — reactive recalculation is safe to run unconditionally on any `state.bid` change (recomputing numbers from freshly-loaded data is always correct), but autosave is not, since it's a write that can clobber a hydration flow's own bookkeeping if fired outside that flow's control.

---

## 4. Decisions — Calculation feedback

**4.1 Persistent bid-total rail — APPROVED. Implemented (Phase B, Step 2, 2026-08-28).**
Totals currently exist only on Rates and Cost Summary. The entire takeoff — where most time is spent — shows no number. Thin persistent rail (direct cost / markup / bid price) from Assemblies onward, with a subtle flash on change. Most demo-friendly change in the report.

New `src/components/BidTotalRail.jsx` — first file in a new `src/components/` directory, shell-owned and always mounted (same pattern as `FinalizeModal.jsx`). Reads `state.ui.output` directly, kept live by 4.2's reactive calculation — no separate calculation path. Mounted from `src/AppShell.jsx`, scoped to `assemblies`/`walls`/`ceilings`/`output`/`agent` (not project/conditions/rates, which either precede any takeoff data or already have their own totals tile — Rates' own crude tile). Reuses `.total-item`/`.total-val`/`.total-div`/`.total-lbl` (`css/components.css`) — same visual language as the existing Rates/Output totals bars. Flash-on-change is pure React state (a `useRef`/`useState` pair diffing `finalBidPrice` between renders), no DOM-read conflict since `state.ui.output` is already React-owned.

**4.2 Reactive calculation, Recalculate button removed — APPROVED. Implemented (Phase B, Step 1, 2026-08-28).**
The manual `↻ Recalculate` implies the number can go stale but nothing indicates when, which undercuts trust in every figure on screen. Make calculation reactive and delete the button.

`js/ui.js`'s `runCalculation()` split into `calculateOnly()` (numbers only — everything through `renderOutput()`) and `runCalculation()` (`calculateOnly()` plus the bid-agent launch, unchanged externally). A new debounced trigger, `window.scheduleRecalc` (500ms), calls `calculateOnly()` only — wired from `js/forms.js`'s existing autosave-change handler (uncontrolled-input keystrokes) and `src/AppShell.jsx`'s `state.bid` watcher (React-dispatched row add/delete/hydration/controlled fields). **Decided explicitly, not assumed:** the bid agent must not relaunch on every reactive tick — "numbers update live" doesn't imply "relaunch an AI call on every keystroke." Agent-launch frequency is unchanged from before this phase: it still only fires from `window.goto('output')` and the post-finalize "Back to output" button, both of which still call the full `runCalculation()`.

**4.3 Top cost drivers panel — APPROVED.**
The existing breakdown reports what the number is, not where it's movable. Add the five rows contributing the most dollars, plus labor as a % of direct cost.

---

## 5. Decisions — Agent

**5.1 Expected value column — APPROVED.**
Cards show amount, margin %, and a qualitative pill. The real question is which option earns most on average: `P(win) × margin$`. $271k at High versus $298k at Low–Medium is not comparable by eye. Moves the tool from "AI suggests a price" to "the system does math you can't do in your head."

Honesty constraint: `deriveWinLikelihood()` is a hand-tuned integer score, not calibrated probability. EV must render as a range with a visible caveat until real bid volume exists. Do not show a false-precision point value.

**5.3 What-if price slider — APPROVED.**
Slider between the competitive and ambitious bounds recomputing margin, likelihood and EV live, with the three agent options marked as anchors.

*Constraint arising from the demo-mode decision (§9):* the demo response is hard-coded, so the slider must interpolate from that response's own anchors rather than recalculating independently — otherwise the two visibly disagree the moment anyone moves it during a pitch.

**5.2 Win-likelihood attribution — APPROVED.**
The pill is a black box built from four inputs (GC relationship, price sensitivity, competition, Dirigo's edge). Click to expand each contributor and its direction.

**5.5 Override reason capture — APPROVED.**
The finalize modal takes a custom amount with no rationale. The gap between what the agent said, what was bid, why, and how it turned out is the highest-value dataset this product could own. Reason chips (scope uncertainty / relationship play / need the work / competitor intel / gut) plus free text, stored on the bid record.

**5.6 Confirmation panel on the correct tab — APPROVED.**
Render the submitted panel on Tab 8 where finalize happens, and add what it currently lacks: recommended versus chosen.

**REJECTED — 5.4 actionable risk flags.** Flags stay read-only.
**REJECTED — 5.7 PDF proposal export.** Consistent with 5.4, since the exclusions action existed largely to feed the proposal document.

---

## 6. Decisions — Visual system

All approved.

**6.1 Type scale floor.** Current dominant sizes are 10–13px with 10px uppercase low-contrast labels. New floor: body 14, table cells 13, hints 12, labels 11. Nothing at 10px.

**6.2 Colour split — blue as action, orange as status.** `--accent` currently signals primary action, warning severity, medium confidence, the Ambitious option, and active nav. Blue becomes the brand/action colour (closer to Dirigo's actual identity — blue sign with orange underline); orange moves to a status ramp that never appears on interactive elements.

**6.3 Tabular figures.** Replace Courier New with `font-variant-numeric: tabular-nums` on the system stack; a modern mono for hero figures only.

**6.4 Extract inline styles from `ui.js` — ABSORBED by the React migration (§9).** Agent option cards alone are ~15 lines of inline `style` each. No longer a separate task — `ui.js`'s render functions are replaced by components in Phase A rather than cleaned up. Retained as an acceptance criterion: no inline `style` attributes in component output after Phase A, except where a value is genuinely computed at runtime.

**6.5 Accessibility.** Current state fails a basic audit: `<div onclick>` for tabs, pills, nav items and option cards; `<span class="lbl">` instead of `<label for>`; focus states change border colour only, no ring; finalize modal has Escape but no `role="dialog"`, focus trap, or focus restore; delete buttons are a bare `×` with no accessible name. **Applied as a standard from Phase A onward, plus a closing audit in Phase G.**

**6.6 Light theme and print stylesheet.** Both approved. Print is ~40 lines and estimators print cost sheets; the app currently prints black pages.

**6.7 Dev toolbar → Demo controls.** Restyle as a deliberate affordance rather than hiding it. Hidden below 768px.

---

## 7. Decisions — Mobile

Framing: read-mostly. Practicality over sophistication. No separate codebase, no framework, one stylesheet, two breakpoints (768 / 480).

**Tier 1 — don't break — APPROVED.**
Left nav collapses; step bar becomes horizontally scrollable chips; multi-column grids stack; totals bar wraps 2×2; inputs go to 16px on mobile to stop iOS auto-zoom on focus; tap targets to 44px (the `×` delete is far below); demo controls hidden; `100vh` → `100dvh`.

_Phase D Step 1 (2026-09-02) — the structural half shipped:_ `100vh` → `100dvh` (`.shell`), left nav → **off-canvas drawer** below 768px (not a 48px rail — a `position:fixed` slide-in with a 72%-black backdrop, closed by backdrop tap or nav-item selection; new ephemeral `state.ui.navDrawerOpen`), step bar horizontally scrollable, all inputs 16px, demo controls hidden, tap targets ≥44px. Also trimmed the header on mobile (project badge / autosave indicator / Export / Import dropped — the row overflowed ~390px and pushed "+ New Bid" off-screen), an addition beyond the list under the "don't break" banner. All in `css/responsive.css` except the `.shell` line; desktop untouched.

_Phase D Step 2 (2026-09-02) — layout stacking + sticky columns:_ multi-column grids (`.grid.g2–g6`, `.rgrid`, `.adder-row`, `.flag-grid`) collapse to one column below 768px; `.conf-row` wraps; `.page` padding 28/32 → 16 and `.page-hdr` stacks; totals bars (`.totals-bar`) wrap **2×2** with dividers hidden at ≤480px. **Sticky first column** on Assemblies / Walls / Ceilings / Bids list / Cost Summary breakdown (opt-in `sticky-col` class on the `.tbl-wrap`; the 3-col Bid Strategy signal table is excluded — it fits a phone). The scroll-shadow is a pseudo-element `linear-gradient`, not `box-shadow` — `box-shadow` on a table cell under `border-collapse:collapse` is clipped by the adjacent cells and never renders. `RowUndoToast` becomes a full-width bottom strip on mobile; `BidTotalRail` gets tighter padding (stays 3-across). Both steps pinned by `tests/e2e/mobile-layout.spec.js` (390×844 + 768×1024 + a 430px totals check: no horizontal body scroll on every page, drawer open/close incl. a tap-through-blocked check, step bar scrolls, grids single-column, sticky cell holds position under scroll, totals bar 2×2, demo hidden, ≥44px targets, zero console errors on a narrow-viewport sweep).

**Tables — sticky first column everywhere — APPROVED.**
All tables keep table shape with horizontal scroll and a pinned first column, so the row identity (Level/Zone, project name) stays visible while scrolling sideways. Applies to editable takeoff tables and read-only tables alike — one pattern, not two. Add a scroll-shadow affordance.

**Tier 2 — mobile Bid Summary + Log outcome — APPROVED.**
Single scrolling read-only column: project / GC / due date, final bid large, direct cost and margin, the three agent options stacked, risk flags, quantity totals. Plus one write action — Log outcome (won/lost, winning bid, competitor). That write is genuinely better on a phone than at a desk, and it feeds the entire history and calibration loop.

**Reached in-app only — DECIDED.** No share links. A shareable summary URL would return bid pricing to anyone holding it, and the Netlify Functions endpoints have no access control. Keeping the view behind the existing app keeps auth deferred. If share links are ever wanted, auth stops being deferrable and Phase D grows accordingly.

**REJECTED — Tier 3 field capture.** Also out of scope: full takeoff entry on mobile, offline mode, PWA install, gestures.

---

## 8. Decisions — Estimating intelligence

**8.1 Surface the analytics that already exist — APPROVED. Cheapest high-value item in the report.**
`history-analytics.js` already computes and tests the margin-outcome curve, competitor patterns, seasonality and cost variances. The History page shows four numbers. Build an Insights view rendering them, honouring the existing "not enough data" states (`MIN_BIDS_FOR_MARGIN_CURVE = 15` decided bids; `MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE = 2`). The hard part is done and tested; only the UI is missing.

**8.2 Contingency from measured cost variance — APPROVED.**
Contingency currently comes from a confidence button (4 / 8 / 15%). With labor and material variance captured per bid, propose a number from measured bias instead of gut. Must degrade honestly on thin data, same pattern as 8.1.

**8.3 GC scorecard — APPROVED.**
Win rate, average margin, and cost variance by GC.

**8.4 Bid/no-bid gate — APPROVED as a standalone screen, not a workflow step. Implemented (Phase C, Step 5, 2026-09-01).**
A short scoring screen — fit, GC history, competition, crew capacity, schedule risk — recommending whether to bid at all. Deliberately outside the 9-step flow so it doesn't lengthen it further. Reached from the Bids list.

Implementation: `BidDecisionPage.jsx`, a new `activeSection` value `'biddecision'` and route `#/bid-decision`, reached only from a "Bid / no-bid gate" button on the Bids list (no left-nav item of its own — the "Bids" item stays active while it's open). Five factor selects, each good/ok/bad = +2/0/−2; total ≥ +4 → **Bid**, ≤ −4 → **Pass**, else → **Proceed with caution**. **Ephemeral** (Q3): factor answers are local component state reset to neutral on every visit, the recommendation is derived fresh each render, nothing is persisted and no bid record is touched. Tying decisions to actual outcomes is a recorded Phase F candidate (§9.9-adjacent note below), not built here.

Along the way this closed a latent Phase C wart: the `.workflow-area` delegated autosave listener (`js/forms.js`) fired for *any* input inside that container, and Phase C had put non-workflow UI there (the Bids filter toolbar in 2.4/2.5, now the gate) — so filtering the Bids list or answering a gate question spuriously re-autosaved the active draft. Fixed with a `[data-noautosave]` subtree guard on `#bids-toolbar` / `#page-bids` / `#page-biddecision`.

**REJECTED — 8.5 productivity mode.**
Rationale from the walkthrough: crew-hour productivity is too granular for how the company actually estimates. Broader signal to carry into all future work — **the estimating model is assembly-and-area based, not crew-hours based.** Don't propose features that assume hourly productivity tracking.

---

## 9. Technical infrastructure

Reviewed after the UX walkthrough, at Eric's prompting. The original report did not cover this and should have.

### 9.1 What holds up

Vanilla HTML/CSS/JS is a defensible choice at this size — nine forms, one user, small data. No build step means trivial deployment and no dependency rot. Netlify Functions plus Blobs is right-sized for the storage layer. Playwright for behaviour and Vitest for pure functions is the correct split.

### 9.2 What does not hold up under the approved scope

Every page renders by assigning a template string to `innerHTML`. Fine when a page renders once on navigation, which is how the app works today. Four approved items break that assumption — the persistent totals rail (4.1), reactive calculation (4.2), the what-if slider (5.3), and live step completion (2.2) all update *while the user is typing*. Replacing a page's HTML on every keystroke destroys and recreates the focused input, losing focus and cursor position mid-number. Visible bug, not theoretical.

The deeper form of the same problem: state currently lives in the DOM, read back by element ID. That works with one reader. The approved scope adds several readers of the same numbers — a column-hiding mode toggle (3.3), derived values, and a total that must be correct on every screen. Multiple readers of DOM-resident state is where inconsistency bugs originate.

### 9.3 Decision — React migration, all at once, Phase A

Three options were weighed: leave the structure alone and impose a targeted-update discipline by hand; build a hand-rolled state object; or migrate to React. The hand-rolled option amounts to building a smaller, undocumented version of React, so it was set aside once the constraint below was lifted.

The original argument against React was sequencing risk — a framework migration produces a stretch with no demoable build. Eric removed that constraint: **there is no requirement for a fully demoable product at the end of every phase.** With that gone, the case against was weak.

**Migrating all at once rather than page by page**, because the approved features are cross-cutting. The totals rail appears on every step; step completion reflects every step's data; reactive calculation spans the workflow. An incremental migration would require a synchronisation bridge between React and non-React pages — throwaway work, and the most likely home for subtle cross-step bugs. It would also tax every remaining brief with "which pages are converted?"

### 9.4 Migration boundary

React takes over **rendering only**. These stay as plain modules, untouched:

- `calculator.js`, `history-analytics.js` — pure, already unit-tested
- `drafts.js`, `history.js` — storage and network
- `agent.js` — agent invocation
- Netlify Functions

Keeping this boundary means the Vitest suite is entirely unaffected by the migration and the best-tested code in the project is never at risk.

**State handling stays boring:** one bid object held at app level, passed down. No Redux, no state library. The app has one document open at a time.

### 9.5 Verification

The Playwright suite is behavioural — it drives the UI and asserts on outcomes. It becomes the parity harness: **the existing tests must pass against the React build without being rewritten.** Any test that requires modification is a signal that behaviour changed, which Phase A is not permitted to do.

### 9.6 Consequences and carried notes

- **3.2 and 6.4 are absorbed** — the pixel-width and inline-style cleanups happen by deletion, not by refactor. Both are retained as Phase A acceptance criteria.
- **URL routing (2.2) arrives nearly free.** `index.html`'s nine hardcoded page divs become routes. Routing is still deliberately *excluded* from Phase A to preserve strict behaviour parity, but the page structure should be built so Phase C is a small addition rather than a restructure.
- **CSS layering** (tokens / base / components / pages / responsive / print) lands in Phase A before component work, so components are built against final tokens rather than restyled twice.
- **`escapeHtml()` becomes largely unnecessary.** React escapes interpolated values by default, which removes the manual XSS discipline currently required wherever project and GC names flow into generated markup. Keep the function for any remaining non-React string paths.
- **Event delegation and real buttons** come naturally out of the component conversion, which is most of what 6.5's `<div onclick>` problem required.
- **The no-build-step advantage is genuinely lost.** Vite plus `node_modules` enters the project. Netlify handles this without a deployment change, but it is a real trade being made knowingly.

### 9.7 Standing decisions and assumptions

**Demo response stays hard-coded** to the Harborview seed. Safer for a controlled pitch. Consequence documented in 5.3.

**Accessibility is a standard, not a phase.** Applied from Phase A; audited in Phase G.

**Mobile Bid Summary is in-app only.** No share links; auth stays deferred (§7).

**Estimating model is assembly-and-area based, not crew-hours based.** Do not propose features assuming hourly productivity tracking (§8.5).

**Assumptions requiring Code to confirm** (not verified by search):
- That `.tab.done` styling is currently unwired rather than wired to something else
- ~~That no consumer depends on the `↻ Recalculate` button's manual trigger before 4.2 removes it~~ — confirmed by direct read (its only call site, `OutputPage.jsx`, was `window.runCalculation?.()`, an on-click convenience with no other consumer) and by the full, unmodified Playwright suite passing after removal (Phase B, Step 1).
- That `dirigo_drafts` and the Netlify-backed bid store can be unified behind one list view (2.5) without a storage migration

---

### 9.8 Phase A preflight outcome

Phase A was split into two PRs during plan review, and a blocking preflight was run before either began. Findings, all verified empirically:

- **Converting the six modules to native `export` syntax in A1 is not viable.** Converting `calculator.js` alone, with classic `<script>` tags still in place, throws `Unexpected token 'export'` in the browser and breaks the cost pipeline — while Vitest stays green throughout, because Vitest exercises the module path and the browser exercises the script-tag path. The conversion moves to A2, where the files become real component imports. Switching the tags to `type="module"` was rejected structurally: inline `onclick` handlers resolve against `window`, and the functions they call live in five files outside the conversion list.
- **The failure is quiet, not loud.** The page still loads and unrelated scripts still run; damage only surfaces on the Output tab. A `no-console-errors-on-load` spec now covers this, listening for **both** `pageerror` and `console.error` — the actual failure fired as `pageerror`, so a console-only listener would have missed it. This becomes a global fixture in A2, where every page conversion can reintroduce it.
- **Two Vite/Netlify config defects were found and fixed.** `vite build` reports success while silently omitting classic-script files from `dist/`, which would have deployed a site 404-ing every `js/*.js` file; and Netlify's dev-command detection misread `package.json`. Both fixed additively, with a build-time assertion that fails if expected files are missing from `dist/`. **Correction, resolved at A2 close-out:** the plan assumed this plugin would become removable once `js/*.js` converted to real bundled ES module imports. That conversion never happened — see below — so the plugin remains permanently necessary, not a temporary scaffold. Verified empirically before removal was attempted: disabling it and rebuilding silently drops `dist/js/` entirely.
- **The parity harness was mutation-tested.** Reapplying the broken export and running the full suite produced 10 on-target failures across the calculation, output and finalize paths — the harness demonstrably catches this class of break rather than being assumed to.
- **Suite baseline: 33 spec files / 49 Playwright tests, 98 Vitest tests.** This expanded suite, including the three gap-closing specs plus the console-error and inverted regression specs, is the parity contract for A2. (Final count at A2 close: 34 files / 51 tests — see below.)

**A2 outcome — the ESM conversion never happened, by design decision made mid-migration, not by omission.** The `window.*` global-bridge pattern (established for `window.goto` during navigation ownership, generalized for `_lastAgentResult` and others as each page converted) proved sufficient for the entire migration. `js/*.js` remain classic `<script>` tags today. This is a real, deliberate divergence from the original plan's assumption that pages would eventually import these as real ES modules — recorded here rather than left as a silent gap between plan and outcome. Consequence: the dist-copy plugin is permanent, not removable scaffolding.

**A2 is complete.** Every page in the app is React. Final gate: 51/51 Playwright unmodified, 98/98 Vitest, clean build, golden-export replay byte-identical. Two deliberately-unfixed defects remain exactly where documented in §9.9. Coverage added beyond the required parity gap list during the migration (modal Escape/click-outside/reopen behavior, agent-history-fallback, draft-switch-no-contamination) — genuine net gain, not just parity maintained.

**Next step:** A1 implementation.

**Phase A internal sequence:**

1. **Tooling and tokens** — Vite, CSS layering, blue/orange split (6.2), type scale (6.1), tabular figures (6.3), demo controls (6.7). Framework-independent; lands first so components are built against final tokens.
2. **Spike** — shell plus one representative page (Rates, which already has a totals bar) to validate component and state patterns before committing to the rest.
3. **Full migration** — remaining pages. Behaviour-preserving.
4. **Parity verification** — full Playwright suite green, unmodified.

Note: the earlier "independently shippable and demoable at every point" principle no longer applies — Eric removed that constraint to permit the migration. Phases remain independently *reviewable*, and Phase A remains independently verifiable via the parity harness.

**Next step:** Phase A handover brief.

---

### 9.9 Known defects

Found during Phase A preflight and coverage work. Both are pinned by regression specs; neither is fixed in Phase A, which is behaviour-preserving by definition.

**Finalize selection is not persisted — resolved in A2.5 (2026-08-27).**
`submitBid()` independently recomputed the bid price from the plain calculator, discarding whichever option or custom override the user selected in the finalize modal. Verified against both a standard option and a custom override — the same incorrect amount was saved in each case.

Severity was higher than it first appeared, because it wrote wrong data rather than merely displaying it:

- Stored bid amounts feed `computeMarginOutcomeCurve()` and the margin-band win rates. Every historical margin figure was therefore computed against a price that was never submitted. Phase F's Insights view would have rendered a well-tested chart built on numbers that did not happen — worse than having no chart.
- It blocked the *value* of Phase E, not just its features. Override reason capture (5.5) records why someone deviated from a recommendation that would otherwise be discarded. Recommended-versus-chosen (5.6) had nothing to compare. Expected value (5.1) is decision support for a choice that evaporated on submit.

**Fix:** `FinalizeModal.jsx`'s `handleConfirm()` now passes `{ amount, selectedOption }` through `submitBid()` (js/ui.js) into `buildBidRecord()` (js/state.js), which derives both `final_bid` and `markup_pct` from that chosen amount instead of the plain calculator's independent `markupResult`. Two new record fields, `selected_option` (the reducer's own option vocabulary — competitive/recommended/ambitious/override) and `custom_override_amount`, give Phase E the traceability it needs without a second migration of stored data. `_finalizeBid()` (js/ui.js), the old classic-script Tab-8 handler this bug was originally found in, is confirmed dead code — superseded by `FinalizeModal.jsx` — and was deliberately left untouched.

Formerly pinned by `finalize-modal-selection-not-persisted.spec.js` as an *inverted* spec (passed because the code was broken, expected to fail once fixed). Now de-inverted into a normal positive regression test asserting the fix directly; `finalize-custom-override.spec.js` was also strengthened to assert the override path, previously left unasserted on purpose while the bug was open. Full suite verified green after the fix: 51/51 Playwright, 98/98 Vitest. Golden-export fixture confirmed unaffected — that flow (`clearAll()` → `loadSeed()` → Export) never calls `submitBid()`.

**Scope note from the A2.5 fix (closed out, kept as history):** `buildBidRecord()`'s `markup_pct` shared the same wrong basis as `final_bid` — `markupResult.totalMarkup`, the plain calculator's result, not whatever the user selected. The risk flagged here — that wiring `final_bid` to the modal's selection without also recomputing `markup_pct` from that same amount would trade one bug for a subtler one (a bid record where the displayed markup % no longer matches the price it's the markup on) — is exactly what the fix above avoided: both fields are now recomputed together, from the same chosen amount, in the same place.

**Agent-option display can go stale before the user confirms — scheduled for Phase E, alongside 5.5/5.6.**
The agent's competitive/recommended/ambitious `bidAmount`s (what the finalize modal displays and what the user picks from) come from `_lastCalcSum`/`_lastCalcMarkup` — module-level snapshots set whenever the agent last ran (`js/ui.js`, `_launchBidAgent()`/`runAgentIfNeeded()`). If the user edits Rates, Assemblies, Walls, Ceilings, or Markup inputs *after* the agent last ran but *before* opening the modal and clicking Confirm, the modal displays option amounts computed against stale inputs — a number the user never actually re-derived. The A2.5 fix makes this slightly more concrete than before: it now persists the *displayed* amount verbatim at confirm-time, so a stale display is faithfully saved as `final_bid`, rather than being silently overwritten by a fresh (also-wrong-for-different-reasons) recompute the way the pre-fix code accidentally was. Concrete failure scenario: open Tab 8 (agent runs, options computed from current inputs), go back and change a wall quantity or a markup %, return to Tab 8 without re-running the agent, click Ambitious, confirm — the saved bid reflects the *old* inputs, not the ones now on the form.

This is the same general shape of bug this migration has repeatedly found: a value computed once, cached, then trusted after the state that produced it changed underneath it. Precedented as accepted, known behavior for *display* (CLAUDE.md's note that Tab 8 "even shows a stale cached result over a fresh recalculation in flight") — but nothing currently guards against that staleness leaking into what gets *persisted*, which is a new-ish consequence now that persistence is faithful to the display. **Not fixed in A2.5** — out of scope for that fix, whose job was "persist what the user saw and clicked," not "guarantee what they saw was fresh."

**Decision (2026-08-27): joins Phase E's scope, not a standalone phase or an indefinite wildcard.** Phase E already opens this exact modal for override-reason capture (5.5) and the recommended-vs-chosen comparison (5.6) — same code, same visit, no reason to defer touching it a third time later. Whether the actual fix is re-validating/re-running the agent against fresh inputs at modal-open time, at confirm-time, or simply warning the user if inputs changed since the agent last ran is Phase E's design question to answer, not decided here.

**Visibility update (2026-08-28, Phase B Step 1/2 checkpoint) — this got more visible, not just theoretically present, and it's a real problem, not a cosmetic one.** Before Phase B, everything on Tab 7/8 was static until a manual Recalculate — a stale agent number and a stale Output total drifted together, with nothing on screen to expose the gap between them. Reactive calculation (4.2) plus the persistent bid-total rail (4.1) break that symmetry: the rail now updates live, right next to the Agent tab's still-frozen cards. Verified directly, not assumed: cached an agent result (Competitive $271,000 / Recommended $284,500 / Ambitious $298,000), then edited a rate on a different tab — the rail's bid price jumped from $142,775 to $351,685 while sitting on Tab 8, but all three agent cards stayed exactly as they were. The result is a user looking at three "recommendation" prices that are now all *lower* than the rail's own bid-price figure sitting directly above them — an obviously-wrong-looking inconsistency, not a subtle one, and now visible within a single session without ever leaving the tab. **Still not fixed here — Phase E owns the actual fix, per the decision above — but this is a passive note, not a shrug: worth a one-line "recommendations may be based on an earlier version of your inputs" caveat near the cards before Phase B ships, cheap enough to add without touching Phase E's actual design question, since Phase E follows this phase directly rather than sitting a long way off.**

**Interim caveat shipped (2026-08-28, Phase B, standalone commit).** Eric's call, made directly rather than left to Phase E: "These options may reflect an earlier version of your inputs." now renders above the Bid options cards (`AgentPage.jsx`). Reasoning recorded here so it isn't mistaken for scope creep later — this wasn't Phase B stumbling onto an old bug and being asked to leave it alone; Phase B's own reactive-calc change (4.2) is what turned a dormant inconsistency into an actively misleading one within a single session (see the checkpoint verification above: a $53k–80k gap between the rail and the frozen cards). Phase B made it worse, so Phase B shipping a cheap mitigation is fair scope, even though the real fix (re-validate/relaunch the agent against fresh inputs) stays Phase E's job exactly as decided. Scope deliberately minimal — one line, no visual redesign, no gap quantification, no interaction — pinned by `tests/e2e/agent-staleness-caveat.spec.js`. **Phase E: a passive mitigation already exists when you arrive to build the real fix — the caveat can be removed once the underlying staleness is actually resolved, not left stacked on top of it.**

**Plaster and exterior-wall rates are not costed — scheduled for post-Phase-G, as a template case.**
Found during the A2 spike, on the Rates page. Two rate fields (Plastering, External wall) and one Conditions flag (`exteriorExposure`) are captured and persisted by `collectFormData()`/`populateForm()` but never read by `calculator.js`. Verified as a genuine gap, not a wiring bug: there is currently no assembly `category` or `boardType` value that represents plaster or exterior-wall scope, and no takeoff quantity field either rate could multiply against. The Harborview seed data doesn't populate these rate keys either — the company's own reference bid doesn't treat them as costed scope. This is unbuilt capability, not a regression.

**Checked and cleared: no live risk.** No jobs have been bid through the tool yet, so no historical bid was underpriced by this gap. No urgency, no stopgap needed.

**Decision: deferred until after Phase G**, and deliberately used as the first real test case for adding a new assembly type to the platform. Plastering and exterior wall become the concrete example for documenting — as a skill, playbook, or dedicated MD file — the repeatable process for extending the assembly model (new category, new takeoff fields, calculator wiring, seed data, tests). Plaster and exterior wall are the first two instances of a problem that will recur every time Dirigo adds a service line; solving it once as a documented process is worth more than a one-off fix to these two fields.

Pinned by `tests/e2e/rates-plaster-extwall-not-costed.spec.js`, which is an *inverted* spec — passes today documenting the gap, fails once assembly types are extended to cover it.

**Finalize failure panel renders to the wrong tab — scheduled for Phase E (5.6).**
The submitted and failure panels render into `#output-bid` on Tab 7 while finalize happens on Tab 8, so the durable confirmation is invisible and only the toast is seen. Preserved as-is through Phase A.

**No unified overlay z-index scheme — surfaced during Phase D, not scheduled.** One defect, two symptoms, one eventual fix (a real z-index scale across toasts / modal / drawer / backdrop):

1. `RowUndoToast` (`css/components.css`, `position:fixed;bottom:24px;right:24px`) and the two inline-`cssText` toasts (`js/forms.js` `_showFormToast`, `js/ui.js` `_showBidToast`) share that exact anchor with no stacking offset — two firing at once render on top of each other.
2. Toast `z-index:1100` sits above the finalize modal's `z-index:1000`, so a toast can paint over an open `FinalizeModal`.

Both real, currently harmless because the toasts are transient and rarely coincide — same "named in the permanent record, not just a code comment" category as the plaster/exterior-wall gap. Phase D Step 2 repositions `RowUndoToast` to a full-width bottom strip on mobile (`css/responsive.css`) and adds the nav drawer + backdrop *above* both (`z-index:1290`/`1300`), but deliberately does **not** introduce the unified scale — that's a small standalone cleanup for whichever later phase touches the toast layer.

**Phase D — deferred candidate (not a defect).** A per-submitted-bid mobile Bid Summary. Phase D's Tier 2 summary is the **current active bid** only, because `buildBidRecord()` (`js/state.js`) doesn't persist the agent options, risk flags, or quantity totals §7 lists — those live only in `state.ui` for the bid being worked on. If Phase E starts persisting point-in-time agent-option / risk-flag snapshots for its recommended-vs-chosen comparison (5.6), a per-submitted-bid summary reachable from a Bids-list row becomes almost free to add on top of that. Not now — recorded so the connection isn't lost.

**Phase C — deferred candidates (not defects, ideas parked rather than dropped).**
- *Persist bid/no-bid gate decisions and tie them to actual outcomes.* 8.4's gate is ephemeral by decision (Q3). Recording each decision (with the job it was for and, later, whether the bid won/lost) would make it a calibration signal alongside Phase F's other analytics — a natural Phase F extension, not scoped now.
- *Add `source_draft_id` to the bid record.* The unified Bids list (2.5) can't currently trace a submitted bid back to the draft it came from (`clearFinalizedDraft()` deletes the draft with no link kept). Additive, no migration — worth doing in whichever phase first needs draft→outcome continuity (likely alongside the item above).

---

## 10. Phase plan

| Phase | Contents | Notes |
|---|---|---|
| **A1 — Tooling & design system** ✅ | Vite, CSS layering, 6.1, 6.2, 6.3, 6.7, docs, `CLAUDE.md`, gap-closing specs | Complete, merged, verified live in production. |
| **A2 — React migration** ✅ | Spike (Rates + History) → full migration (all pages) → parity gate. Absorbs 3.2, 6.4. | **Complete.** Every page is React. No ESM conversion — `window.*` bridges proved sufficient (§9.8). Final: 51/51 Playwright unmodified, 98/98 Vitest, golden-export byte-identical. |
| **A2.5 — Finalize persistence fix** ✅ | Single defect from §9.9 | **Complete (2026-08-27).** Standalone, before B. Surfaced a new lead (agent-option display staleness, §9.9) — assigned to Phase E, not a blocker for B. |
| **B — Takeoff integrity** ✅ | 3.1, 3.3, 3.4, 3.5, 4.1, 4.2 | **Complete (2026-08-28).** First feature phase on the new foundation. Also shipped an interim staleness caveat near the Agent tab's cards (§9.9) — Eric's call, since 4.2 is what made that pre-existing defect actively misleading, not just theoretically present. |
| **C — Navigation** ✅ | 2.1, 2.2, 2.3, 2.4, 2.5, 8.4 | **Complete 2026-09-01.** 2.2 hash routing + step indicators; 2.1 9-step reorder + Conditions→Site Conditions/Market Read split + renames; 2.3 numbered-copy removal; 2.4 stable shell + filter toolbar; 2.5 New Bid header button + unified Bids list (`activeSection` → `workflow`/`bids`); 8.4 ephemeral bid/no-bid gate. Internal tab keys unchanged (only labels); golden-export one-field recapture (`openDraftCount`, from the seed-loader fix). Deferred candidates noted in §9.9. |
| **D — Mobile** 🔨 | Tier 1, sticky columns, `100dvh`, Tier 2 | **In progress.** Build order: (1) structural must-fixes → (2) layout stacking / totals wrap / sticky columns → (3) Tier 2 summary + log outcome. Steps 1 + 2 done 2026-09-02 (drawer nav, scrollable step bar, 16px inputs, demo hidden, 44px targets, `100dvh`, mobile header trim; grid stacking, `.page` padding, totals 2×2, sticky first column on the takeoff/Bids/Cost-Summary tables); pinned by `mobile-layout.spec.js`. Q2 decided: the Tier 2 summary is the **current active bid** (a per-submitted-bid summary needs `buildBidRecord()` snapshots — deferred, see §9.9). |
| **E — Agent** | 5.1, 5.3, 5.2, 5.5, 5.6, 4.3, agent-option display-staleness fix (§9.9) | 5.1 blocks 5.3; depends on A2.5 (complete). Staleness fix rides along with 5.5/5.6 — same modal, same visit. |
| **F — Intelligence** | 8.1, 8.2, 8.3 | Computation layer already exists and is tested |
| **G — Polish** | 6.5 audit, 6.6 light theme + print | — |
| **Post-G — Assembly extensibility** | Add plaster and exterior-wall as real assembly types (category, takeoff fields, calculator wiring, seed data); write the general process up as a skill/playbook/MD so future service-line additions don't require rediscovering it | No live risk — no jobs run through the tool yet (§9.9). Deliberately deferred to use as the template case. |

**Phase A internal sequence (A2):**

1. **Spike** — shell plus Rates (targeted-write pattern, exercises the totals-bar derived-value path) and History (`innerHTML`-replace pattern, data flows through untouched modules). Both rendering patterns proven before build-out.
2. **Full migration** — Project, Conditions → Assemblies, Walls, Ceilings → Output → Agent → finalize modal → Dashboard. Behaviour-preserving.
3. **Parity verification** — full suite green and unmodified, golden-export byte-identical after normalisation, dist-copy plugin removed, legacy `window` bridge dropped.

Note: the earlier "independently shippable and demoable at every point" principle no longer applies — it was removed to permit the migration. Phases remain independently *reviewable*, and A2 remains independently verifiable via the parity harness.

**Next step:** A1 implementation.
