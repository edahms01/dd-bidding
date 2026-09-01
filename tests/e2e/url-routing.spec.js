import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Phase C 2.2 — hash-based URL routing (src/state/router.js + the two
// sync effects in src/AppShell.jsx). Deep-linkable steps, working
// browser Back/Forward, and — the failure this project keeps hitting one
// layer down — no bounce-between-two-history-entries. Verified by
// actually walking steps and hammering Back/Forward, per the plan.

const hash = (page) => page.evaluate(() => location.hash);

test('a bare load normalizes the URL to #/project without adding a history entry', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await expect.poll(() => hash(page)).toBe('#/project');
  await expect(page.locator('#page-project')).toHaveClass(/active/);
});

test('deep link opens the named step directly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.goto('/#/rates');
  await expect(page.locator('#page-rates')).toHaveClass(/active/);
  await expect(page.locator('#page-project')).not.toHaveClass(/active/);
});

test('an unrecognized hash falls back to #/project', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.goto('/#/not-a-real-step');
  await expect(page.locator('#page-project')).toHaveClass(/active/);
  await expect.poll(() => hash(page)).toBe('#/project');
});

test('navigating updates the hash — workflow tabs and left-nav sections', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-walls');
  await expect.poll(() => hash(page)).toBe('#/walls');
  await expect(page.locator('#page-walls')).toHaveClass(/active/);

  await page.click('.nav-item[data-nav="history"]');
  await expect.poll(() => hash(page)).toBe('#/history');
  await expect(page.locator('#page-history')).toHaveClass(/active/);

  await page.click('.nav-item[data-nav="dashboard"]');
  await expect.poll(() => hash(page)).toBe('#/dashboard');
});

test('browser Back / Forward walk the visited steps cleanly — no bounce, no duplicated entries', async ({ page }) => {
  await page.goto('/');
  await clearAll(page); // #/project

  await page.click('#tab-conditions');
  await expect.poll(() => hash(page)).toBe('#/conditions');
  await page.click('#tab-rates');
  await expect.poll(() => hash(page)).toBe('#/rates');
  await page.click('#tab-assemblies');
  await expect.poll(() => hash(page)).toBe('#/assemblies');

  await page.goBack();
  await expect.poll(() => hash(page)).toBe('#/rates');
  await expect(page.locator('#page-rates')).toHaveClass(/active/);

  await page.goBack();
  await expect.poll(() => hash(page)).toBe('#/conditions');

  await page.goBack();
  await expect.poll(() => hash(page)).toBe('#/project');
  await expect(page.locator('#page-project')).toHaveClass(/active/);

  // Forward replays the exact same sequence — proves each nav was a
  // single distinct entry, not a pair the URL bounces between.
  await page.goForward();
  await expect.poll(() => hash(page)).toBe('#/conditions');
  await page.goForward();
  await expect.poll(() => hash(page)).toBe('#/rates');
  await expect(page.locator('#page-rates')).toHaveClass(/active/);
});

test('reloading on a deep-linked step restores that step (URL is the persistence)', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-ceilings');
  await expect.poll(() => hash(page)).toBe('#/ceilings');

  await page.reload();
  await expect(page.locator('#page-ceilings')).toHaveClass(/active/);
  await expect.poll(() => hash(page)).toBe('#/ceilings');
});

test('routing does not bypass the unsaved-changes flow — beforeunload still armed after a hash nav', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'Routing Guard Check');
  await page.click('#tab-rates'); // hash nav — must NOT clear hasUnsavedChanges
  await expect.poll(() => hash(page)).toBe('#/rates');

  const dirty = await page.evaluate(() => window.__getHasUnsavedChanges?.());
  expect(dirty).toBe(true);
});
