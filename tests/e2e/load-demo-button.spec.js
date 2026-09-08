import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// The dev toolbar has ONE demo-load button, "Load Demo" (dual-demo mode —
// the old "Load Demo (live agent)" button + confirm modal + liveAgentMode
// override — was removed 2026-09-08). Live-vs-canned is decided entirely by
// js/agent.js's DEMO_MODE (a location.hostname check). Playwright's
// webServer runs `netlify dev` on localhost, where DEMO_MODE resolves true,
// so "Load Demo" must never reach the live bid-agent endpoint. Every
// bid-agent request is intercepted and short-circuited as a guard.

test.describe('Load Demo button', () => {
  test('there is exactly one demo-load button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#dev-toolbar button:text-is("Load Demo")')).toBeVisible();
    await expect(page.locator('#dev-toolbar button:text-is("Load Demo (live agent)")')).toHaveCount(0);
    await expect(page.locator('#dev-toolbar .btn-live')).toHaveCount(0);
  });

  test('"Load Demo" loads the seed and never touches the live agent endpoint', async ({ page }) => {
    let agentHits = 0;
    await page.route('**/.netlify/functions/bid-agent*', route => {
      agentHits++;
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"blocked-by-test"}' });
    });

    await page.goto('/');
    await clearAll(page);
    await page.click('#dev-toolbar button:text-is("Load Demo")');
    await page.waitForTimeout(1500); // past the 500ms pre-run + margin

    await expect(page.locator('#page-output')).toHaveClass(/active/);
    const badge = (await page.locator('.proj-badge span').textContent()).trim();
    expect(badge).not.toBe('');
    expect(badge).not.toBe('New bid');
    expect(agentHits).toBe(0);
  });
});
