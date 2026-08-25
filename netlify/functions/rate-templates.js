// ─────────────────────────────────────────────────────────────────────
// rate-templates.js — Netlify Function: rate template CRUD (Tier 5, Part 1)
// Backs js/rate-templates.js's getAllRateTemplates/saveRateTemplate/
// deleteRateTemplate. Single JSON array stored as one Blob (key 'all'),
// same shape and same "single digits, not hundreds" reasoning bids.js
// (Phase 3) and Tier 3's per-assembly waste used — a company will have
// a handful of rate templates, not enough to justify one-blob-per-
// template. All record-shaping logic lives in rate-templates-core.js so
// it's unit-testable without a running function; this file only does
// store I/O and HTTP routing.
//
// No PATCH route — no update/rename this phase. Delete-and-resave under
// a new name is the accepted workaround (see rate-templates-core.js).
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { stampNewTemplate, removeTemplate } = require('./lib/rate-templates-core.js');

const STORE_NAME = 'rate-templates';
const ALL_KEY    = 'all';

// Every response here is dynamic/shared data — same defense-in-depth
// reasoning as bids.js's NO_STORE_HEADERS (see that file for the full
// eventual-consistency investigation this reuses without repeating).
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

async function readTemplates(store) {
  const templates = await store.get(ALL_KEY, { type: 'json' });
  return templates || [];
}

exports.handler = async (event) => {
  // Classic `exports.handler` signature = Blobs' "Lambda compatibility
  // mode" — must run before any getStore() call (see bids.js).
  connectLambda(event);

  const store  = getStore(STORE_NAME);
  const method = event.httpMethod;

  let result;
  try {
    if (method === 'GET') {
      const templates = await readTemplates(store);
      result = { statusCode: 200, body: JSON.stringify(templates) };

    } else if (method === 'POST') {
      const body      = JSON.parse(event.body || '{}');
      const templates = await readTemplates(store);
      const record    = stampNewTemplate(body.name, body.rates);
      templates.unshift(record);
      await store.setJSON(ALL_KEY, templates);
      result = { statusCode: 200, body: JSON.stringify(record) };

    } else if (method === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) {
        result = { statusCode: 400, body: JSON.stringify({ error: 'id query parameter is required' }) };
      } else {
        const templates     = await readTemplates(store);
        const nextTemplates = removeTemplate(templates, id);
        await store.setJSON(ALL_KEY, nextTemplates);
        result = { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

    } else {
      result = { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (err) {
    result = { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }

  result.headers = Object.assign({}, result.headers, NO_STORE_HEADERS);
  return result;
};
