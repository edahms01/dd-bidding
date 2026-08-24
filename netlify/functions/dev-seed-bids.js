// ─────────────────────────────────────────────────────────────────────
// dev-seed-bids.js — Netlify Function: dev-only seed loader (Phase 3)
// Overwrites the bids Blob directly with a full array, bypassing
// bids.js's id-generation entirely — this is the one place seed data's
// own bid_ids (seed-1..seed-5, per data/seed.json) are meant to survive
// intact. Kept as its own function rather than an overload on bids.js's
// POST so that endpoint's CRUD contract stays clean. Dev/demo tool only
// — called by data/seed.js's loadSeedData(), same as before Phase 3
// when it wrote localStorage directly.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');

const STORE_NAME = 'bids';
const ALL_KEY    = 'all';

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
    const bids = JSON.parse(event.body || '[]');
    const store = getStore(STORE_NAME);
    await store.setJSON(ALL_KEY, bids); // creates the store implicitly if it doesn't exist yet
    return { statusCode: 200, body: JSON.stringify(bids) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
