// Shared setup helpers for the Phase 1 e2e specs.
// loadSeedData() and clearSeedData() do very different things — each spec
// should call whichever one it actually needs, never "the dev toolbar"
// generically. Most specs want a clean slate (clearAll); only the
// regression spec wants the prefilled demo project (loadSeed).

export async function clearAll(page) {
  await page.click('button:has-text("Clear all data")');
  await page.waitForLoadState('load');
}

export async function loadSeed(page) {
  await page.click('button:has-text("Load seed data")');
}
