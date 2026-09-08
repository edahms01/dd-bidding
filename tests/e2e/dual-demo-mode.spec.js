import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Dual demo mode — the dev toolbar has two demo-load buttons:
//   "Load Demo"              → offline, canned agent response (DEMO_MODE)
//   "Load Demo (live agent)" → same seed data, real Anthropic call
//
// These tests must NEVER let the live path fire — the Playwright webServer
// runs `netlify dev`, which can reach a real ANTHROPIC_API_KEY. Every
// bid-agent request is intercepted and short-circuited. The live button is
// gated by an in-page DOM modal (ConfirmDialog.jsx / window.__confirm), not
// a native confirm() any more, so the gate is asserted by locating and
// clicking that modal's buttons rather than a page.on('dialog') handler.

test.describe('dual demo mode', () => {
  test('both demo-load buttons exist and the live one is visually distinct', async ({ page }) => {
    await page.goto('/');
    const offline = page.locator('#dev-toolbar button:text-is("Load Demo")');
    const live    = page.locator('#dev-toolbar button:text-is("Load Demo (live agent)")');
    await expect(offline).toBeVisible();
    await expect(live).toBeVisible();
    // The live button carries the caution treatment, the offline one doesn't.
    await expect(live).toHaveClass(/btn-live/);
    await expect(offline).not.toHaveClass(/btn-live/);
    const liveColor    = await live.evaluate(el => getComputedStyle(el).color);
    const offlineColor = await offline.evaluate(el => getComputedStyle(el).color);
    expect(liveColor).not.toBe(offlineColor);
  });

  test('the live button is modal-gated — cancelling makes no API call and leaves demo mode offline', async ({ page }) => {
    let agentHits = 0;
    await page.route('**/.netlify/functions/bid-agent*', route => {
      agentHits++;
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"blocked-by-test"}' });
    });

    await page.goto('/');
    await clearAll(page);
    await page.click('#dev-toolbar button:text-is("Load Demo (live agent)")');

    // An in-page DOM modal, not a native dialog — Playwright can see it.
    const overlay = page.locator('#confirm-dialog-overlay');
    await expect(overlay).toHaveClass(/open/);
    await expect(overlay.locator('[role="alertdialog"]')).toBeVisible();

    await overlay.locator('.modal-footer .btn-ghost').click(); // Cancel
    await expect(overlay).not.toHaveClass(/open/);
    await page.waitForTimeout(1500); // past the 500ms pre-run + margin

    expect(agentHits).toBe(0);
    expect(await page.evaluate(() => window.__getLiveAgentMode())).toBe(false);
  });

  test('confirming the modal fires the live agent call', async ({ page }) => {
    let agentHits = 0;
    await page.route('**/.netlify/functions/bid-agent*', route => {
      agentHits++;
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"blocked-by-test"}' });
    });

    await page.goto('/');
    await clearAll(page);
    await page.click('#dev-toolbar button:text-is("Load Demo (live agent)")');

    const overlay = page.locator('#confirm-dialog-overlay');
    await expect(overlay).toHaveClass(/open/);
    await overlay.locator('.modal-footer .btn-primary').click(); // Continue
    await expect(overlay).not.toHaveClass(/open/);

    // The stubbed 503 endpoint stands in for the billable call — the point
    // is that confirming now actually reaches it, and demo mode flips live.
    await expect.poll(() => agentHits, { timeout: 5000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__getLiveAgentMode())).toBe(true);
  });

  test('offline "Load Demo" loads the seed and never touches the live agent endpoint', async ({ page }) => {
    let agentHits = 0;
    await page.route('**/.netlify/functions/bid-agent*', route => {
      agentHits++;
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"blocked-by-test"}' });
    });

    await page.goto('/');
    await clearAll(page);
    await page.click('#dev-toolbar button:text-is("Load Demo")');
    await page.waitForTimeout(1500);

    await expect(page.locator('#page-output')).toHaveClass(/active/);
    const badge = (await page.locator('.proj-badge span').textContent()).trim();
    expect(badge).not.toBe('');
    expect(badge).not.toBe('New bid');
    expect(agentHits).toBe(0);
    expect(await page.evaluate(() => window.__getLiveAgentMode())).toBe(false);
  });

  test('an offline load clears a prior live-agent session flag', async ({ page }) => {
    await page.goto('/');
    await clearAll(page);
    await page.evaluate(() => window.__setLiveAgentMode(true));
    expect(await page.evaluate(() => window.__getLiveAgentMode())).toBe(true);

    await page.evaluate(() => window.loadSeedData());
    await page.waitForTimeout(1500);

    expect(await page.evaluate(() => window.__getLiveAgentMode())).toBe(false);
  });
});
