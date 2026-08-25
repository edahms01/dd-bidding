// ─────────────────────────────────────────────────────────────────────
// rate-templates-core.js — Pure logic for the rate-templates Netlify
// Function (Tier 5, Part 1). No @netlify/blobs, no network, no
// `event`/`context` handling — just id/timestamp stamping and array
// filtering, same split as bids-core.js (Phase 3).
//
// Lives in functions/lib/, not functions/ directly, for the same reason
// bids-core.js does — Netlify treats every top-level .js file inside
// netlify/functions/ as its own deployable function; only lib/'s
// siblings (rate-templates.js) are meant to be endpoints.
//
// No update/rename here by design — delete-and-resave is the accepted
// workaround for a first pass (see rate-templates.js header).
// ─────────────────────────────────────────────────────────────────────

// Assigns id/createdAt the same way stampNewBid() assigns bid_id/
// date_submitted, so template records get a consistent shape without
// the caller (rate-templates.js) needing to know the id format.
function stampNewTemplate(name, rates) {
  return {
    id:        'rt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name,
    rates,
    createdAt: new Date().toISOString()
  };
}

// Pure filter — does not mutate templatesArray.
function removeTemplate(templatesArray, id) {
  return templatesArray.filter(t => t.id !== id);
}

// ── EXPORTS (Vitest / Node) ──────────────────────────────────────────
module.exports = {
  stampNewTemplate,
  removeTemplate
};
