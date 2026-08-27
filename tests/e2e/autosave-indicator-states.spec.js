import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Coverage gap closed (see docs/step-0-coverage-report.md, Gap 2): the
// underlying debounce/persistence behavior is covered elsewhere
// (autosave-persistence.spec.js), but nothing ever asserts on
// #autosave-indicator itself — the actual UI Phase A must preserve.
//
// Scope note, found while writing this spec, not assumed going in:
// _autosave()'s own error path (js/forms.js `_autosave()`) is
// effectively unreachable via a plain storage-write failure. A forced
// localStorage.setItem() throw during autosave *is* caught -- inside
// _saveDraftsMap(), which sets the indicator to 'error' -- but control
// then returns to _autosave()'s own try block, which sees no exception
// (the inner catch swallowed it) and immediately overwrites that with
// _setIndicator('saved'). Verified directly in a real browser: forcing
// every localStorage.setItem() to throw still leaves the indicator
// reading "Saved [time]", never "error". Worth flagging to Eric on its
// own -- a storage failure during autosave is currently masked from the
// user -- but out of scope to change here; Phase A preserves behavior
// as-is. This spec covers the two states that are actually reachable
// through normal use: 'saving' and 'saved'.
test('the autosave indicator shows "Saving…" immediately, then "Saved" with a timestamp after the debounce window', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  const indicator = page.locator('#autosave-indicator');

  await page.fill('#proj-name', 'Autosave QA');

  // Indicator flips to 'saving' synchronously, well before the 700ms
  // debounce elapses.
  await expect(indicator).toHaveClass(/saving/);
  await expect(indicator).toHaveText('Saving…');

  // Past the debounce window, the actual write has happened.
  await expect(indicator).toHaveClass(/saved/, { timeout: 2000 });
  await expect(indicator).toHaveText(/^Saved ✓ /);
});

test('editing again after a save cycles the indicator back through saving → saved', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  const indicator = page.locator('#autosave-indicator');

  await page.fill('#proj-name', 'First edit');
  await expect(indicator).toHaveClass(/saved/, { timeout: 2000 });

  await page.fill('#proj-gc', 'Second edit, different field');
  await expect(indicator).toHaveClass(/saving/);

  // Not asserting the timestamp text changed (both saves can legitimately
  // land in the same displayed minute) -- just that the state machine
  // actually cycled back through 'saving' rather than staying 'saved'
  // the whole time, which this and the expect() above together prove.
  await expect(indicator).toHaveClass(/saved/, { timeout: 2000 });
  expect(await indicator.textContent()).toMatch(/^Saved ✓ /);
});
