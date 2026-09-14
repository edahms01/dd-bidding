// ─────────────────────────────────────────────────────────────────────
// dev-clear-drafts.js — Netlify Function: dev-only drafts clear
// (Migration Phase 2, Step 2B). Empties every per-draft record via
// store.deleteAll() — mirrors dev-clear-bids.js exactly. Called by
// data/seed.js's clearSeedData() and loadSeedData() (wholesale-replace
// before writing the seed draft, matching the established "Load Demo
// replaces, never appends" convention already applied to bids).
//
// Without this, drafts (now a shared server-side store, same as bids)
// would accumulate across every Playwright run and every demo reset —
// found the hard way: local netlify dev's Blobs store is shared across
// an entire test run (single emulator instance), so with no way to
// clear it, one test's drafts leaked into the next, causing widespread
// unrelated-looking failures until traced back to this missing endpoint.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { logError } = require('./lib/log.js');
const { STORE_NAME } = require('./lib/drafts-core.js');

exports.handler = async (event) => {
  // Classic `exports.handler` signature = Blobs' "Lambda compatibility
  // mode" — the environment isn't wired up automatically there, must
  // call this before any getStore() call (see bids.js for how this was
  // confirmed via a real MissingBlobsEnvironmentError against `netlify dev`).
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const store = getStore(STORE_NAME);
    await store.deleteAll(); // creates the store implicitly if it doesn't exist yet
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    logError('dev-clear-drafts', {}, err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
