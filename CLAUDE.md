# dirigo-bid-system

Commercial drywall bidding tool for Dirigo Drywall. Estimating model is **assembly-and-area based, not crew-hours based** — don't propose or add hourly-productivity concepts. Deployed at `ddbidding.netlify.app` (repo: `edahms01/dd-bidding`).

## Architecture — read this before touching rendering

The app is vanilla HTML/CSS/JS, loaded as **classic (non-module) `<script>` tags**, in this exact order (`index.html`, near the closing `</body>`):

```
js/autosave.js → js/drafts.js → js/state.js → js/calculator.js →
js/history-analytics.js → js/history.js → js/rate-templates.js →
js/agent.js → js/forms.js → js/tabs.js → js/ui.js → data/seed.js
```

Order matters — later files call functions defined in earlier ones via plain global scope (classic scripts all share one `window`). There is **no bundler-managed dependency graph** for this code yet (see Build tooling below for what *is* bundled).

**State lives in the DOM, not in memory.** `collectFormData()` (`js/state.js`) rebuilds a full bid object by reading input values back out by element ID/position on demand — there's no central store. `populateForm()` (`js/forms.js`) writes a plain object back into the DOM. The one real in-memory state is a near-empty `STATE` object (`js/state.js`) holding just the confidence level. This is a known, deliberate limitation — see "Phase A migration" below.

**Rendering is split two ways.** Six pages (Project, Conditions, Rates, Assemblies, Walls, Ceilings) are static markup in `index.html`, mutated via targeted DOM writes (`populateForm()`, `addAsm()`/`addWall()`/`addCeil()` appending rows). Four pages (History, Dashboard, Agent Recommendation, and the Output sub-panels) render by assigning a full HTML template string to `.innerHTML` on every render (`js/ui.js`: `renderHistory`, `renderDashboard`, `renderAgentTab`/`_renderAgentResult`, `renderOutput`).

**Module boundary that must survive any future rendering rewrite**: `calculator.js` and `history-analytics.js` are pure, already unit-tested — no DOM access. `drafts.js` and `history.js` are storage/network. `agent.js` is the agent invocation. `netlify/functions/*` is the backend. These stay as plain modules regardless of what owns rendering.

## Build tooling

**Vite** is standing up production build tooling (`vite.config.mjs`), landed as part of the Phase A React migration's Preflight work — **the app itself is still fully vanilla; only the build pipeline changed.** `package.json`'s `"type": "commonjs"` is deliberately unchanged (Netlify Functions and the classic script tags both depend on that; see `docs/preflight-report.md` for why `type="module"` isn't compatible with this app as structured).

**`vite.config.mjs` has one non-obvious plugin** (`copy-classic-script-sources`): `vite build` refuses to bundle classic `<script src>` tags *and* silently omits the files they reference from `dist/` — a plain `vite build` here produces a build that looks successful but 404s on every `js/*.js` file at runtime. The plugin copies `js/` and `data/` into `dist/` after build, with a build-time assertion that fails loudly if any expected file goes missing. **This plugin must be deleted once Phase A's React migration (A2) converts `js/*.js` to real bundled module imports** — at that point it would start shipping untransformed duplicate files alongside the bundled output, silently. Tracked as an explicit A2 checklist item in `docs/phase-a-implementation-plan.md`.

`npm test` = Vitest (`vitest.config.mjs`, `environment: 'node'`, `tests/unit/**/*.test.js`). `npm run test:e2e` = Playwright (`playwright.config.mjs`, `tests/e2e/`, single worker — bid history lives in one shared Netlify Blobs store, `fullyParallel: false` because specs share `localStorage`).

## Netlify config

`netlify.toml` now has an explicit `[build]` block (`command = "vite build"`, `publish = "dist"`, `functions = "netlify/functions"`) and an explicit `[dev]` block (`command = "npx vite --port 5173"`, `targetPort = 5173`) — without the `[dev]` block, Netlify's framework auto-detection misreads `package.json`'s scripts and tries to run `npm run test` as the dev command instead of starting Vite. Both blocks are load-bearing, not stylistic.

`[build.environment]` sets `NPM_FLAGS = "--include=dev"` — **load-bearing, do not remove.** Netlify's build image sets `NODE_ENV=production`, which makes `npm ci` skip devDependencies, but `vite` (the build tool) is one. Without this flag, production and every deploy preview fail to build at all (confirmed: this took down the first real deploy-preview build attempt for this exact reason). Rollback path, verified: reverting the merge commit that introduced this config (`git revert -m 1 <merge-sha>`) restores `publish = "."` with no build command — the pre-Phase-A production config — with a clean, empty diff against the last commit before that merge. Confirmed by diffing, not just asserted.

## Testing conventions

- `tests/e2e/helpers.js` exports `clearAll(page)`/`loadSeed(page)` — always use these, never a bare `page.click('button:has-text("Clear all data")')`, since `clearSeedData()` is an async fetch-then-reload and a bare click races ahead of the reload.
- Specs assert on **spec files as the unit**, not test count — the Phase A migration's parity gate treats "any spec file needing modification" as evidence behavior changed. See `docs/step-0-coverage-report.md` for the full inventory.
- **One test is intentionally inverted**: `tests/e2e/finalize-modal-selection-not-persisted.spec.js` passes today because the app has a bug (see Known follow-ups below) and is expected to *fail* once that bug is fixed — that failure is success, not a regression. Read its header comment in full before touching it.

## Known follow-ups (accepted technical debt, not yet scheduled)

- **Finalize modal's selected amount is never persisted.** `_finalizeBid()` (`js/ui.js`) computes the selected option/custom-override amount but only uses it for the client-side success toast — `submitBid()` independently recomputes `final_bid` from the plain calculator markup result, ignoring the modal entirely. Found and documented 2026-08-26 while closing Phase A's Step 0 coverage gaps (see `docs/step-0-coverage-report.md`). Regression-pinned in `tests/e2e/finalize-modal-selection-not-persisted.spec.js`.
- **Finalize failure panel renders on the wrong tab.** `submitBid()`'s failure panel targets `#output-bid` (Tab 7), but `_finalizeBid()`'s modal (where the user is actually looking) is open on Tab 8. Known, documented in a code comment at the failure's `catch` block in `js/ui.js`. Fix is scoped to Phase E (5.6) of the migration roadmap, not sooner.
- Inline-`onclick`-with-interpolated-data is a JS-string-context injection distinct from `innerHTML` escaping (HTML entity-decoding happens before inline-handler JS runs) — `escapeHtml()` doesn't protect this path. See comment at `js/ui.js` near `escapeHtml()`.
- Legacy `cost_variance` null-handling on records predating the split labor/material actual-cost fields.
- **`vite` should move from `devDependencies` to `dependencies`.** `NPM_FLAGS = "--include=dev"` (see Netlify config above) is required today because `vite` is a devDependency and the build tool itself, but it also installs Playwright and Vitest into every production build — wasted install time for tooling the build never uses. Tidier fix: move `vite` alone to `dependencies`, which would make `NPM_FLAGS` unnecessary. Not worth touching a verified-green build config for on its own — filed against Phase A1, do alongside that work rather than as a standalone change.

## Phase A: React migration + design system (in progress)

The rendering split described above (static-markup pages vs. `innerHTML`-replace pages) is being replaced with React, because several approved upcoming features (a persistent totals rail, reactive calculation, a live price slider, live step-completion indicators) need to update *while the user is typing* — the current `innerHTML`-replace pattern destroys and recreates focused inputs on every render.

- **Plan**: `docs/phase-a-implementation-plan.md` — the full approved execution plan (PR A1/A2 split, state model, migration sequencing, escalation triggers).
- **Reports**: `docs/preflight-report.md` (build-tooling boot-compatibility verification, mutation-tested against the real parity harness) and `docs/step-0-coverage-report.md` (test coverage gaps, now closed).
- **Source docs** (`phase-a-brief.md`, `dirigo-ux-decisions.md` — the full UX decision record for Phases A–G) are pending commit into `docs/`; currently only in a local Downloads folder. Anyone picking this up cold should ask for them if they're not yet in the repo.
- **Current state**: Preflight + Step 0 complete on the `phase-a-preflight` branch, pending a verified Netlify deploy preview before merge to `main` (this branch changes production build/publish settings — see `netlify.toml`). A1 (tooling/tokens, still vanilla JS) not yet started.
