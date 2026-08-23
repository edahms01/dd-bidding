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

  // Write history directly to preserve seed bid_ids (saveBid() would generate new ones)
  localStorage.setItem('dirigo_bids', JSON.stringify(seed.bid_history));

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

function clearSeedData() {
  localStorage.removeItem('dirigo_bids');
  localStorage.removeItem('dirigo_current_bid'); // legacy Phase 1 key — harmless if already absent
  localStorage.removeItem('dirigo_drafts');
  localStorage.removeItem('dirigo_active_draft_id');
  // 'dirigo_api_key' is intentionally preserved
  location.reload();
}
