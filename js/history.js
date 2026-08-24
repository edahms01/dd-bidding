// ─────────────────────────────────────────────────────────────────────
// history.js — Bid history persistence layer
// Phase 3: was localStorage read/write; now a thin fetch() wrapper
// around netlify/functions/bids.js + Netlify Blobs. Parameter shapes
// are unchanged from the localStorage version — only the internals and
// return type (now a Promise) changed, so every call site just needed
// an `await`, not a rewrite. Record shaping (id/date assignment, patch
// merging, delete filtering) now happens server-side in
// netlify/functions/bids-core.js — the old client-side generation logic
// was deleted outright rather than left unused alongside the fetch call.
// ─────────────────────────────────────────────────────────────────────

const BIDS_ENDPOINT = '/.netlify/functions/bids';

// Every call here reads or writes data that must never come from a stale
// cache — cache: 'no-store' on every fetch, paired with the function's own
// Cache-Control: no-store response header (netlify/functions/bids.js), as
// defense in depth alongside the eventual-consistency note on the server
// side. GET is the one that actually matters for that (a stale cached GET
// looks identical to a real consistency lag); the rest are here for the
// same "don't let anything in the chain cache dynamic data" reasoning.

async function saveBid(bidRecord) {
  const res = await fetch(BIDS_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    cache:   'no-store',
    body:    JSON.stringify(bidRecord)
  });
  if (!res.ok) throw new Error('saveBid failed: ' + res.status);
  return res.json();
}

async function getAllBids() {
  const res = await fetch(BIDS_ENDPOINT, { cache: 'no-store' });
  // Deliberately throws rather than falling back to [] the way the old
  // localStorage try/catch did for corrupt JSON — callers (renderHistory()
  // in particular) need to be able to tell "genuinely zero bids" apart
  // from "the request failed" and show a visible error state for the
  // latter, not a silently empty table.
  if (!res.ok) throw new Error('getAllBids failed: ' + res.status);
  return res.json();
}

async function updateBid(bid_id, patch) {
  const res = await fetch(BIDS_ENDPOINT + '?bid_id=' + encodeURIComponent(bid_id), {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    cache:   'no-store',
    body:    JSON.stringify(patch)
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error('updateBid failed: ' + res.status);
  return true;
}

async function deleteBid(bid_id) {
  const res = await fetch(BIDS_ENDPOINT + '?bid_id=' + encodeURIComponent(bid_id), { method: 'DELETE', cache: 'no-store' });
  if (!res.ok) throw new Error('deleteBid failed: ' + res.status);
}

// Returns aggregate history stats for the agent prompt.
// Zeroed object if no bids exist.
async function getHistorySummary(gc, buildingType) {
  const bids  = await getAllBids();
  const empty = {
    totalBids: 0, winRate: 0, winsWithThisGC: 0, lossesWithThisGC: 0, winRateByBuildingType: 0, avgCostVariance: null,
    marginOutcomeCurve: computeMarginOutcomeCurve([]), seasonality: computeSeasonality([])
  };
  if (!bids.length) return empty;

  const total   = bids.length;
  const wins    = bids.filter(b => b.outcome === 'won').length;
  const winRate = Math.round((wins / total) * 100);

  const gcKey    = (gc || '').toLowerCase();
  const gcBids   = gcKey ? bids.filter(b => (b.gc || '').toLowerCase() === gcKey) : [];
  const gcWins   = gcBids.filter(b => b.outcome === 'won').length;
  const gcLosses = gcBids.filter(b => b.outcome === 'lost').length;

  const typeBids  = buildingType ? bids.filter(b => b.building_type === buildingType) : [];
  const typeWins  = typeBids.filter(b => b.outcome === 'won').length;
  const winRateByBuildingType = typeBids.length > 0
    ? Math.round((typeWins / typeBids.length) * 100) : 0;

  const completed       = bids.filter(b => b.outcome === 'won' && b.cost_variance !== null);
  const avgCostVariance = completed.length > 0
    ? Math.round(completed.reduce((s, b) => s + b.cost_variance, 0) / completed.length)
    : null;

  return {
    totalBids: total, winRate, winsWithThisGC: gcWins, lossesWithThisGC: gcLosses, winRateByBuildingType, avgCostVariance,
    marginOutcomeCurve: computeMarginOutcomeCurve(bids), seasonality: computeSeasonality(bids)
  };
}
