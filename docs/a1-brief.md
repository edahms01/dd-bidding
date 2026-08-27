# A1 Handover Brief — Tooling & Design System

**Audience:** Claude Code
**Repo:** `edahms01/dd-bidding` · `main` at `edd81df` · deployed at `ddbidding.netlify.app`
**Supersedes:** `docs/phase-a-brief.md`, which predates the PR split and both preflight findings.
**Read first:** `CLAUDE.md` (Vite tooling, dist-copy plugin lifecycle, `NPM_FLAGS` rollback note, testing conventions, both Known follow-ups) and `docs/dirigo-ux-decisions.md` §9.

---

## 1. Goal

Land the design token system — CSS layering, colour split, type scale, tabular numerics, demo-controls restyle — with **zero React and zero module-export changes**. The app stays exactly as vanilla as it is today; only its build tooling and its stylesheet change.

This is PR A1 of a two-PR split. A1's entire value depends on it staying isolable: if a Playwright spec fails in A2, the only way to know it's the migration's fault and not the design system's is that A1 already proved the design system alone doesn't move the needle.

## 2. Non-goals

- No React. No components. No JSX.
- No `export` syntax added to `calculator.js`, `history-analytics.js`, `drafts.js`, `history.js`, `agent.js`, or `escapeHtml`. That conversion is A2, confirmed by the preflight to be structurally incompatible with classic `<script>` tags as they exist today.
- No URL routing, no step reorder, no responsive/mobile work, no accessibility remediation beyond what's incidental, no business logic changes. Same non-goal list as the original brief — Phases B–G own all of it.
- No touching `netlify.toml`'s build config beyond what's already merged. That's settled and verified; don't re-open it.

## 3. Scope

### 3.1 CSS layering

Split the current flat `styles.css` into, imported in this order:

```
tokens.css      design tokens only — no selectors
base.css        element defaults, typography, resets
components.css  reusable UI (buttons, fields, tables, modal, pills)
pages.css       page-specific styling
responsive.css  empty stub — Phase D
print.css       empty stub — Phase G
```

### 3.2 Colour tokens

Introduce `--action` (= current `--blue`, `#4a8fe8`), `--status-warn` (= current `--accent`, `#e87c2a`, status/category only from now on), and `--danger` / `--danger-dim` / `--danger-border` (wrapping the existing hardcoded `#e85c4a`, matching the established `-dim`/`-border` pattern).

Retarget every current `--accent` use site:

| Current `--accent` use | New token | Why |
|---|---|---|
| `.btn-primary`, `.logo-icon`, `.tab.active`/`.nav-item.active`, `.pill.on`, all focus-ring rules, `.bid-option-radio` | `--action` | primary action / active state / focus |
| `.conf-btn.md`, `.b-pct`, `.icon-x` badge | `--status-warn` | status/category signal |
| `.total-val` | `--text` (neutral) | a total is data, not an action or a status |
| `.bid-option-row.selected` | `--action` | selecting a row to submit is an action |

**Leave the agent-card colours (`OPT_COLORS` in `ui.js`) untouched in A1.** That rework — cards neutral by default, colour only on the win-likelihood pill — requires touching render logic in `ui.js` that's about to be deleted wholesale in A2. Doing it twice is wasted work. Note it in the A1 report as explicitly deferred, not forgotten.

Keep `--teal` in its current role only (Labor rate-group icon) — don't reuse it elsewhere.

### 3.3 Type scale

Binding spec, from the decision record §6.1:

| Role | Size |
|---|---|
| Body | 14px |
| Table cells | 13px |
| Hints / secondary | 12px |
| Labels | 11px |

Nothing below 11px. Apply per the detailed current→target table already validated during plan review (10px uppercase sites → 11px; 10px non-uppercase hint/caption sites → 12px, not 11px — they aren't labels; table-cell-role 13px stays 13px; don't blanket-bump everything at 12px). If you don't have that table in front of you, ask rather than guess — the uppercase/non-uppercase distinction was a real correction found during review, not a default assumption.

### 3.4 Numeric typography

Replace `'Courier New',monospace` and inline `font-family:monospace` occurrences with `font-variant-numeric: tabular-nums` on the system stack. A modern monospace may stay for hero figures only (the large bid amounts on agent option cards).

### 3.5 Demo controls

Restyle `#dev-toolbar` as a deliberate "Demo controls" affordance using tokens. Keep the existing Hide button and its behaviour exactly as-is.

## 4. Testing

The 33-file / 49-Playwright-test suite plus 98 Vitest tests must pass **unmodified** against this build. No spec should need to change — this phase touches only presentation, not behaviour or markup structure that tests key off of. If a spec does need to change, that's a signal you've crossed from styling into structure, and it's worth stopping to check before proceeding rather than after.

Add the `no-console-errors-on-load` check to your own verification pass if it isn't already part of the standard run — it's cheap and this phase is exactly the kind of change (CSS variable typos, missing imports) it would catch.

## 5. Deliverable — the density check

Before calling this done, produce **before/after screenshots of the Rates page and one takeoff table (Walls or Assemblies)**. The type scale change is a real density shift — 13px base to 14px, with a new 11px floor on labels — and it's the one part of this phase no automated test can verify. Include them in the A1 report even if nothing looks wrong; the point is giving me something to actually look at rather than trusting the diff.

## 6. Report format

Same shape as the preflight and Step 0 reports: lead with a plain-language summary of what changed and what you verified, not a file-by-file diff dump. Flag the deferred agent-card colour work explicitly so it isn't lost between now and A2.

## 7. Commit structure

Two commits, per convention: production code (tokens, CSS layers, restyled markup), then test infrastructure (only if any test changes prove necessary — flag before making them).
