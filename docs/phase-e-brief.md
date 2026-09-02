# Phase E Handover Brief — Agent

**Audience:** Claude Code
**Repo:** `edahms01/dd-bidding` · `main` — Phases A, A2.5, B, C, D all merged and live
**Read first:** `CLAUDE.md`, `docs/dirigo-ux-decisions.md` §5 (the approved decisions this phase implements), §4.3 (top cost drivers, bundled here), §9.9 (both known defects this phase resolves)

---

## 1. Context

Phase E is the agent experience — the product's differentiator — plus two defects that have been deliberately preserved, not fixed, since they were first found:

- **The wrong-tab finalize bug**, known since A2.5: the submitted/failure panel renders on the Cost Summary tab while finalize happens on Bid Strategy, so the durable confirmation is invisible.
- **Agent-option display staleness**, known since A2.5 and made actively visible (not just theoretical) by Phase B's reactive calculation: the agent's option amounts are a snapshot from whenever it last ran, and can silently disagree with the live numbers on screen by the time the user confirms. An interim one-line caveat has been shipping since Phase B specifically to hold this over until this phase.

Both were explicitly scheduled here — "same modal, same visit" — rather than fixed piecemeal earlier.

## 2. Scope

- **5.6** — Confirmation panel renders on the correct tab; add recommended-vs-chosen.
- **Agent-option staleness fix** (§9.9) — the design question ("re-validate at open, at confirm, or warn-and-offer-refresh") is this phase's to answer, not decided upstream. Remove the interim caveat once the real fix is verified — don't leave it stacked on top of the fix.
- **5.1** — Expected value column: `P(win) × margin$`. Must render as a range with a visible caveat, not a false-precision point value — `deriveWinLikelihood()` is a hand-tuned score, not calibrated probability. Confirm this still holds before building on it (see §3).
- **5.2** — Win-likelihood attribution: click the pill, see each of the four contributing signals and its direction.
- **5.3** — What-if price slider between the competitive and ambitious bounds, live-recomputing margin/likelihood/EV. **Must interpolate from the demo response's own fixed anchors, not recalculate independently** — otherwise the slider and the demo response visibly disagree at the endpoints.
- **5.5** — Override reason capture: reason chips (scope uncertainty / relationship play / need the work / competitor intel / gut) plus free text, stored on the bid record when the chosen option differs from the recommended one.
- **4.3** — Top cost drivers panel on Cost Summary: the five line items contributing the most dollars, plus labor as % of direct cost. Unrelated to the rest of this phase's agent work — genuinely standalone.

## 3. Confirm by direct investigation before proposing an implementation plan

Same discipline as every prior phase. Specific things to verify rather than assume, given how much has changed underneath these decisions since they were written:

- **Current exact shape of `AgentPage.jsx`, `FinalizeModal.jsx`, and `OutputPage.jsx`'s submitted-result panel**, post Phase D's mobile CSS work. This phase is the first to add new interactive UI *after* the mobile pass — new elements (EV figures, the slider, reason chips) must follow Phase D's established conventions (16px mobile inputs, 44px tap targets, grid-stacking patterns) rather than reintroduce desktop-only markup.
- **`deriveWinLikelihood()`'s current implementation** — confirm it's still a hand-tuned integer score, not calibrated probability, before building EV's honesty constraint on that premise.
- **What "recommended" data is actually available at confirm-time** to build 5.6's comparison and 5.5's reason capture — does `cachedResult.options` reliably survive to confirm-time, or does it need explicit snapshotting?
- **`DEMO_MODE`'s current behavior** — if the staleness fix's "refresh" action re-invokes the agent, confirm what that actually returns in demo mode before designing the interaction around it.
- **Every place the interim staleness caveat currently renders** — Phase D duplicated it onto `BidSummaryPage.jsx` in addition to `AgentPage.jsx`. Both need to come down together once the real fix lands, not just the original.
- **Whether golden-export is genuinely unaffected.** 5.5/5.6's new fields belong to the *bid record* (`buildBidRecord()`), not the exported draft — same as A2.5's `selected_option`/`custom_override_amount`, which didn't touch the fixture. Confirm this holds rather than assume it by analogy.

## 4. Non-goals

- **5.4 (actionable risk flags) and 5.7 (PDF proposal export) were explicitly rejected** during the original decision walkthrough. Don't let them creep back in under the banner of "while we're in here."
- No mobile-specific redesign — follow Phase D's existing patterns, don't reopen that work.
- No assembly extensibility, no light theme/print.
- Don't modify `calculator.js` / `history-analytics.js`. Reading from existing exports (e.g. `computeCostVariances`) is expected and fine — this restriction is about not touching the pure calculation logic itself.

## 5. Suggested build order

Six checkpoints given this is the most architecturally dense remaining phase — data correctness, two long-preserved defects, new interactive UI, and a bid-record schema addition. Each step is independently smaller and more verifiable than doing this as one pass.

1. **5.6 — wrong-tab fix, alone.** Move the confirmation panel to render where finalize actually happens. This is the oldest, best-understood defect in the project — tackle it first and in isolation before anything else builds on it. **Stop and report.**
2. **Staleness fix.** Now that the panel lives in the right place, layer in staleness detection and whatever resolution mechanism this step's investigation points to. Remove the interim caveat from both locations once verified. **Stop and report.**
3. **5.1 + 5.2 — EV and attribution.** Additive display work on the existing option cards, no new interaction paradigm. **Stop and report**, with explicit confirmation the EV honesty constraint (range, not point value; visible caveat) is met.
4. **5.3 — the slider.** Depends on fresh inputs (step 2) and EV math (step 3). The riskiest new-interaction piece — isolate it. **Stop and report**, with explicit verification that dragging to either endpoint matches the demo response's own anchor values exactly.
5. **5.5 — override reason capture.** Now that recommended-vs-chosen data (step 1) and fresh agent state (step 2) both exist cleanly, add the reason UI and persist it. This is a bid-record schema change — hand-verify a real captured record's new fields against expected values, the same way A2.5's `markup_pct` was hand-verified, not just spec-passed. **Stop and report.**
6. **4.3 — top cost drivers.** Standalone, Cost Summary only, no dependency on anything above. Report as part of phase close-out rather than its own checkpoint.

## 6. Things to verify, not assume

- Golden-export fixture — confirm unaffected per §3, don't skip the check because it seems obviously safe by analogy.
- Full Playwright suite green after each checkpoint.
- Vitest untouched.
- The interim caveat's regression spec (`agent-staleness-caveat.spec.js`) needs deliberate handling once the real fix lands — it currently asserts the caveat's *presence*; once removed, that assertion needs to flip or be replaced with a test of the actual fix, not just deleted silently.

## 7. Docs

Update `docs/dirigo-ux-decisions.md` §4.3/§5/§9.9 and §10's phase table, and `CLAUDE.md`, directly in the same commit as the code each describes. Apply the forward-pointer habit for anything a later step in this phase supersedes from an earlier step's docs.

## 8. Commit structure

Two commits per build-order step (production, then test-infra/docs), same convention as every prior phase.

## 9. Report format

Plain-language summary first, what was verified and how, before proceeding to commit. Stop and report at each checkpoint in §5. Merge only after the same deploy-preview and production-verification standard as every prior phase (real Netlify build, exact commit match on production metadata, non-destructive against the shared Blobs store).
