// ─────────────────────────────────────────────────────────────────────
// bid-agent-result.js — Poll endpoint for the async bid-agent flow.
// GET ?id=<jobId> → the job record written by bid-agent-background.js:
//   { status: 'pending' }
//   { status: 'done',  recommendation: {...} }
//   { status: 'error', error: '<message>' }
// One Blobs read, always fast — well under any timeout. An absent record
// (job not written yet, or Blobs' eventual-consistency lag) reads as
// 'pending' so the client keeps polling rather than failing early.
// ─────────────────────────────────────────────────────────────────────

const { connectLambda, getStore } = require('@netlify/blobs');
const { STORE_NAME, isValidJobId, readJob } = require('./lib/bid-agent-jobs.js');

const NO_STORE = { 'Cache-Control': 'no-store' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: NO_STORE, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!isValidJobId(id)) {
    return { statusCode: 400, headers: NO_STORE, body: JSON.stringify({ error: 'a valid `id` query parameter is required' }) };
  }

  connectLambda(event);
  const store = getStore(STORE_NAME);

  try {
    const rec = await readJob(store, id);
    return { statusCode: 200, headers: NO_STORE, body: JSON.stringify(rec || { status: 'pending' }) };
  } catch (err) {
    return { statusCode: 500, headers: NO_STORE, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
