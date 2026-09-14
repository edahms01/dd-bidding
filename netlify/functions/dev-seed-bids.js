// ─────────────────────────────────────────────────────────────────────
// dev-seed-bids.js — Netlify Function: dev-only seed loader (Migration
// Phase 2, Step 2A). Writes each seed bid as its own Blobs record,
// keyed by its own bid_id, matching bids.js's restructured per-record
// storage — this is the one place seed data's own bid_ids (seed-1..
// seed-5, per data/seed.json) are meant to survive intact, id-generation
// entirely bypassed same as before. Wholesale-replaces: any pre-existing
// per-bid records are deleted first, so a repeat seed load never
// accumulates orphan records the old single-key overwrite never had to
// worry about — matches the established "Load Demo replaces, never
// appends" convention (CLAUDE.md, Phase C Step 4, applied to drafts).
// Kept as its own function rather than an overload on bids.js's POST so
// that endpoint's CRUD contract stays clean. Dev/demo tool only —
// called by data/seed.js's loadSeedData(), same as before Phase 3.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { readAllRecords } = require('./lib/blob-collection.js');
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
    const bids  = JSON.parse(event.body || '[]');
    const store = getStore(STORE_NAME);

    // Wipe any pre-existing per-bid records first (wholesale replace).
    const existing = await readAllRecords(store);
    await Promise.all(Object.keys(existing).map((key) => store.delete(key)));

    // Write each seed bid as its own record, keyed by its own bid_id.
    await Promise.all(bids.map((b) => store.setJSON(b.bid_id, b)));

    return { statusCode: 200, body: JSON.stringify(bids) };
  } catch (err) {
    logError('dev-seed-bids', {}, err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
