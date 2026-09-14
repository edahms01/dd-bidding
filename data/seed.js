// ─────────────────────────────────────────────────────────────────────
// data/seed.js — Demo / test seed loader
// Loads seed.json (Harborview Plaza retail project + 5 bid history
// records) into the app for demos, testing, and screenshots.
//
// loadSeedData()  — "Load Demo" dev-toolbar button.
// clearSeedData() — "Clear all data" dev-toolbar button.
//
// Whether the bid agent runs canned or live is decided entirely by
// js/agent.js's DEMO_MODE (a location.hostname check) — there is no
// load-time override any more (dual-demo mode removed 2026-09-08, once
// DEMO_MODE became environment-driven in PR #50). On production "Load
// Demo" calls the real Anthropic agent; everywhere else it's canned.
// ─────────────────────────────────────────────────────────────────────

// Public name — the "Load Demo" button's onclick, the e2e helpers, and
// several specs call window.loadSeedData() directly.
async function loadSeedData() {
  // Migration Phase 2 Step 2B: boot's own draft-storage settling
  // (_initApp() -> resumeActiveDraft(), forms.js) is now asynchronous —
  // a real network round trip, not an instant synchronous localStorage
  // read. A caller that invokes loadSeedData() immediately after
  // page.goto('/') (some e2e specs do exactly this, with no intervening
  // wait) can otherwise race boot's own resumeActiveDraft(): if it's
  // still in flight when this function's own draft writes below
  // complete, boot finishing LATER can clobber the just-seeded active
  // draft with whatever it independently decided (its own blank-draft
  // fallback). Waiting for boot here closes that window regardless of
  // when the caller invokes this — found via a real, reproduced failure
  // (mobile-layout.spec.js's bid-summary test), not assumed.
  await window.__draftsBootPromise;

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
    alert('Failed to load seed bid history. Check your connection and try again.');
    return;
  }

  // Populate all form fields from project_state
  populateForm(seed.project_state);

  // Wrap it into a draft and make it the active one, so resumeActiveDraft()
  // restores it on reload — same as any other draft.
  //
  // Phase C 2.5 / Migration Phase 2 Step 2B: the drafts store is
  // replaced, not appended to. "Load seed data" is a demo reset (it
  // already replaces bid history wholesale via dev-seed-bids) —
  // appending left the blank starter draft that boot always creates
  // orphaned in the list. Harmless when Dashboard and Bid History were
  // separate screens; the unified Bids list (BidsPage.jsx) shows every
  // draft, so that phantom "Untitled bid" was visible on every seed load.
  // Step 2B: drafts are server-side now (same shared-store shape as
  // bids), so the wholesale-replace needs an explicit wipe first —
  // dev-clear-drafts.js, mirroring dev-clear-bids.js/dev-seed-bids.js's
  // own wipe-then-write pattern.
  const id  = _generateDraftId();
  const now = new Date().toISOString();
  try {
    const clearRes = await fetch('/.netlify/functions/dev-clear-drafts', { method: 'POST' });
    if (!clearRes.ok) throw new Error('dev-clear-drafts failed: ' + clearRes.status);
    // The clear above is a raw fetch, not _deleteDraftRemote() — it
    // doesn't touch _draftsCache (js/forms.js). Reset it explicitly here
    // or the client's in-memory mirror keeps every pre-clear entry
    // (stale, since the server just wiped them all), and _writeDraft()'s
    // merge-spread below would add the new seed draft on top instead of
    // replacing — found via a real openDraftCount mismatch in
    // golden-export-parity.spec.js (server had 1 draft, cache showed 2).
    _draftsCache = {};
    await _writeDraft(id, buildDraftRecord(seed.project_state, id, now, now));
  } catch (e) {
    alert('Failed to load seed draft. Check your connection and try again.');
    return;
  }
  setActiveDraftId(id);
  _resetAgentCache(); // loading a demo over an existing session shouldn't leak Tab 8's prior cached result

  runCalculation();
  goto('output');

  // Pre-run agent — Tab 8 ready without clicking through Tab 7.
  setTimeout(() => {
    // Mark every input tab confirmed (reuses the real SET_TAB_CONFIRMATION
    // path — no demo-only branch in the derivation) so the step bar reads
    // all-green for a demo instead of all-amber. Runs here, after the
    // first calc has flushed state.ui.output (the row tabs snapshot from
    // it). Bid Strategy greens on its own once the agent result lands.
    window.__confirmAllTabsForDemo?.();
    runAgentIfNeeded();
  }, 500);

  _demoToolbarNote('Demo loaded ✓', 'ok');
}

// One transient status line in the dev toolbar.
function _demoToolbarNote(text, kind) {
  const toolbar = document.getElementById('dev-toolbar');
  if (!toolbar) return;
  const prev = toolbar.querySelector('.dev-toolbar-note');
  if (prev) prev.remove();
  const color = kind === 'err' ? '#d16060' : kind === 'pending' ? 'var(--text3)' : '#3abf7a';
  const msg = document.createElement('span');
  msg.className = 'dev-toolbar-note';
  msg.textContent = text;
  msg.style.cssText = 'font-size:11px;color:' + color;
  toolbar.appendChild(msg);
  if (kind !== 'pending') setTimeout(() => { if (msg.isConnected) msg.remove(); }, 6000);
}

async function clearSeedData() {
  // Bid history AND drafts both live server-side now (Phase 3 / Migration
  // Phase 2 Step 2B) — clear both via their dev-only functions and WAIT
  // for both to resolve before reloading, or a slow/failed clear could
  // lose the race with location.reload() below and the page would come
  // back showing stale data.
  try {
    const [bidsRes, draftsRes] = await Promise.all([
      fetch('/.netlify/functions/dev-clear-bids', { method: 'POST' }),
      fetch('/.netlify/functions/dev-clear-drafts', { method: 'POST' })
    ]);
    if (!bidsRes.ok) throw new Error('dev-clear-bids failed: ' + bidsRes.status);
    if (!draftsRes.ok) throw new Error('dev-clear-drafts failed: ' + draftsRes.status);
  } catch (e) {
    alert('Failed to clear data. Check your connection and try again.');
    return;
  }

  localStorage.removeItem('dirigo_current_bid'); // legacy Phase 1 key — harmless if already absent
  // dirigo_drafts no longer holds real data (Step 2B) — just the
  // legacy-migration "already ran" marker. Clearing it resets that
  // marker too, same as a genuine fresh install.
  localStorage.removeItem('dirigo_drafts');
  localStorage.removeItem('dirigo_active_draft_id');
  location.reload();
}
