import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B interim stopgap (2026-08-28) — not a fix for the underlying
// agent-option display-staleness defect (docs/dirigo-ux-decisions.md
// §9.9, owned by Phase E), just a passive caveat near the Bid options
// cards. Exists because 4.2's reactive calculation is what turned this
// from a dormant inconsistency into an actively misleading one within a
// single session (the rail updates live, the cards don't) — see the
// checkpoint report in CLAUDE.md's Phase B section for how that was
// verified. One line, no interaction, nothing to pin beyond "it's there."
test('the Bid options section shows a stale-inputs caveat above the cards', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-agent');
  await expect(page.locator('text=These options may reflect an earlier version of your inputs.')).toBeVisible();
});
