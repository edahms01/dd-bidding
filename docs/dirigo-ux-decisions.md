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

**2.1 Step reorder + Conditions split — APPROVED (9 steps).**
Rates currently precedes any quantities, so unit prices are entered with nothing to multiply against. Conditions currently mixes cost-driving site facts with price-driving market judgement, and asks the market questions before the estimator knows the job's size.

New sequence: Project → Site Conditions → Assemblies → Walls → Ceilings → Rates → Cost Summary → Market Read → Bid Strategy.

"Initial Bid" renames to Cost Summary (it is a cost sheet, not a bid). "Agent Recommendation" renames to Bid Strategy — name the outcome, not the vendor.

**2.2 Step completion state + URL routing — APPROVED.**
Empty / partial / complete indication per step, derived from whether required fields hold values. Deep-linkable steps (`#/walls`) so browser back works and a step can be bookmarked. Navigation stays unrestricted — show completion, don't gate. Block only final submit.

**2.3 Remove numbered step references from copy — APPROVED.**
`agent.js` still directs users to a setup panel on "Tab 9"; the agent is Tab 8. Reference steps by name, ideally as a button that navigates there. No numbers in prose — they break silently on every reorder, and we are about to reorder.

**2.4 Stable shell on History — APPROVED.**
Selecting Bid History currently hides the step bar entirely, so the app reads as a different application. Keep the frame; replace the step bar with a History toolbar (filter by GC, outcome, date range).

**2.5 Navigation model — APPROVED (both parts).**
- *"New Bid" behaves like a button, not a destination.* It sits among nav destinations but calls `createDraft()`, so the obvious route back to work-in-progress instead spawns a blank bid. Move "+ New Bid" to a header button; the nav item becomes the current bid.
- *Unify Dashboard and Bid History into one Bids list* with a status column (Draft / Submitted / Won / Lost). One bid, one home, filtered views rather than separate screens.

---

## 3. Decisions — Takeoff tables

**3.1 Type ID becomes a dropdown bound to Assemblies — APPROVED. Highest severity item in the report.**
Wall and ceiling rows take Type ID as free text. `collectFormData()` trims whitespace, so that failure mode is covered, but case mismatch, typos, and deleting an assembly still referenced by takeoff rows all produce a wrong total with no warning. The new per-assembly Waste % override adds more data riding on that reference.

Spec: select populated live from Assemblies, option label `W1 — 3-5/8" / Type-X / L4`; inline warning when a reference goes orphaned; block submit while unresolved references exist.

**3.2 Remove hard-coded pixel widths — APPROVED, but ABSORBED by the React migration (§9).**
Generated cells carry `style="width:52px"` and similar. Cramped on desktop, truncates at browser zoom, and physically overrides any responsive breakpoint. No longer a separate task: the row generators in `forms.js` become components during the Phase A migration, and the inline widths do not survive that transition. Retained here as an acceptance criterion, not a work item — no pixel widths in generated markup after Phase A.

**3.3 Explicit dimensions/area mode toggle — APPROVED (revised from auto-derivation).**
Rationale from the walkthrough: estimators frequently arrive with SF already totalled from a takeoff tool, so forcing granular dimension entry is wrong. Rejected automatic bidirectional derivation in favour of an explicit toggle.

Spec: page-level toggle on Walls and Ceilings — "Enter by dimensions" / "Enter by area". Persists per draft. Switching hides columns without discarding entered values. LF framing stays visible and required in **both** modes, since framing is priced per LF and cannot be recovered from SF alone.

**3.4 Validation guardrails — APPROVED.**
`calcWall()` clamps net SF at zero, so openings exceeding gross SF display a plausible number and hide the mistake. Add soft warnings for: openings > gross, zero-height rows, blank rows (dimmed and excluded from totals), and — tied to 3.3 — LF empty in area mode, which silently drops framing cost.

**3.5 Table affordances — APPROVED: column totals, duplicate row, undo on delete. Paste-from-spreadsheet REJECTED.**
- *Column totals* (LF, gross SF, net SF): estimators cross-check against the drawing set. Without it they export to Excel, defeating the product.
- *Duplicate row*: takeoffs are repetitive — adjacent zones differ by one number.
- *Undo on delete*: deleting a bid *record* asks for confirmation; deleting a takeoff row after 40 minutes of entry does not. Inverted risk. Undo toast, not a confirm dialog — confirms on repetitive actions get click-throughed within a day.

---

## 4. Decisions — Calculation feedback

**4.1 Persistent bid-total rail — APPROVED.**
Totals currently exist only on Rates and Cost Summary. The entire takeoff — where most time is spent — shows no number. Thin persistent rail (direct cost / markup / bid price) from Assemblies onward, with a subtle flash on change. Most demo-friendly change in the report.

**4.2 Reactive calculation, Recalculate button removed — APPROVED.**
The manual `↻ Recalculate` implies the number can go stale but nothing indicates when, which undercuts trust in every figure on screen. Make calculation reactive and delete the button.

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

**8.4 Bid/no-bid gate — APPROVED as a standalone screen, not a workflow step.**
A short scoring screen — fit, GC history, competition, crew capacity, schedule risk — recommending whether to bid at all. Deliberately outside the 9-step flow so it doesn't lengthen it further. Reached from the Bids list.

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
- That no consumer depends on the `↻ Recalculate` button's manual trigger before 4.2 removes it
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

**New, related lead surfaced during the A2.5 investigation — agent-option display can go stale before the user confirms; not yet scheduled.**
The agent's competitive/recommended/ambitious `bidAmount`s (what the finalize modal displays and what the user picks from) come from `_lastCalcSum`/`_lastCalcMarkup` — module-level snapshots set whenever the agent last ran (`js/ui.js`, `_launchBidAgent()`/`runAgentIfNeeded()`). If the user edits Rates, Assemblies, Walls, Ceilings, or Markup inputs *after* the agent last ran but *before* opening the modal and clicking Confirm, the modal displays option amounts computed against stale inputs — a number the user never actually re-derived. The A2.5 fix makes this slightly more concrete than before: it now persists the *displayed* amount verbatim at confirm-time, so a stale display is faithfully saved as `final_bid`, rather than being silently overwritten by a fresh (also-wrong-for-different-reasons) recompute the way the pre-fix code accidentally was. Concrete failure scenario: open Tab 8 (agent runs, options computed from current inputs), go back and change a wall quantity or a markup %, return to Tab 8 without re-running the agent, click Ambitious, confirm — the saved bid reflects the *old* inputs, not the ones now on the form.

This is the same general shape of bug this migration has repeatedly found: a value computed once, cached, then trusted after the state that produced it changed underneath it. Precedented as accepted, known behavior for *display* (CLAUDE.md's note that Tab 8 "even shows a stale cached result over a fresh recalculation in flight") — but nothing currently guards against that staleness leaking into what gets *persisted*, which is a new-ish consequence now that persistence is faithful to the display. **Not fixed here** — out of scope for A2.5, whose job was "persist what the user saw and clicked," not "guarantee what they saw was fresh." No target phase assigned yet. Worth a decision on whether the modal should re-validate/re-run the agent against fresh inputs at open-time (or confirm-time) before this is scheduled.

**Plaster and exterior-wall rates are not costed — scheduled for post-Phase-G, as a template case.**
Found during the A2 spike, on the Rates page. Two rate fields (Plastering, External wall) and one Conditions flag (`exteriorExposure`) are captured and persisted by `collectFormData()`/`populateForm()` but never read by `calculator.js`. Verified as a genuine gap, not a wiring bug: there is currently no assembly `category` or `boardType` value that represents plaster or exterior-wall scope, and no takeoff quantity field either rate could multiply against. The Harborview seed data doesn't populate these rate keys either — the company's own reference bid doesn't treat them as costed scope. This is unbuilt capability, not a regression.

**Checked and cleared: no live risk.** No jobs have been bid through the tool yet, so no historical bid was underpriced by this gap. No urgency, no stopgap needed.

**Decision: deferred until after Phase G**, and deliberately used as the first real test case for adding a new assembly type to the platform. Plastering and exterior wall become the concrete example for documenting — as a skill, playbook, or dedicated MD file — the repeatable process for extending the assembly model (new category, new takeoff fields, calculator wiring, seed data, tests). Plaster and exterior wall are the first two instances of a problem that will recur every time Dirigo adds a service line; solving it once as a documented process is worth more than a one-off fix to these two fields.

Pinned by `tests/e2e/rates-plaster-extwall-not-costed.spec.js`, which is an *inverted* spec — passes today documenting the gap, fails once assembly types are extended to cover it.

**Finalize failure panel renders to the wrong tab — scheduled for Phase E (5.6).**
The submitted and failure panels render into `#output-bid` on Tab 7 while finalize happens on Tab 8, so the durable confirmation is invisible and only the toast is seen. Preserved as-is through Phase A.

---

## 10. Phase plan

| Phase | Contents | Notes |
|---|---|---|
| **A1 — Tooling & design system** ✅ | Vite, CSS layering, 6.1, 6.2, 6.3, 6.7, docs, `CLAUDE.md`, gap-closing specs | Complete, merged, verified live in production. |
| **A2 — React migration** ✅ | Spike (Rates + History) → full migration (all pages) → parity gate. Absorbs 3.2, 6.4. | **Complete.** Every page is React. No ESM conversion — `window.*` bridges proved sufficient (§9.8). Final: 51/51 Playwright unmodified, 98/98 Vitest, golden-export byte-identical. |
| **A2.5 — Finalize persistence fix** ✅ | Single defect from §9.9 | **Complete (2026-08-27).** Standalone, before B. Surfaced a new, unscheduled lead (agent-option display staleness, §9.9) — not a blocker for B. |
| **B — Takeoff integrity** | 3.1, 3.3, 3.4, 3.5, 4.1, 4.2 | First feature phase on the new foundation |
| **C — Navigation** | 2.1, 2.2, 2.3, 2.4, 2.5, 8.4 | 8.4 included as a new nav destination; 2.2 routing partly prepared in A2 |
| **D — Mobile** | Tier 1, sticky columns, `100dvh`, Tier 2 | Blocked by A and B |
| **E — Agent** | 5.1, 5.3, 5.2, 5.5, 5.6, 4.3 | 5.1 blocks 5.3; depends on A2.5 |
| **F — Intelligence** | 8.1, 8.2, 8.3 | Computation layer already exists and is tested |
| **G — Polish** | 6.5 audit, 6.6 light theme + print | — |
| **Post-G — Assembly extensibility** | Add plaster and exterior-wall as real assembly types (category, takeoff fields, calculator wiring, seed data); write the general process up as a skill/playbook/MD so future service-line additions don't require rediscovering it | No live risk — no jobs run through the tool yet (§9.9). Deliberately deferred to use as the template case. |

**Phase A internal sequence (A2):**

1. **Spike** — shell plus Rates (targeted-write pattern, exercises the totals-bar derived-value path) and History (`innerHTML`-replace pattern, data flows through untouched modules). Both rendering patterns proven before build-out.
2. **Full migration** — Project, Conditions → Assemblies, Walls, Ceilings → Output → Agent → finalize modal → Dashboard. Behaviour-preserving.
3. **Parity verification** — full suite green and unmodified, golden-export byte-identical after normalisation, dist-copy plugin removed, legacy `window` bridge dropped.

Note: the earlier "independently shippable and demoable at every point" principle no longer applies — it was removed to permit the migration. Phases remain independently *reviewable*, and A2 remains independently verifiable via the parity harness.

**Next step:** A1 implementation.
