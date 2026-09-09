# Wire height adders (Above 12 ft / Above 20 ft) into the bid total — Implementation Plan

> **For agentic workers:** implement task-by-task, TDD, two-commit convention per the repo's standing discipline (production code + recaptured fixtures first, then test infra/docs). Steps use `- [ ]` checkboxes.

**Goal:** Make `rates.adder12Pct` / `rates.adder20Pct` (captured on the Rates tab, currently dead) actually raise the bid's labor cost for the square footage entered in `conditions.sfAbove12` / `conditions.sfAbove20`, inserted between raw labor and the burden calculation so burden loads on top of the height premium.

**Architecture:** Extend `buildCostSummary()` (`js/calculator.js`) — already modified by the labor-burden brief (merged, PR #54) — with four new trailing params and a job-level average-$/SF height uplift. Burden/supervision then compute off the height-adjusted labor. `laborTotal` stays raw. Surface the two new dollar figures in `OutputPage.jsx`'s Category subtotals panel next to Burden/Supervision. No new business math beyond the uplift formula; `applyLaborBurden()` is unchanged.

**Spec:** the brief in this conversation ("Wire height adders … into the bid total"). This plan supersedes the brief's illustrative code where it disagrees with the actually-merged repo state (verified below).

## Verified repo state (2026-09-09, `main` @ `7982bc9`)

The burden brief is **merged** — sequencing precondition satisfied. Actual merged shapes:

- `js/calculator.js:149` —
  `function buildCostSummary(wallCosts, ceilingCosts, logistics, fallbackWastePct, burdenPct, superPct)`
  returns `{ laborTotal, burden, supervision, laborWithBurden, materialTotal, logisticsTotal, directCostTotal, weightedWastePct }`.
- `js/calculator.js:94` — `applyLaborBurden(laborSubtotal, burdenRate, supervisionRate)` returns
  `{ laborSubtotal, burden, supervision, laborWithBurden }`. **Not changed by this work.**
- Each wall/ceiling cost row carries `netSF` (`js/calculator.js:84`) and `laborTotal` (`:88`). Errored rows
  return `{ location, typeId, error }` with **no** `netSF`/`laborTotal` — the `|| 0` guards already cover them
  (an errored row contributes 0 to both `totalSF` and `laborTotal`, staying internally consistent).
- Call sites: `js/ui.js:357-358` (`calculateOnly()`) and `js/ui.js:451-452` (`submitBid()`), each already passing
  `state.rates.burdenPct, state.rates.superPct` and with `state.rates` / `state.conditions` in scope.
- `src/pages/OutputPage.jsx`: `SubtotalRow({ label, value, accent })` at `:51`, renders `data-row={label}` +
  `.subtotal-val`. Burden/Supervision rows at `:161-162`. Totals-bar "Labor" uses `summary.laborWithBurden`
  (`:147`); `TopCostDrivers` `laborPct` uses `summary.laborWithBurden` (`:109`). **Neither needs a change** —
  `laborWithBurden` is downstream of the uplift once the calculator change lands.
- `src/state/fieldRegistry.js`: `rates.adder12Pct` / `rates.adder20Pct` at `:153-154` are
  `{ consumedBy: 'calculator', knownGap: true }`; `conditions.sfAbove20` at `:123` is
  `{ consumedBy: 'both', knownGap: true }`; `conditions.sfAbove12` at `:122` is `{ consumedBy: 'both' }` (no gap).
- Tests calling `buildCostSummary`: `tests/unit/calculator.test.js:191,212,228,371`;
  `tests/e2e/rate-escalation.spec.js:75`.
- `tests/e2e/submit-bid-persists.spec.js:66-74` — split-sum invariant
  `estimated_labor_cost + estimated_material_cost == direct_cost - logistics - burden - supervision`,
  and `estimated_labor_cost == displayedRawLabor`.
- **Seed exercises the 12 ft band:** `data/seed.json` has `conditions.sfAbove12: 3200`, `sfAbove20: 0`,
  `rates.adder12Pct: 18`, `rates.adder20Pct: 35`. So the golden-bid unit regression and any seed-driven
  e2e dollar assertions **will move** and must be re-pinned by recomputation.
- `tests/fixtures/golden-export.json` is a `collectFormData()` **input** snapshot with no computed cost field
  (`golden-export-parity.spec.js` compares input shape only). Expected **byte-identical, not recaptured** —
  same as the burden brief. (Confirm in Q4.)

## Global Constraints

- Assembly-and-area estimating model — no crew-hours concepts.
- Do **not** touch `history-analytics.js`. `calculator.js` gets exactly the one scoped change below.
- `laborTotal` in the summary stays **raw** (pre-height-uplift, pre-burden). `buildBidRecord()` persists it as
  `estimated_labor_cost` — do not repurpose. No `js/state.js` change.
- Two-commit convention per unit of work: production code (+ any recaptured fixture) first, then test infra + docs.
  Each commit green on its own. List every touched file in the split before merging.
- Docs update in the same commit as the code: `CLAUDE.md` (add a section mirroring the burden brief's), and
  `src/state/fieldRegistry.js` comments.
- QA before merge: full Vitest + Playwright green locally; `netlify dev` before/after hand-check of Direct cost
  total and final bid price; read-only deploy-preview check (blank bid, enter rates + SF manually); mobile 390px
  check of the new row(s). Checkpoint report with actual verified dollar figures and any deviation named.
- Caveman session style is for chat only — code, comments, commit messages, this doc: normal prose.

## Formula (authoritative — use this, not the brief's Number()-less snippet)

Inside `buildCostSummary`, after `laborTotal` and `materialTotal` are computed, before the `applyLaborBurden` call:

```js
// Job-wide average $/SF of labor — the only way to target "just the tall
// square footage" when height data is captured per job, not per wall/ceiling row.
const totalSF = wallCosts.reduce((s, r)    => s + (r.netSF || 0), 0)
              + ceilingCosts.reduce((s, r) => s + (r.netSF || 0), 0);
const avgLaborPerSF = totalSF > 0 ? laborTotal / totalSF : 0;

const a12  = Number(adder12Pct) || 0;
const a20  = Number(adder20Pct) || 0;
const sf12 = Number(sfAbove12)  || 0;
const sf20 = Number(sfAbove20)  || 0;

// sfAbove12 / sfAbove20 are non-overlapping bands (12–20 ft, and >20 ft).
// The >20 ft band is above 12 ft too, so it stacks both adders.
const heightUplift12 = sf12 * avgLaborPerSF * (a12 / 100);
const heightUplift20 = sf20 * avgLaborPerSF * ((a12 + a20) / 100);
const laborWithHeightUplift = laborTotal + heightUplift12 + heightUplift20;

const { burden, supervision, laborWithBurden } =
  applyLaborBurden(laborWithHeightUplift, Number(burdenPct) || 0, Number(superPct) || 0);
```

Return object gains `heightUplift12, heightUplift20, laborWithHeightUplift`. `directCostTotal` expression is
unchanged (`laborWithBurden + materialTotal + logistics.total`) — `laborWithBurden` now already contains the
uplift. `Number()` guards mirror the burden brief's hygiene for `burdenPct`/`superPct`; the live path already
`num()`s these via `collectFormData()`, but the registry/unit tests pass raw values.

New signature (10 params):

```
buildCostSummary(wallCosts, ceilingCosts, logistics, fallbackWastePct,
                 burdenPct, superPct, adder12Pct, adder20Pct, sfAbove12, sfAbove20)
```

---

## Task 1: `buildCostSummary()` — add the four params + height uplift

**Files:**
- Modify: `js/calculator.js:149-175`
- Test: `tests/unit/calculator.test.js` (new `describe` block; `:184` and `:212` and `:228` blocks get the 4 extra args; `:355` golden-bid re-pin)

**Interfaces:**
- Produces: `buildCostSummary(..., adder12Pct, adder20Pct, sfAbove12, sfAbove20)` returning the existing keys
  plus `heightUplift12`, `heightUplift20`, `laborWithHeightUplift` (all numbers).

- [ ] **Step 1 — failing test: 12 ft adder only.** Add to `tests/unit/calculator.test.js`, after the burden
  `describe` (ends `:261`):

```js
describe('buildCostSummary — height adders (Above 12 ft / Above 20 ft)', () => {
  function setup({ a12 = 0, a20 = 0, sf12 = 0, sf20 = 0, burdenPct = 0, superPct = 0 } = {}) {
    const conditions = sampleConditions({ wastePct: 10 });
    const walls    = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), conditions);
    const logistics = calculateLogistics(conditions, sampleRates());
    const summary  = buildCostSummary(walls, [], logistics, 10, burdenPct, superPct, a12, a20, sf12, sf20);
    const totalSF  = walls.reduce((s, r) => s + (r.netSF || 0), 0);
    const avg      = summary.laborTotal / totalSF;
    return { walls, logistics, summary, avg };
  }

  it('applies only the 12 ft adder when sfAbove20 is 0', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 100, sf20: 0 });
    expect(summary.heightUplift12).toBeCloseTo(100 * avg * 0.15, 6);
    expect(summary.heightUplift20).toBe(0);
    expect(summary.laborWithHeightUplift).toBeCloseTo(summary.laborTotal + summary.heightUplift12, 6);
    expect(summary.laborTotal).toBeCloseTo(summary.laborWithHeightUplift - summary.heightUplift12, 6); // raw unchanged
  });

  it('stacks both adders on the sfAbove20 band', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 0, sf20: 100 });
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBeCloseTo(100 * avg * 0.45, 6); // (15 + 30) / 100
  });

  it('both bands non-zero: 12 ft band gets a12 only, 20 ft band gets a12+a20', () => {
    const { summary, avg } = setup({ a12: 15, a20: 30, sf12: 200, sf20: 100 });
    expect(summary.heightUplift12).toBeCloseTo(200 * avg * 0.15, 6);
    expect(summary.heightUplift20).toBeCloseTo(100 * avg * 0.45, 6);
    expect(summary.laborWithHeightUplift).toBeCloseTo(
      summary.laborTotal + summary.heightUplift12 + summary.heightUplift20, 6);
  });

  it('both adders 0 → identical to pre-fix (additive change only)', () => {
    const { summary, logistics, walls } = setup({ a12: 0, a20: 0, sf12: 500, sf20: 500 });
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBe(0);
    expect(summary.directCostTotal).toBeCloseTo(
      walls[0].laborTotal + summary.materialTotal + logistics.total, 6);
  });

  it('burden loads on top of the height uplift, not the other way around', () => {
    const { summary } = setup({ a12: 20, a20: 0, sf12: 300, sf20: 0, burdenPct: 30, superPct: 10 });
    expect(summary.burden).toBeCloseTo(summary.laborWithHeightUplift * 0.30, 6);
    expect(summary.supervision).toBeCloseTo(summary.laborWithHeightUplift * 0.10, 6);
    expect(summary.laborWithBurden).toBeCloseTo(summary.laborWithHeightUplift * 1.40, 6);
    expect(summary.directCostTotal).toBeCloseTo(
      summary.laborWithBurden + summary.materialTotal + summary.logisticsTotal, 6);
  });

  it('coerces missing / empty-string adder + SF args to 0', () => {
    const conditions = sampleConditions({ wastePct: 10 });
    const walls = calculateWallCosts([sampleWall()], [sampleAssembly()], sampleRates(), conditions);
    const logistics = calculateLogistics(conditions, sampleRates());
    const summary = buildCostSummary(walls, [], logistics, 10, 0, 0, undefined, '', undefined, '');
    expect(summary.heightUplift12).toBe(0);
    expect(summary.heightUplift20).toBe(0);
    expect(Number.isFinite(summary.directCostTotal)).toBe(true);
  });
});
```

- [ ] **Step 2 — run, verify red.** `npx playwright` not involved; run
  `cd /Users/eric/Desktop/Claude/dirigo-bid-system && npx vitest run tests/unit/calculator.test.js -t "height adders"`.
  Expected: FAIL (`heightUplift12` undefined / `NaN`).

- [ ] **Step 3 — implement in `js/calculator.js`.** Change the signature at `:149` to the 10-param form,
  insert the formula block from the "Formula" section above between the `materialTotal` line (`:153`) and the
  `applyLaborBurden` call (`:162`), and add `heightUplift12, heightUplift20, laborWithHeightUplift` to the
  returned object (place them right after `laborTotal`). Update the block comment at `:155-161` to note the
  height uplift precedes burden. Leave the `laborTotal` comment ("stays raw on purpose") — it now also means
  pre-height-uplift; extend that sentence.

- [ ] **Step 4 — run, verify the new block green.**
  `npx vitest run tests/unit/calculator.test.js -t "height adders"` → PASS.

- [ ] **Step 5 — fix the pre-existing `buildCostSummary` unit call sites.** Add `, 0, 0, 0, 0` to the calls at
  `tests/unit/calculator.test.js:191` and `:212`, and add `, 0, 0` to the `setup()` call at `:228`
  (`buildCostSummary(walls, [], logistics, 10, burdenPct, superPct, 0, 0, 0, 0)`). These blocks assert
  height-independent behavior; zero args keep them exactly as-is.

- [ ] **Step 6 — re-pin the golden-bid regression (`:365-392`).** Seed values: `burdenPct 34`, `superPct 9`,
  `adder12Pct 18`, `adder20Pct 35`, `sfAbove12 3200`, `sfAbove20 0`, `totalSF 17520`, raw `laborTotal 76956`.
  Update the call at `:371-372` to
  `buildCostSummary(wallCosts, ceilCosts, logistics, seed.conditions.wastePct, seed.rates.burdenPct, seed.rates.superPct, seed.rates.adder12Pct, seed.rates.adder20Pct, seed.conditions.sfAbove12, seed.conditions.sfAbove20)`
  and replace the pinned numbers + comment with (recomputed, verified by running the calculator against the
  seed fixture — do not hand-transcribe, re-run to confirm):

```
  //   avgLaborPerSF     = 76956 / 17520            = 4.392465753424657
  //   heightUplift12    = 3200 × avg × 0.18        = 2530.0602739726028
  //   heightUplift20    = 0 (sfAbove20 = 0)
  //   laborWithHeightUplift                        = 79486.0602739726
  //   burden            = 79486.0602739726 × 0.34  = 27025.260493150683
  //   supervision       = 79486.0602739726 × 0.09  = 7153.7454246575335
  //   laborWithBurden                              = 113665.06619178082
  expect(summary.laborTotal).toBeCloseTo(76956, 3);
  expect(summary.materialTotal).toBeCloseTo(21490.6168, 3);
  expect(summary.heightUplift12).toBeCloseTo(2530.0602739726028, 3);
  expect(summary.heightUplift20).toBe(0);
  expect(summary.laborWithHeightUplift).toBeCloseTo(79486.0602739726, 3);
  expect(summary.burden).toBeCloseTo(27025.260493150683, 3);
  expect(summary.supervision).toBeCloseTo(7153.7454246575335, 3);
  expect(summary.laborWithBurden).toBeCloseTo(113665.06619178082, 3);
  // directCostTotal = laborWithBurden (113665.06619178082) + materialTotal (21490.6168)
  //                   + logistics.total (13060.00) = 148215.6829917808
  // markup is a flat ×1.3, so finalBidPrice = 192680.38788931505; effectiveMargin unchanged.
  expect(summary.directCostTotal).toBeCloseTo(148215.6829917808, 3);
  expect(markup.finalBidPrice).toBeCloseTo(192680.38788931505, 3);
  expect(markup.effectiveMargin).toBeCloseTo(23.076923076923084, 6);
```

  (Prior burden-only pins were `directCostTotal 144597.6968`, `finalBidPrice 187977.00584` — the delta is the
  `2530.06` uplift, grossed up by 1.43 burden then 1.3 markup.)

- [ ] **Step 7 — run full Vitest.** `npm test` → all green.

- [ ] **Step 8 — commit (production).** `git add js/calculator.js && git commit` —
  message: `Wire height adders (Above 12 ft / Above 20 ft) into buildCostSummary`.
  (Unit-test edits ride the test-infra commit at the end, per the two-commit split — but `js/calculator.js`
  alone must leave `npm test` green, which it does because the new `describe` block and re-pin land together in
  the next commit; if the repo's CI runs per-commit, fold Steps 1/5/6 test edits into this commit instead and
  keep only *new spec files* for the second commit. Match whatever the burden brief's PR did.)

---

## Task 2: pass the four args from both `js/ui.js` call sites

**Files:**
- Modify: `js/ui.js:357-358`, `js/ui.js:451-452`

**Interfaces:**
- Consumes: `state.rates.adder12Pct`, `state.rates.adder20Pct`, `state.conditions.sfAbove12`,
  `state.conditions.sfAbove20` — all already reachable (`state` from `collectFormData()`).

- [ ] **Step 1 — update `calculateOnly()` (`:357`).**

```js
const summary      = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct,
  state.rates.burdenPct, state.rates.superPct,
  state.rates.adder12Pct, state.rates.adder20Pct,
  state.conditions.sfAbove12, state.conditions.sfAbove20);
```

- [ ] **Step 2 — update `submitBid()` (`:451`)** identically.

- [ ] **Step 3 — update `tests/e2e/rate-escalation.spec.js:75`** to pass `, 0, 0, 0, 0` after the burden args
  (that spec pins escalation math with no height SF; zeros keep it unchanged). Verify by reading the
  surrounding assertions — if it uses seed conditions with `sfAbove12`, pass the real
  `state.conditions.sfAbove12` etc. instead and re-pin. (It currently passes literal `0, 0` for burden, so
  literal zeros are consistent.)

- [ ] **Step 4 — run e2e for the touched specs.**
  `npx playwright test rate-escalation` → green.

---

## Task 3: surface the uplift in `OutputPage.jsx`

**Files:**
- Modify: `src/pages/OutputPage.jsx:160-169`
- Test: `tests/e2e/cost-summary-height-adders.spec.js` (new), plus `tests/e2e/submit-bid-persists.spec.js`

**Interfaces:**
- Consumes: `summary.heightUplift12`, `summary.heightUplift20`.

**Decision pending — see Q1.** This plan assumes **two rows** ("Above 12 ft" / "Above 20 ft"), matching the
Burden/Supervision pattern and letting the split-sum e2e read each separately. If Q1 comes back "one combined
row," collapse to a single `SubtotalRow label="Height adders" value={fmtCost(summary.heightUplift12 + summary.heightUplift20)}`
and adjust the new spec + Task 4 accordingly.

- [ ] **Step 1 — failing test.** New `tests/e2e/cost-summary-height-adders.spec.js`, modeled on
  `tests/e2e/cost-summary-burden.spec.js`:

```js
const { test, expect } = require('@playwright/test');
const { clearAll } = require('./helpers');

// Seed carries adder12Pct 18 / adder20Pct 35 / sfAbove12 3200 / sfAbove20 0,
// so the "Above 12 ft" row is non-zero and "Above 20 ft" is exactly $0.
test('Cost Summary shows height-adder rows and the panel still sums to Direct cost total', async ({ page }) => {
  await clearAll(page);
  await page.goto('/');
  await page.evaluate(() => window.loadSeedData());
  await page.locator('#tab-output').click();

  const dollars = async (row) => {
    const txt = await page.locator(`[data-row="${row}"] .subtotal-val`).innerText();
    return Number(txt.replace(/[^0-9.-]/g, ''));
  };

  const rawLabor = await dollars('Labor (raw)');
  const burden   = await dollars('Burden');
  const superv   = await dollars('Supervision');
  const up12     = await dollars('Above 12 ft');
  const up20     = await dollars('Above 20 ft');
  const mats     = await dollars('Materials (incl. 10% waste)'); // match the live label
  // Materials label carries the weighted waste % — read it loosely instead:
  //   const matsRow = page.locator('[data-row^="Materials"] .subtotal-val'); ...

  expect(up12).toBeGreaterThan(0);
  expect(up20).toBe(0);

  // Panel adds up: raw labor + 12ft + 20ft + burden + supervision + materials + logistics = Direct cost total
  const logistics = /* read [data-row^="Logistics"] */ 0;
  const dct = /* read the "Direct cost total" line in the panel */ 0;
  expect(Math.abs((rawLabor + up12 + up20 + burden + superv + mats + logistics) - dct)).toBeLessThanOrEqual(2);
});
```

  (Flesh out the logistics/materials/DCT locators against the real DOM — `cost-summary-burden.spec.js` already
  has working versions of all three; copy them.)

- [ ] **Step 2 — run, verify red** (`[data-row="Above 12 ft"]` not found).

- [ ] **Step 3 — implement.** In `OutputPage.jsx`, insert two rows between the Supervision row (`:162`) and the
  Materials row (`:163`):

```jsx
<SubtotalRow label="Above 12 ft" value={fmtCost(summary.heightUplift12)} />
<SubtotalRow label="Above 20 ft" value={fmtCost(summary.heightUplift20)} />
```

  Order in the panel becomes: Labor (raw) → Above 12 ft → Above 20 ft → Burden → Supervision → Materials →
  Logistics → Direct cost total. (Height uplift sits directly under raw labor because it's a labor premium that
  burden is then computed on — reads top-to-bottom in calculation order.)

- [ ] **Step 4 — run, verify green.**

- [ ] **Step 5 — no change needed to the totals-bar "Labor" tile or `TopCostDrivers`.** Confirm by reading
  `:147` and `:109`: both already use `summary.laborWithBurden`, which now includes the uplift. Add a one-line
  code comment at `:147` noting it now also reflects height uplift.

---

## Task 4: fix the `submit-bid-persists.spec.js` split-sum invariant

**Files:**
- Modify: `tests/e2e/submit-bid-persists.spec.js:60-74`

The persisted `estimated_labor_cost` stays **raw** (no burden, no height uplift) — same principle as burden.
So the invariant grows two more subtracted terms.

- [ ] **Step 1 — update the invariant.** Read the displayed "Above 12 ft" / "Above 20 ft" rows the same way the
  spec already reads Burden/Supervision, and change `:66-71` to:

```js
//   estimated_labor_cost + estimated_material_cost
//     = direct_cost - logistics - burden - supervision - heightUplift12 - heightUplift20
const expectedSplitTotal =
  saved.direct_cost - displayedLogistics - displayedBurden - displayedSupervision
    - displayedUplift12 - displayedUplift20;
```

  The `estimated_labor_cost == displayedRawLabor` assertion at `:74` is unchanged and still correct (raw is
  still raw). If Q1 = combined row, subtract a single `displayedHeightAdders` term instead.

- [ ] **Step 2 — run** `npx playwright test submit-bid-persists` → green (numbers move, invariant holds).

- [ ] **Step 3 — sweep remaining e2e for seed-driven dollar assertions.**
  `grep -rl "loadSeedData\|loadSeed" tests/e2e` then check each for a hard-coded dollar total that includes
  labor. Likely candidates beyond the two above: `finalize-*`, `exterior-wall-rate.spec.js`,
  `top-cost-drivers.spec.js`, `finalize-confirmation-tab.spec.js` (asserts `recommended_bid` etc.).
  For each with a literal expected total, recompute by hand against the new calculator output and re-pin —
  **red here is the fix working; confirm by recomputation, don't just paste the new output.** List every spec
  touched in the checkpoint report.

- [ ] **Step 4 — golden-export parity.** Run `npx playwright test golden-export-parity`. Expected: **green,
  unmodified** — the fixture is a `collectFormData()` input snapshot with no computed cost field. If it fails,
  stop and report (means the snapshot shape changed unexpectedly — investigate before recapturing). See Q4.

---

## Task 5: field registry + docs

**Files:**
- Modify: `src/state/fieldRegistry.js:122-123`, `:153-154`
- Modify: `CLAUDE.md`
- Test: `tests/unit/fieldRegistry.test.js` (should pass unmodified — it checks the token appears in
  `calculator.js`, which it now does)

- [ ] **Step 1 — registry.** Change `:153-154` to:

```js
'rates.adder12Pct':  { consumedBy: 'calculator' }, // buildCostSummary() height uplift (12–20 ft band)
'rates.adder20Pct':  { consumedBy: 'calculator' }, // buildCostSummary() height uplift (>20 ft band, stacked)
```

  Change `:123` to drop `knownGap: true` (keep `consumedBy: 'both'` — still sent to the agent, now also costed):

```js
'conditions.sfAbove20':        { consumedBy: 'both' }, // calculateLogistics gate is sfAbove12; sfAbove20 now drives buildCostSummary height uplift + sent
```

  `conditions.sfAbove12` (`:122`) is already `{ consumedBy: 'both' }` — no change.

- [ ] **Step 2 — run** `npx vitest run tests/unit/fieldRegistry.test.js` → green.

- [ ] **Step 3 — `CLAUDE.md`.** Add a section after "Labor burden + supervision wired into the bid total",
  same shape: what was dead, the product decision (non-overlapping bands; >20 ft stacks both adders; job-level
  avg-$/SF approximation because height SF isn't per-row), the `buildCostSummary` signature growth to 10 params
  and the deferred object-param refactor (per Q2), the new return fields, `laborTotal` still raw, the two new
  `OutputPage` rows, the re-pinned golden-bid numbers, and "no golden-export change (input snapshot)".

- [ ] **Step 4 — commit (test infra + docs).** `git add tests/ src/state/fieldRegistry.js CLAUDE.md` +
  the new spec file; message:
  `test + docs: height adders wired into the bid total`.

---

## Self-review checklist (run before opening the PR)

- [ ] `npm test` fully green (Vitest).
- [ ] `npm run test:e2e` fully green — `lsof -i :4173 -i :5173` clear first (stray dev server hazard).
- [ ] `npx vite build` clean.
- [ ] `netlify dev`: load seed, read Direct cost total + final bid price; verify against
  `labor 76956 → +2530.06 uplift → ×1.43 burden → +materials+logistics → ×1.3 markup`
  ⇒ Direct cost `148215.68`, final bid `192680.39`. Then bump `sfAbove20` to a nonzero value by hand and
  confirm "Above 20 ft" moves and stacks both adders.
- [ ] Category subtotals panel sums exactly to Direct cost total with both new rows included.
- [ ] Deploy preview (read-only): blank bid, enter `adder12Pct` / `adder20Pct` + both SF fields manually,
  confirm the two rows render and track the fields. **No seed load / finalize on the preview** (shared Blobs).
- [ ] Mobile 390px: the two new rows — no label/number wrap or overflow, consistent with Burden/Supervision.
- [ ] Checkpoint report: files touched (per commit), actual verified dollar figures, every re-pinned spec named,
  every deviation from this plan named explicitly.

---

## Open questions for Eric

1. **One combined "Height adders" row, or two ("Above 12 ft" / "Above 20 ft")?**
   Recommendation: **two** — matches the Burden/Supervision pattern the burden brief just established, and lets
   the `submit-bid-persists` split-sum invariant read each term separately. The brief left this to Code's call;
   confirming because it changes `OutputPage.jsx` and three e2e assertions.

2. **The signature is now 10 positional params after two briefs each bolted on trailing args. Bundle the
   rate/condition-driven ones (`burdenPct, superPct, adder12Pct, adder20Pct, sfAbove12, sfAbove20`) into a
   single object param in this PR, or defer to a standalone cleanup?**
   Recommendation: **defer.** It's a real refactor — touches both `js/ui.js` call sites, the burden brief's
   unit tests (again), `rate-escalation.spec.js`, and the golden-bid re-pin — and mixing it into a
   calculation-math change enlarges the blast radius of the part that actually needs careful verification. File
   it as its own pass.

3. **Persisted `estimated_labor_cost` stays raw — excludes the height uplift, exactly like it excludes burden —
   correct?** The brief implies yes ("still raw — pre-height-uplift, pre-burden. Don't repurpose this field").
   Confirming because it's the second field-semantics call in a row and the `submit-bid-persists` invariant
   depends on it.

4. **Golden-export fixture: expected byte-identical (no recapture), since it's a `collectFormData()` input
   snapshot with no computed cost field — same as the burden brief. Confirm that's the expectation** and the
   brief's "recapture if the seed exercises a height band" line is superseded by that fact. (The seed *does*
   exercise the 12 ft band, but only computed totals move, and the fixture holds none.)

5. **Tolerance for the `submit-bid-persists` invariant is currently `<= 2` dollars. The height uplift adds one
   more rounded display term to subtract. Keep `<= 2`, or widen to `<= 3`?** Minor; recommendation: keep `<= 2`
   and see if it holds (the uplift row is `fmtCost`-rounded like the others, so the accumulated rounding error
   is bounded by ~0.5 per term). Widen only if it actually fails.
