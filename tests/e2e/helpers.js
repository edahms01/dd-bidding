// Shared setup helpers for the Phase 1 e2e specs.
// loadSeedData() and clearSeedData() do very different things — each spec
// should call whichever one it actually needs, never "the dev toolbar"
// generically. Most specs want a clean slate (clearAll); only the
// regression spec wants the prefilled demo project (loadSeed).

export async function clearAll(page) {
  // Phase 3: clearSeedData() is now async — it awaits a fetch to
  // dev-clear-bids before calling location.reload(). A bare click() +
  // waitForLoadState('load') can race ahead of that reload, since
  // waitForLoadState resolves immediately if the page already reads
  // "load" and no navigation is yet in flight. Wrap the click with
  // waitForNavigation so this actually waits for the post-fetch reload.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.click('button:has-text("Clear all data")')
  ]);
}

export async function loadSeed(page) {
  await page.click('button:has-text("Load seed data")');
}
