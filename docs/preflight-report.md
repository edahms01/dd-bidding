# Phase A — Preflight Report: ESM/Classic-Script Boot Compatibility

**For Eric.** The other required deliverable before A1 starts, alongside `docs/step-0-coverage-report.md`. This answers the blocking question from plan review: can `calculator.js` and its five siblings convert to native `export` syntax in A1, while `index.html` still loads everything via classic (non-`type="module"`) `<script src="...">` tags?

## Recommendation: Option 1 — defer the export conversion to A2

Confirmed empirically, not just reasoned about. **A1 should not touch the six files' export syntax at all.** That work moves into A2, where the files become real component imports and the change has a purpose. A1 stays pure CSS/tokens/type-scale/numerics/demo-controls/docs/tests — which also makes the A1 gate stronger, since a spec failure there can no longer be even theoretically blamed on a half-finished module conversion.

## What I tested

**Step 1 — stand up Vite against the untouched vanilla app.**

Installed Vite, added `vite.config.mjs`, ran a real production build (`vite build`) and served it. Two real problems surfaced, both fixed with small, additive config (no changes to `index.html` or any directory layout):

1. `vite build` refuses to bundle classic `<script src>` tags — expected — but it also silently **does not copy the files they reference into the build output**. The build reports success, but the deployed app would 404 on every `js/*.js` file. Fixed with a small plugin that copies `js/` and `data/` into `dist/` after build.
2. Netlify's local dev server misdetected the project's dev command as `npm run test` (reading `package.json`'s scripts) instead of starting Vite. Fixed with an explicit `[dev]` block in `netlify.toml`.

With both fixes in place, I ran the **entire existing suite** against this setup: **98/98 Vitest tests and 39/39 Playwright specs pass, unmodified.** Vite can stand up cleanly under this app exactly as it is today.

**Step 2 — convert one file and check a real browser, not just Vitest.**

Converted `calculator.js` alone to native `export function` syntax (nothing else changed) and loaded the app in an actual headless Chromium browser via a throwaway script.

Result: **`Unexpected token 'export'`** — a hard JavaScript syntax error, thrown the moment the browser tries to parse `calculator.js` as a classic script. The page still loads (other, unrelated scripts still run), which makes this a *quiet* failure rather than an obvious blank-page crash — worth flagging on its own, since it's the kind of break that's easy to miss in a quick manual check. Navigating to the Output tab (which calls calculator functions) throws `applyRateEscalation is not defined` — the entire cost-calculation pipeline is broken.

This confirms the concern from plan review exactly: **Vitest exercises the module-import path and stayed green throughout**; only checking a real browser against the classic-script-tag path caught the break. If I'd trusted Vitest alone here, this would have shipped.

## Mutation test: does the existing Playwright suite actually catch this?

One correction first: the broken `calculator.js` state was never actually committed — it was applied, tested, and reverted live in the working tree (not via `git checkout`), so there's no "Step 2 commit" in branch history to check out. Redid the same one-line mutation directly and ran the **entire** existing 39-test suite against it (not just a throwaway check), to answer the real question:

**Result: 10 of 39 tests failed.** Specific, on-target failures — `rate-escalation.spec.js` failed with the exact `applyRateEscalation is not defined` error; `seed-regression.spec.js`, `submit-bid-persists.spec.js`, `finalize-clears-draft.spec.js`, and six others failed on timeouts or assertion mismatches that all trace back to the broken calculation pipeline. Every failure is in the calculation/output/finalize path — nothing outside it failed, which is exactly the expected shape.

This is real, direct evidence: **the existing parity harness genuinely covers the calculation path.** A2's gate — the existing specs must pass unmodified against the React build — is meaningfully strong for this specific risk, not just strong on paper. This also means a new `no-console-errors-on-load.spec.js` (added below) is a second, faster line of defense on top of an already-real one, not a patch over a blind spot.

## New spec: assert zero console/page errors on every page

Added `tests/e2e/no-console-errors-on-load.spec.js` — loads the app, visits all 8 workflow tabs plus Dashboard and History, and asserts zero console errors **and** zero uncaught page errors throughout. One nuance worth being precise about: the actual Preflight failure (`Unexpected token 'export'`) surfaced as a `pageerror` event (an uncaught exception), not a `console.error` call — a console-errors-only check would not have caught it. The spec listens for both. Verified it independently catches the same `calculator.js` mutation on its own, standalone, on page load alone — no need to even reach the Output tab.

This is scoped as one dedicated spec, not a global fixture auto-applied to all 33 spec files — extending it that way is a natural fit for A2, once pages are components and it's clear no existing spec relies on an incidental console warning, but doing that broadly now, sight-unseen across every existing spec, is a bigger and less-verified change than this Preflight step calls for.

## Why the alternative (switching to `type="module"`) is worse, not just different

I didn't need to test this one empirically — it's structural. Inline `onclick="addAsm()"` attributes (in `index.html` and in every row the app generates at runtime) resolve against `window`. Module scripts don't share global scope, so switching the `<script>` tags to `type="module"` would break every inline handler unless *every* function any handler calls gets bridged onto `window` — and those functions live across `forms.js`, `ui.js`, `tabs.js`, `state.js`, and `rate-templates.js`, none of which are in the six-file conversion list. That's bridging effectively the whole app, not six files — much larger than A1 as scoped.

## The dist-copy plugin has a defined lifecycle now, not just a fix

Two follow-ups added directly to `vite.config.mjs`:

- **A build-time assertion.** The plugin now does a generic directory-listing diff after copying — if any file under `js/`/`data/` didn't make it into `dist/`, the build fails loudly with the exact missing paths, instead of shipping a silently-broken `dist/`. Verified this actually fires (simulated a missing file, confirmed the diff logic catches it) rather than just written and trusted.
- **A removal note for A2.** This plugin is a bridge for a problem that won't exist once `js/*.js` become real module imports and get bundled for real — at that point the plugin would start shipping untransformed duplicate files alongside the bundled ones, silently. Commented directly in `vite.config.mjs` and tracked as an explicit A2 checklist item, not left to be rediscovered.

## What carries forward

The validated `vite.config.mjs` (with the dist-copy fix, its build-time assertion, and the documented removal point) and the `netlify.toml` `[dev]` block are committed on the `phase-a-preflight` branch, ready to carry into A1 as-is. The `command`/`publish` values in `netlify.toml` were changed for this test (`command = "vite build"`, `publish = "dist"`) — that part is a real A1 decision already validated, not just a preflight throwaway.

## Bottom line

A1 builds Vite tooling around the app exactly as it is today — proven to work, tests green, no export-syntax changes. The six-file conversion happens in A2, as real component imports, where it belongs.
