// ─────────────────────────────────────────────────────────────────────
// history.js — Bid history persistence layer
// localStorage read/write — single swap point for future API migration.
//
// Future: replace these 4 functions with fetch() calls to REST API.
//         Bid record shape is the intended DB schema — no transformation
//         needed on migration.
// ─────────────────────────────────────────────────────────────────────

const BIDS_KEY = 'dirigo_bids';

function saveBid(bidRecord) {
  const bids = getAllBids();
  const record = Object.assign({}, bidRecord, {
    bid_id:         'bid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date_submitted: new Date().toISOString().slice(0, 10)
  });
  bids.unshift(record);
  localStorage.setItem(BIDS_KEY, JSON.stringify(bids));
  return record;
}

function getAllBids() {
  try {
    return JSON.parse(localStorage.getItem(BIDS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function updateBid(bid_id, patch) {
  const bids = getAllBids();
  const idx  = bids.findIndex(b => b.bid_id === bid_id);
  if (idx === -1) return false;
  bids[idx] = Object.assign({}, bids[idx], patch);
  localStorage.setItem(BIDS_KEY, JSON.stringify(bids));
  return true;
}

function deleteBid(bid_id) {
  const bids = getAllBids().filter(b => b.bid_id !== bid_id);
  localStorage.setItem(BIDS_KEY, JSON.stringify(bids));
}

// Returns aggregate history stats for the agent prompt.
// Zeroed object if no bids exist.
function getHistorySummary(gc, buildingType) {
  const bids  = getAllBids();
  const empty = { totalBids: 0, winRate: 0, winsWithThisGC: 0, lossesWithThisGC: 0, winRateByBuildingType: 0, avgCostVariance: null };
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

  return { totalBids: total, winRate, winsWithThisGC: gcWins, lossesWithThisGC: gcLosses, winRateByBuildingType, avgCostVariance };
}
