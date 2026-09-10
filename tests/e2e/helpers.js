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
  // "load" and no navigation is yet in flight.
  //
  // Phase C: page.waitForNavigation() also resolves on SPA History API
  // calls (pushState/replaceState), which the new hash router fires on
  // navigation — so it could return on a stray history call instead of
  // the real document reload, letting the next test line run against a
  // page that's about to reload out from under it. Instead, stamp the
  // current window and wait for that stamp to be gone — only a genuine
  // full-document reload clears it.
  await page.evaluate(() => { window.__preClearReload = true; });
  await page.click('button:has-text("Clear all data")');
  await page.waitForFunction(() => !window.__preClearReload);
  await page.waitForLoadState('load');
  // Home-launcher brief: cold load now lands on the Home launcher, not
  // the workflow. Nearly every spec calls clearAll() and then immediately
  // touches a workflow selector, so restore the pre-brief guarantee here —
  // navigate into the workflow (Project tab) via the window.goto bridge.
  // Specs that want the Home screen navigate to it explicitly.
  //
  // window.goto is registered by AppShell's mount effect (src/state/
  // bridges.js) — after the `load` event, not before it — so wait for it
  // rather than a `window.goto && …` guard that silently no-ops if the
  // bridge isn't up yet. (js/tabs.js used to declare an early classic-
  // script window.goto; it was removed in the A2 close-out.)
  await page.waitForFunction(() => typeof window.goto === 'function');
  await page.evaluate(() => window.goto('project'));
  await page.locator('#page-project').waitFor({ state: 'visible' });
}

export async function loadSeed(page) {
  await page.click('button:text-is("Load Demo")');
}
