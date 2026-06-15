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

  // Persist as the current bid so resumeFromStorage() restores it on reload
  localStorage.setItem('dirigo_current_bid', JSON.stringify(seed.project_state));

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
  localStorage.removeItem('dirigo_current_bid');
  // 'dirigo_api_key' is intentionally preserved
  location.reload();
}
