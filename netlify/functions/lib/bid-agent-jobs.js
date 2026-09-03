// ─────────────────────────────────────────────────────────────────────
// bid-agent-jobs.js — Job records for the async bid-agent flow.
//
// The live bid-agent path can't be a synchronous function: a full
// structured-output Sonnet 4.6 response runs ~40-45s and Netlify's sync
// HTTP path cuts off ~26-30s → 504. So bid-agent-background.js does the
// Anthropic call as a background function and writes the outcome here,
// keyed by a client-supplied job id; the client polls bid-agent-result.js
// until the record is terminal.
//
// Record shapes + store I/O only. The store is injected so this is
// unit-testable without Netlify Blobs (getStore() throws outside a
// function runtime). Same lib/ split as bids-core.js.
// ─────────────────────────────────────────────────────────────────────

const STORE_NAME = 'bid-agent-jobs';

// The client generates the id (crypto.randomUUID with a fallback). Keep
// it to a safe Blobs-key charset and a sane length.
function isValidJobId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{8,128}$/.test(id);
}

function pendingRecord() {
  return { status: 'pending', ts: Date.now() };
}
function doneRecord(recommendation) {
  return { status: 'done', recommendation: recommendation, ts: Date.now() };
}
function errorRecord(message) {
  return { status: 'error', error: String(message || 'unknown error'), ts: Date.now() };
}

// Absent key (never written yet, or Blobs' eventual-consistency lag —
// see bids.js's readBids() note) resolves to null; the caller treats
// that as still-pending, never as an error.
async function readJob(store, id) {
  const rec = await store.get(id, { type: 'json' });
  return rec || null;
}
async function writeJob(store, id, record) {
  await store.setJSON(id, record);
}

module.exports = {
  STORE_NAME,
  isValidJobId,
  pendingRecord,
  doneRecord,
  errorRecord,
  readJob,
  writeJob
};
