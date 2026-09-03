// ─────────────────────────────────────────────────────────────────────
// data/seed.js — Demo / test seed loader
// Loads seed.json (Harborview Plaza retail project + 5 bid history
// records) into the app for demos, testing, and screenshots.
//
// loadSeedData()  — "Load Demo" dev-toolbar button (offline agent).
// loadDemoLive()  — "Load Demo — live agent" button: identical seed data,
//                   but calls the real Anthropic-backed bid agent so the
//                   live connection can be exercised. confirm()-gated.
// clearSeedData() — "Clear all data" dev-toolbar button.
//
// Dual demo mode: only the agent connection differs between the two load
// buttons. The choice is load-time and session-only — never persisted to
// the bid record or drafts (see js/agent.js's liveAgentMode).
// ─────────────────────────────────────────────────────────────────────

// Kept as the public name — the offline "Load Demo" button's onclick, the
// e2e helpers, and several specs call window.loadSeedData() directly.
async function loadSeedData() {
  return _loadDemo({ live: false });
}

async function loadDemoLive() {
  const ok = confirm(
    'Load Demo with the LIVE agent?\n\n' +
    'This calls the real Anthropic API through the server: it makes a ' +
    'billable request, can take several seconds, and may fail on a bad ' +
    'API key, network issue, or rate limit.\n\n' +
    'The plain "Load Demo" button uses the offline canned response and ' +
    'does none of that.'
  );
  if (!ok) return;
  return _loadDemo({ live: true });
}

async function _loadDemo({ live }) {
  // Flip (or clear) the session-only live-agent override before any
  // calculation kicks off. An offline "Load Demo" always resets it to
  // false, so a prior live session doesn't leak into the next load.
  if (typeof window !== 'undefined' && window.__setLiveAgentMode) {
    window.__setLiveAgentMode(live);
  }

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
  // restores it on reload — same as any other draft (Phase 2; dirigo_current_bid
  // is retired).
  //
  // Phase C 2.5: the drafts map is replaced, not appended to. "Load seed
  // data" is a demo reset (it already replaces bid history wholesale via
  // dev-seed-bids, and clearSeedData() removes dirigo_drafts entirely) —
  // appending left the blank starter draft that boot always creates
  // orphaned in the list. Harmless when Dashboard and Bid History were
  // separate screens; the unified Bids list (BidsPage.jsx) shows every
  // draft, so that phantom "Untitled bid" was visible on every seed load.
  const id  = _generateDraftId();
  const now = new Date().toISOString();
  const drafts = {};
  drafts[id] = buildDraftRecord(seed.project_state, id, now, now);
  _saveDraftsMap(drafts);
  setActiveDraftId(id);
  _resetAgentCache(); // loading a demo over an existing session shouldn't leak Tab 8's prior cached result

  if (live) {
    // Live path: numbers only, then a SINGLE agent pre-run below.
    // runCalculation() would itself launch the agent (_launchBidAgent),
    // and the +500ms runAgentIfNeeded() launches it again — two calls,
    // harmless for the canned response but two billed calls for live.
    calculateOnly();
  } else {
    runCalculation();
  }
  goto('output');

  if (live) _demoToolbarNote('Calling live agent…', 'pending');

  // Pre-run agent — Tab 8 ready without clicking through Tab 7.
  setTimeout(() => {
    Promise.resolve(runAgentIfNeeded()).then(result => {
      if (!live) { _demoToolbarNote('Demo loaded ✓', 'ok'); return; }
      if (result && result._liveError) {
        _demoToolbarNote('Live agent call failed: ' + result._liveError, 'err');
        alert('The live bid-agent call failed:\n\n' + result._liveError +
              '\n\nThe Bid Strategy tab shows the "agent unavailable" state: ' +
              'no recommendation was generated. Use "Load Demo" for the offline response.');
      } else {
        _demoToolbarNote('Live agent responded ✓', 'ok');
      }
    }).catch(e => {
      if (live) {
        _demoToolbarNote('Live agent call failed: ' + (e && e.message || 'unknown error'), 'err');
      }
    });
  }, 500);

  if (!live) _demoToolbarNote('Demo loaded ✓', 'ok');
}

// One transient status line in the dev toolbar. Replaces any prior note
// so "Calling live agent…" becomes the result rather than stacking.
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
  // Bid history now lives server-side (Phase 3) — clear it via the
  // dev-only function and WAIT for that to resolve before reloading, or
  // a slow/failed clear could lose the race with location.reload() below
  // and the page would come back showing stale bid history.
  try {
    const res = await fetch('/.netlify/functions/dev-clear-bids', { method: 'POST' });
    if (!res.ok) throw new Error('dev-clear-bids failed: ' + res.status);
  } catch (e) {
    alert('Failed to clear bid history. Check your connection and try again.');
    return;
  }

  localStorage.removeItem('dirigo_current_bid'); // legacy Phase 1 key — harmless if already absent
  localStorage.removeItem('dirigo_drafts');
  localStorage.removeItem('dirigo_active_draft_id');
  location.reload();
}
