# Phase A — Step 0: Test Coverage Report

**For Eric.** This is the required first deliverable before any Phase A code lands (per `docs/phase-a-implementation-plan.md`). It answers one question: is the existing test suite trustworthy enough to prove the React migration changed nothing a user can observe?

## Summary

Short answer: **mostly yes, with three specific holes**, all three landing on code the migration directly rewrites. The suite is otherwise strong — 98 unit tests and 39 end-to-end tests (28 spec files), all currently green, covering export/import, the full draft lifecycle, the agent flow, bid submission (success and failure), history, and rate templates in real depth. A mutation test (see `docs/preflight-report.md`) confirmed this isn't just apparent strength — deliberately breaking `calculator.js` made 10 of the 39 tests fail, all in the calculation/output/finalize path specifically.

**Status: all three gaps are now closed.** Five new spec files (10 new tests) are written and passing — suite is now 33 spec files, 49 tests, still 98/98 Vitest, all green together. See "What was found while closing them" below for one real, previously-unknown bug that surfaced along the way — not a coverage gap, a live discovery that needs a decision.

## The three gaps — decided: close all three before A2

**1. Adding and deleting takeoff rows has no assertion coverage.**
No test ever calls `addAsm()`, `addWall()`, or `addCeil()` (the "+ Add row" buttons on Assemblies/Walls/Ceilings) and checks what happens. Row *editing* — changing a value in an existing row — is well covered. Row *deletion* is clicked in two tests, but only as setup to reach a specific fixture state (e.g., "zero out this row so I can test something else") — never as the behavior being verified. These three functions are rewritten into components in Step 3 of the migration. A regression in "click Add, a row appears with working inputs" or "click ×, the row and its cost disappear" could ship with every existing test still green.

**2. The autosave indicator's visual states are never checked.**
The debounce-and-persist mechanism underneath autosave is tested (data survives a reload). But nothing ever looks at the little "Saving…" / "Saved 2:14pm" / error text in the header and confirms it shows the right state at the right time. That indicator is explicitly one of the behaviors Phase A must preserve exactly.

**3. The finalize modal's "Custom override" option is untested.**
When submitting a bid, there's a "Custom override" choice that lets you type a different amount, and the Confirm button is supposed to stay disabled until that amount is valid. No test ever selects that option or types into that field — only the standard (agent-suggested) options are exercised.

## What was found while closing them — a real bug, not a gap

Writing the Gap 3 spec (finalize modal custom override) surfaced something the coverage gap itself didn't predict: **the finalize modal's selection has no effect on what actually gets saved.**

`_finalizeBid()` correctly reads whichever option the user picked — a standard agent option or a typed custom amount — and computes a label/amount from it. But that value is only ever used for the client-side success toast. It's never passed to `submitBid()`, which independently recomputes the bid price from the plain Cost Summary calculator, ignoring the modal entirely. Confirmed directly, twice: entering a custom override of $317,500 saved $142,775 (the calculator's own number); clicking the "Ambitious" option ($298,000 shown) saved the same $142,775. The modal visually promises "you're submitting at $X" and that promise isn't kept.

This isn't being fixed here — Phase A makes no business logic changes, and this predates the migration entirely. It's pinned down as an explicit, visible regression test (`tests/e2e/finalize-modal-selection-not-persisted.spec.js`, named `KNOWN BUG` in its test title) so it's tracked rather than silently reproduced by a future rewrite, and so it stops being a surprise the day someone does fix it — that's literally when this test starts failing, which is the intended signal to go delete it. Gap 3's actual spec (`finalize-custom-override.spec.js`) tests what's genuinely true today — the disabled/enabled logic works correctly — and deliberately does not assert a submitted dollar amount, since asserting the wrong number as "correct" would be worse than not testing it.

**Recommendation**: track this as a "Known follow-up" the same way the existing wrong-tab bug is tracked, and decide separately (outside Phase A) whether it's worth a dedicated fix.

## What's already solid

Export/import round-trip, the full draft lifecycle (create/open/duplicate/delete/switch), running the agent and rendering its result, bid submission on both the success and failure path, Bid History (render/update/delete), and rate templates are all covered by multiple tests each, including edge cases like double-submit guards and malformed imports. These flows carry real protection into the migration already.

## Coverage by flow

| Flow | Unit (Vitest) | E2E (Playwright) | Notes |
|---|---|---|---|
| Add / edit / delete takeoff rows | — | ✓ (`takeoff-row-add-delete.spec.js`, 4 tests) | **Gap 1 — closed** |
| Autosave indicator states | — | ✓ (`autosave-indicator-states.spec.js`, 2 tests) | **Gap 2 — closed** |
| Zero console/page errors across every page | — | ✓ (`no-console-errors-on-load.spec.js`) | New — see preflight-report.md |
| Export / import round-trip | — | ✓ (5 specs) | Solid |
| Draft create/open/duplicate/delete | ✓ (`drafts.test.js`) | ✓ (6 specs) | Solid |
| Agent run + render result | — | ✓ (4 specs) | Solid |
| Finalize modal — standard path | — | ✓ | Solid |
| Finalize modal — custom override | — | ✓ (`finalize-custom-override.spec.js`, 2 tests) | **Gap 3 — closed** |
| Finalize modal — selected amount actually persisted | — | ✓ passes today, **documenting a bug** (`finalize-modal-selection-not-persisted.spec.js`) — will start failing the day it's fixed, which is the point | **New bug found, see above** |
| Finalize — double-submit guard | — | ✓ | Solid |
| Bid submission success | — | ✓ | Solid |
| Bid submission failure (`_finalizeBid` catch) | — | ✓ | Solid |
| History render / update outcome / delete | — | ✓ (5 specs) | Solid |
| Rate templates | ✓ (`rate-templates-core.test.js`) | ✓ (2 specs) | Solid |
| `calculator.js` | ✓ — includes a byte-for-byte golden-bid regression against seed data | — | Thorough |
| `history-analytics.js` | ✓ — full coverage per exported function, including "not enough data" thresholds | — | Thorough |

**Files with no unit tests today**: `agent.js`, `forms.js`, `history.js`, `rate-templates.js`, `state.js`, `tabs.js`. None of these are pure-function modules the way `calculator.js`/`history-analytics.js` are, so this isn't unusual — but it means their correctness rests entirely on the Playwright suite.

## One correction to the brief

The brief refers to "nine pages." The app currently has **ten** page containers: the 8 numbered workflow tabs (Project, Conditions, Rates, Assemblies, Walls, Ceilings, Initial Bid, Agent Recommendation) plus Dashboard and Bid History, reached from a separate left-hand nav. The "nine" figure comes from a *future* Phase C page count (after some tabs are combined/renamed) — not a discrepancy, just worth using the right number (10) for Phase A's own accounting.

## Test inventory

<details>
<summary>10 Vitest unit spec files</summary>

| File | Covers |
|---|---|
| `autosave.test.js` | Debounce timing, export payload shape, import validation, schema migration |
| `bid-agent-handler.test.js` | Netlify function returns clean 503 without an API key, rejects non-POST |
| `bid-agent-request.test.js` | Anthropic request payload shape |
| `bid-agent-response.test.js` | Parsing/error-handling of the agent's JSON reply |
| `bids-core.test.js` | Bid record stamping/patching/removal immutability |
| `calculator.test.js` | Waste overrides, cost summary, rate escalation, golden-bid regression |
| `drafts.test.js` | Draft record building, legacy migration, duplication, active-draft cleanup |
| `history-analytics.test.js` | Margin/outcome curve, seasonality, competitor patterns, cost variance |
| `rate-templates-core.test.js` | Template stamping/removal immutability |
| `ui.test.js` | `escapeHtml()` only |

</details>

<details>
<summary>28 original + 5 new = 33 Playwright e2e spec files, 49 tests total (+ helpers.js)</summary>

Original 28: `agent-history-fallback`, `agent-receives-real-history`, `agent-response-escaping`, `assembly-waste-override`, `autosave-persistence`, `bid-agent-not-configured`, `bid-storage-error-handling`, `clear-seed-data-empties-history`, `competitor-patterns`, `delete-bid-persists`, `delete-draft`, `draft-switch-no-contamination`, `duplicate-draft`, `export-import`, `finalize-clears-draft`, `history-regression`, `html-escaping`, `intelligence-null-handling`, `legacy-migration`, `malformed-import`, `new-bid-creates-draft`, `pipeline-count-hint`, `rate-escalation`, `rate-templates`, `seed-bid-ids-preserved`, `seed-regression`, `submit-bid-persists`, `unsaved-changes-warning`, `update-bid-persists`

New 5: `takeoff-row-add-delete` (Gap 1, 4 tests), `autosave-indicator-states` (Gap 2, 2 tests), `finalize-custom-override` (Gap 3, 2 tests), `no-console-errors-on-load` (1 test), `finalize-modal-selection-not-persisted` (1 test, documents the new bug)

</details>

## Recommendation

All three gaps are closed, verified passing individually and as part of the full 33-spec/49-test suite together, alongside all 98 Vitest tests. **This suite — spec files, not test count, per the plan's stated gate unit — is the real parity contract for A2**: any of these 33 spec files needing modification during the migration is a signal that behavior changed, not the tests. The one exception by design is `finalize-modal-selection-not-persisted.spec.js`, which is expected to fail the day someone fixes the bug it documents — that's a deliberate, named exception, not a parity violation.
