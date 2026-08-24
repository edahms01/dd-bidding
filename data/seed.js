// ─────────────────────────────────────────────────────────────────────
// data/seed.js — Demo / test seed loader
// Loads seed.json (Harborview Plaza retail project + 5 bid history
// records) into the app for demos, testing, and screenshots.
//
// loadSeedData()  — called by the dev toolbar "Load seed data" button
// clearSeedData() — called by the dev toolbar "Clear all data" button
//                   NOTE: never clears 'dirigo_api_key'
// ─────────────────────────────────────────────────────────────────────

async function loadSeedData() {
  const seed = await fetch('./data/seed.json').then(r => r.json());

  // Write history via the dev-only seed function to preserve seed bid_ids
  // (bids.js's POST would generate new ones, same reason saveBid() was
  // bypassed here before Phase 3 moved storage server-side).
  try {
    const res = await fetch('/.netlify/functions/dev-seed-bids', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(seed.bid_history)
    });
    if (!res.ok) throw new Error('dev-seed-bids failed: ' + res.status);
  } catch (e) {
    alert('Failed to load seed bid history — check your connection and try again.');
    return;
  }

  // Populate all form fields from project_state
  populateForm(seed.project_state);

  // Wrap it into a draft and make it the active one, so resumeActiveDraft()
  // restores it on reload — same as any other draft (Phase 2; dirigo_current_bid
  // is retired).
  const id  = _generateDraftId();
  const now = new Date().toISOString();
  const drafts = getAllDrafts();
  drafts[id] = buildDraftRecord(seed.project_state, id, now, now);
  _saveDraftsMap(drafts);
  setActiveDraftId(id);
  _resetAgentCache(); // clicking "Load seed data" over an existing session shouldn't leak Tab 8's prior cached result

  // Run the full calculation and navigate to the output tab
  runCalculation();
  goto('output');

  // Pre-run agent for demo — Tab 8 ready without clicking through Tab 7
  setTimeout(() => { runAgentIfNeeded(); }, 500);

  // Brief confirmation message in the toolbar
  const toolbar = document.getElementById('dev-toolbar');
  if (toolbar) {
    const msg = document.createElement('span');
    msg.textContent = 'Seed data loaded ✓';
    msg.style.cssText = 'color:#3abf7a;font-size:11px';
    toolbar.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }
}

async function clearSeedData() {
  // Bid history now lives server-side (Phase 3) — clear it via the
  // dev-only function and WAIT for that to resolve before reloading, or
  // a slow/failed clear could lose the race with location.reload() below
  // and the page would come back showing stale bid history.
  try {
    const res = await fetch('/.netlify/functions/dev-clear-bids', { method: 'POST' });
    if (!res.ok) throw new Error('dev-clear-bids failed: ' + res.status);
  } catch (e) {
    alert('Failed to clear bid history — check your connection and try again.');
    return;
  }

  localStorage.removeItem('dirigo_current_bid'); // legacy Phase 1 key — harmless if already absent
  localStorage.removeItem('dirigo_drafts');
  localStorage.removeItem('dirigo_active_draft_id');
  // 'dirigo_api_key' is intentionally preserved
  location.reload();
}
