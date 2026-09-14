// ─────────────────────────────────────────────────────────────────────
// dev-clear-bids.js — Netlify Function: dev-only bid history clear
// (Migration Phase 2, Step 2A). Empties every per-bid record via
// store.deleteAll() — matches bids.js's restructured per-record storage
// (was a single-key overwrite to []). Called by data/seed.js's
// clearSeedData() — dev/demo tool only, same role its direct
// localStorage.removeItem() call played before Phase 3.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { logError } = require('./lib/log.js');

const STORE_NAME = 'bids';

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
    logError('dev-clear-bids', {}, err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
