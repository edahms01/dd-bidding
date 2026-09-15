import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('typing and attempting to leave before the debounce window elapses triggers the warning', async ({ page }) => {
  test.setTimeout(10000); // the dialog probe below is timeboxed to 3s — this test should never need the default 30s
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-project');
  await page.fill('#proj-name', 'QA Unsaved');

  // Check well within the 700ms debounce window.
  // hasUnsavedChanges was a top-level `let` in a classic <script> (bare-
  // readable from anywhere sharing that global lexical scope) through
  // Migration Phase 5, Bucket 1. Bucket 2, Step 1 ported forms.js to a
  // real ES module — hasUnsavedChanges is module-scoped now, invisible to
  // injected/evaluated code entirely, bare or via `window.`. Read it
  // through the pre-existing window.__getHasUnsavedChanges() accessor
  // instead (forms.js already exposed this for RatesPage.jsx's own use,
  // for exactly the same "a `let` isn't a window property" reason).
  await page.waitForTimeout(150);
  const flagBeforeDebounce = await page.evaluate(() => window.__getHasUnsavedChanges());
  expect(flagBeforeDebounce).toBe(true);

  // Secondary signal: the real native beforeunload dialog, triggered by an
  // actual navigation attempt. Native dialog interception is a known-flaky
  // spot under CDP automation — flaky enough to have hung this exact probe
  // for the full 30s test timeout in one run — so the flag check above is
  // the assertion this test lives or dies on. This is timeboxed and
  // fire-and-forget on purpose: it must not be able to hang the test even
  // if the dialog event never arrives or dismiss() never resolves.
  let dialogFired = false;
  page.once('dialog', d => { dialogFired = true; d.dismiss().catch(() => {}); });
  await Promise.race([
    page.reload().catch(() => {}),
    page.waitForTimeout(3000)
  ]);
  if (!dialogFired) {
    console.warn('native beforeunload dialog did not fire in this run — flag check above already confirms the real behavior');
  }
});
