#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// audit-stray-drafts.mjs — DRY RUN ONLY. Lists every draft in prod's
// shared drafts store and flags which ones look like the eager-write
// bug's leftovers (PR #90 fixed the bug itself; this cleans up what it
// left behind).
//
// Read-only: a single GET against the real drafts endpoint. No PUT, no
// DELETE, anywhere in this file. Run by hand:
//
//   node scripts/audit-stray-drafts.mjs
//
// Two independent checks per draft:
//   - timestampMatch: createdAt === lastModifiedAt (the eager-write bug
//     always left these equal; any real edit bumps lastModifiedAt later)
//   - contentEmpty: a structural diff against BLANK_DRAFT_GROUND_TRUTH
//     below, restricted to keys present in both objects (schema grew
//     over the life of this app — wallsMode/burdenPct/tabConfirmations/
//     etc. were all added at different times, so an older record
//     genuinely missing a newer key is not itself evidence of content;
//     only a key present in both that holds a *different* value is).
//     A first version of this check compared against src/state/store.jsx's
//     initialState.bid and was wrong — that's the React reducer's shape,
//     not what collectFormData()/num() actually persists (blank numeric
//     fields coerce '' -> 0, and several fields have real non-zero
//     defaults: burdenPct 32, superPct 8, wastePct 10, durationWeeks 1).
//     BLANK_DRAFT_GROUND_TRUTH below was captured directly from a real
//     fresh blank draft's window.collectFormData() output (local
//     netlify dev, current schema) rather than hand-derived, specifically
//     to avoid repeating that mistake.
//
// WOULD-DELETE = both true. FLAGGED-AMBIGUOUS = exactly one true, with
// the actual field diffs printed so a human can judge each one directly
// rather than trust a black-box boolean. Nothing is deleted here.
// ─────────────────────────────────────────────────────────────────────

const DRAFTS_ENDPOINT = 'https://bid-iq.netlify.app/.netlify/functions/drafts';

// Captured 2026-09-21 via a fresh clearAll() + window.collectFormData()
// against local netlify dev on current main (post PR #90). id/createdAt/
// lastModifiedAt/schemaVersion/tabConfirmations are metadata, not
// content — stripped before comparison, not included here.
const BLANK_DRAFT_GROUND_TRUTH = {
  assemblies: [
    { id: 'W1', category: 'Wall', studSize: '1-5/8"', layers: 1, boardType: 'Standard', fireRating: 'None', acoustic: 'No', finishLevel: 1, exteriorWall: 'No', notes: '', wastePctOverride: null }
  ],
  walls: [
    { location: '', typeId: '', height: 0, lf: 0, grossSF: 0, openings: 0, netSF: 0 }
  ],
  ceilings: [
    { location: '', typeId: '', height: 0, grossSF: 0, soffitLF: 0, openings: 0, netSF: 0 }
  ],
  conditions: {
    maxHt: 0, sfAbove12: 0, sfAbove20: 0, curvedWalls: 'no', curvedWallsLF: 0,
    exteriorExposure: 'no', phasedWork: 'no', phaseCount: 0, accessDifficulty: 'normal',
    parking: 'yes', wastePct: 10, trips: 0, confidence: '', durationWeeks: 1, notes: ''
  },
  rates: {
    framing: 0, hanging: 0, extwall: 0, burdenPct: 32, superPct: 8,
    finish: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    adder12Pct: 0, adder20Pct: 0,
    stud: { '1-5/8"': 0, '2-1/2"': 0, '3-5/8"': 0, '4"': 0, '6"': 0 },
    board: { Standard: 0, 'Type-X': 0, Moisture: 0, Impact: 0 },
    tape: 0, insul: 0, fasten: 0, delivery: 0, disposal: 0, lift: 0
  },
  rateEscalation: {
    stud: { '1-5/8"': null, '2-1/2"': null, '3-5/8"': null, '4"': null, '6"': null },
    board: { Standard: null, 'Type-X': null, Moisture: null, Impact: null },
    tape: null, insul: null, fasten: null
  },
  markupInputs: { overheadPct: 0, contingencyPct: 0, profitPct: 0 },
  intelligence: {
    crewAvailability: null, pipelinePressure: null, materialTrend: null, gcRelationship: null,
    gcPriceSensitivity: null, competitionLevel: null, knownCompetitors: null, dirigoEdge: null,
    openDraftCount: 0
  },
  project: {
    name: '', gc: '', buildingType: '', bidDate: '', address: '', drawingsRef: '',
    startDate: '', durationWeeks: 1, floors: 0, scope: ['Metal framing', 'Drywall'], exclusions: ''
  },
  wallsMode: 'dimensions',
  ceilingsMode: 'dimensions'
};

// Keys that are live-computed by collectFormData() (not real user input)
// or pure metadata — never counted as "content" for the emptiness check.
// Mirrors src/state/stepStatus.js's CONDITIONS_EXCLUDE/INTELLIGENCE_EXCLUDE
// plus this script's own metadata fields.
const IGNORE_PATHS = new Set([
  'conditions.durationWeeks',
  'intelligence.openDraftCount'
]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Diffs `record` against `truth`, restricted to keys present in truth.
// A key in truth but absent from record is skipped (schema grew since
// record was created — not evidence either way). A key present in both
// with a different value is a real diff. Arrays are compared by index,
// same skip-if-record-shorter tolerance, since assemblies/walls/ceilings
// can only genuinely differ in length if a real row was added/removed.
function diff(record, truth, path = []) {
  const diffs = [];
  if (Array.isArray(truth)) {
    if (!Array.isArray(record)) {
      diffs.push({ path: path.join('.'), truth, record });
      return diffs;
    }
    if (record.length !== truth.length) {
      diffs.push({ path: path.join('.') + '.length', truth: truth.length, record: record.length });
      return diffs;
    }
    truth.forEach((t, i) => diffs.push(...diff(record[i], t, [...path, i])));
    return diffs;
  }
  if (isPlainObject(truth)) {
    for (const key of Object.keys(truth)) {
      const p = [...path, key];
      if (IGNORE_PATHS.has(p.join('.'))) continue;
      if (record == null || !(key in record)) continue; // schema grew — skip, not a mismatch
      diffs.push(...diff(record[key], truth[key], p));
    }
    return diffs;
  }
  // leaf value
  if (record !== truth) diffs.push({ path: path.join('.'), truth, record });
  return diffs;
}

function contentEmpty(record) {
  return diff(record, BLANK_DRAFT_GROUND_TRUTH).length === 0;
}

function timestampMatch(record) {
  return !!record.createdAt && record.createdAt === record.lastModifiedAt;
}

function printTable(title, rows, showDiffs) {
  console.log(`\n${title} (${rows.length})`);
  console.log('─'.repeat(100));
  if (rows.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(34)} createdAt=${(r.createdAt || '(none)').padEnd(24)} lastModifiedAt=${(r.lastModifiedAt || '(none)').padEnd(24)} timestampMatch=${r.timestampMatch}  contentEmpty=${r.contentEmpty}`
    );
    if (showDiffs && r.diffs && r.diffs.length) {
      for (const d of r.diffs.slice(0, 8)) {
        console.log(`      diff: ${d.path}  record=${JSON.stringify(d.record)}  blank-default=${JSON.stringify(d.truth)}`);
      }
      if (r.diffs.length > 8) console.log(`      ... and ${r.diffs.length - 8} more diffs`);
    }
  }
}

async function main() {
  console.log(`DRY RUN — no writes, no deletes. GET ${DRAFTS_ENDPOINT}\n`);

  const res = await fetch(DRAFTS_ENDPOINT);
  if (!res.ok) {
    console.error(`GET failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const drafts = await res.json();
  const ids = Object.keys(drafts);
  console.log(`Total drafts in store: ${ids.length}`);

  const wouldDelete = [];
  const ambiguous = [];
  const keep = [];

  for (const id of ids) {
    const record = drafts[id];
    const tMatch = timestampMatch(record);
    const diffs = diff(record, BLANK_DRAFT_GROUND_TRUTH);
    const cEmpty = diffs.length === 0;
    const row = { id, createdAt: record.createdAt, lastModifiedAt: record.lastModifiedAt, timestampMatch: tMatch, contentEmpty: cEmpty, diffs };

    if (tMatch && cEmpty) wouldDelete.push(row);
    else if (tMatch || cEmpty) ambiguous.push(row);
    else keep.push(row);
  }

  printTable('WOULD-DELETE (both checks match)', wouldDelete, false);
  printTable('FLAGGED-AMBIGUOUS (exactly one check matches)', ambiguous, true);
  console.log(`\nKEEP (neither check matches): ${keep.length} — not printed individually, real bid data.`);

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`SUMMARY: ${ids.length} total | ${wouldDelete.length} would-delete | ${ambiguous.length} ambiguous | ${keep.length} keep`);
  console.log('No records were deleted. This script only reads.');
}

main().catch((e) => { console.error(e); process.exit(1); });
