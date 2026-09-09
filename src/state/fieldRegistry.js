// ─────────────────────────────────────────────────────────────────────
// fieldRegistry.js — one declared destination per bid field.
//
// Every leaf of initialState.bid (store.jsx) has an entry here saying
// what consumes it TODAY:
//
//   calculator    — read by js/calculator.js's cost pipeline
//   agent         — reaches the bid-agent payload (js/agent-payload.js)
//   both          — calculator AND agent
//   display-only   — deliberately not fed anywhere; shown/held, not computed
//   unresolved     — SHOULD feed something, isn't wired yet (not the same
//                    as display-only — see the note above project.floors)
//
// Optional `knownGap: true` (valid only on calculator/both entries):
// the field's intended home is the calculator but it isn't wired there
// yet. tests/unit/fieldRegistry.test.js runs the calculator-consumption
// check for these under it.fails(), so the suite stays green while the
// gap stays visible; wiring the field later flips that test red until
// knownGap is removed. See docs/dirigo-ux-decisions.md §9.9 + the
// follow-up wiring audit.
//
// Optional `calcToken: '<token>'` — the substring the calculator-
// consumption check greps for, when the field's own last path segment
// isn't what appears in calculator.js (e.g. a walls/ceilings row
// quantity is consumed as the derived `netSF`, not by its raw name).
//
// This file is enforced: a new leaf in initialState.bid with no entry
// here fails tests/unit/fieldRegistry.test.js. Add the entry in the
// same PR that adds the field (CLAUDE.md, "New bid-field rule").
// ─────────────────────────────────────────────────────────────────────

// Sub-trees walked as a SINGLE leaf, not descended into — price maps
// keyed by an enum (stud size / board type / finish level) are one
// field conceptually, not N.
export const LEAF_SUBTREES = new Set([
  'rates.finish',
  'rates.stud',
  'rates.board',
  'rateEscalation.stud',
  'rateEscalation.board',
]);

// Bookkeeping sub-trees that are not bid *input* fields — an id
// allocator and the manual tab-confirmation review state. Persisted on
// the draft record, but nothing "consumes" them in the sense this
// registry tracks. Not walked, not registered.
export const EXCLUDED_SUBTREES = new Set([
  'asmCounter',
  'tabConfirmations',
]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Deep-walk a plain-object shape, yielding leaf dot-paths.
//   - keys starting with `_` are skipped (React-reconciliation
//     bookkeeping like _key / _num on row shapes)
//   - a path in EXCLUDED_SUBTREES is skipped entirely
//   - a path in LEAF_SUBTREES is yielded as one leaf, not descended
//   - an array is walked via its first element's shape, with NO index
//     in the path (`assemblies.studSize`, registered once, not per row);
//     an array of primitives (project.scope) is itself one leaf
export function* walkLeafPaths(obj, prefix = '') {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('_')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (EXCLUDED_SUBTREES.has(path)) continue;
    if (LEAF_SUBTREES.has(path)) {
      yield path;
      continue;
    }
    const val = obj[key];
    if (Array.isArray(val)) {
      if (isPlainObject(val[0])) {
        yield* walkLeafPaths(val[0], path);
      } else {
        yield path;
      }
    } else if (isPlainObject(val)) {
      yield* walkLeafPaths(val, path);
    } else {
      yield path;
    }
  }
}

// The grep token for the calculator-consumption check.
export function calcTokenFor(path, entry) {
  return (entry && entry.calcToken) || path.split('.').pop();
}

export const CONSUMED_BY_TAGS = ['calculator', 'agent', 'both', 'display-only', 'unresolved'];

// ── The manifest ────────────────────────────────────────────────────
// Tags reflect TODAY's behavior (per the original wiring audit), except
// where noted: the conditions.* fields not sent today are tagged `agent`
// as intended destination because Part 2 (allowlist → denylist) makes
// that true with no further work.

export const FIELD_REGISTRY = {
  // ── project ──────────────────────────────────────────────────────
  'project.name':          { consumedBy: 'agent' },   // payload.project.name today
  'project.gc':            { consumedBy: 'agent' },
  'project.bidDate':       { consumedBy: 'agent' },
  'project.address':       { consumedBy: 'display-only' }, // reference-only by design
  'project.buildingType':  { consumedBy: 'agent' },
  'project.drawingsRef':   { consumedBy: 'display-only' }, // reference-only by design
  'project.startDate':     { consumedBy: 'agent' },
  // calculator.js reads conditions.durationWeeks (liftWeeks); collectFormData()
  // copies proj-dur into its conditions slice, so it also reaches the agent.
  'project.durationWeeks': { consumedBy: 'both', calcToken: 'durationWeeks' },
  // Already reaches the agent — payload.project is sent whole
  // (js/agent-payload.js, empty denylist) and floors is a key on it
  // (js/state.js collectFormData). The old 'unresolved' tag was stale.
  'project.floors':        { consumedBy: 'agent' },
  'project.scope':         { consumedBy: 'agent' },   // risk-relevant: what's in/out of the bid
  'project.exclusions':    { consumedBy: 'agent' },   // live once Part 2 ships

  // ── conditions ───────────────────────────────────────────────────
  'conditions.maxHt':            { consumedBy: 'agent' },
  'conditions.sfAbove12':        { consumedBy: 'both' },        // calculateLogistics + sent today
  'conditions.sfAbove20':        { consumedBy: 'both', knownGap: true }, // sent today; calc never multiplies by adder20Pct
  'conditions.curvedWalls':      { consumedBy: 'agent' },
  'conditions.curvedWallsLF':    { consumedBy: 'agent' },
  'conditions.exteriorExposure': { consumedBy: 'agent' },
  'conditions.phasedWork':       { consumedBy: 'agent' },
  'conditions.phaseCount':       { consumedBy: 'agent' },
  'conditions.accessDifficulty': { consumedBy: 'agent' },
  'conditions.parking':          { consumedBy: 'agent' },
  'conditions.wastePct':         { consumedBy: 'both' },        // board-material waste mult + sent today
  'conditions.trips':            { consumedBy: 'calculator' },  // deliveryCost; not in today's hand-picked payload
  'conditions.confidence':       { consumedBy: 'agent' },
  'conditions.notes':            { consumedBy: 'agent' },

  // ── intelligence (payload.intelligence = state.intelligence, whole) ──
  'intelligence.crewAvailability':   { consumedBy: 'agent' },
  'intelligence.pipelinePressure':   { consumedBy: 'agent' },
  'intelligence.materialTrend':      { consumedBy: 'agent' },
  'intelligence.gcRelationship':     { consumedBy: 'agent' },
  'intelligence.gcPriceSensitivity': { consumedBy: 'agent' },
  'intelligence.competitionLevel':   { consumedBy: 'agent' },
  'intelligence.knownCompetitors':   { consumedBy: 'agent' },
  'intelligence.dirigoEdge':         { consumedBy: 'agent' },

  // ── rates ────────────────────────────────────────────────────────
  'rates.framing':    { consumedBy: 'calculator' },
  'rates.hanging':     { consumedBy: 'calculator' },
  'rates.extwall':     { consumedBy: 'calculator' }, // swaps in for rates.hanging on Exterior-flagged wall assemblies
  'rates.burdenPct':   { consumedBy: 'calculator' }, // applyLaborBurden() via buildCostSummary()
  'rates.superPct':    { consumedBy: 'calculator' }, // applyLaborBurden() via buildCostSummary()
  'rates.finish':      { consumedBy: 'calculator' }, // LEAF_SUBTREE — rates.finish[level]
  'rates.adder12Pct':  { consumedBy: 'calculator', knownGap: true }, // captured, never applied
  'rates.adder20Pct':  { consumedBy: 'calculator', knownGap: true }, // captured, never applied
  'rates.stud':        { consumedBy: 'calculator' }, // LEAF_SUBTREE
  'rates.board':       { consumedBy: 'calculator' }, // LEAF_SUBTREE
  'rates.tape':        { consumedBy: 'calculator' },
  'rates.insul':       { consumedBy: 'calculator' },
  'rates.fasten':      { consumedBy: 'calculator' },
  'rates.delivery':    { consumedBy: 'calculator' },
  'rates.disposal':    { consumedBy: 'calculator' }, // calculateLogistics: disposalMonths * rate
  'rates.lift':        { consumedBy: 'calculator' },

  // ── rateEscalation (applyRateEscalation) ─────────────────────────
  'rateEscalation.stud':   { consumedBy: 'calculator' }, // LEAF_SUBTREE
  'rateEscalation.board':  { consumedBy: 'calculator' }, // LEAF_SUBTREE
  'rateEscalation.tape':   { consumedBy: 'calculator' },
  'rateEscalation.insul':  { consumedBy: 'calculator' },
  'rateEscalation.fasten': { consumedBy: 'calculator' },

  // ── assemblies (row shape — registered once per field, not per row) ──
  // 2026-09-08: the whole assemblies/walls/ceilings row shape now goes to
  // the agent verbatim (js/agent-payload.js maps each array through omit()
  // with only a `_key`/`_num` denylist). Fields the cost math actually
  // reads are `both`; fields the agent reads but calculator.js never
  // touches (category, fireRating, notes, soffitLF) are `agent` — tagging
  // those `both` would fail the calculator-consumption grep in
  // fieldRegistry.test.js and misrepresent what the calculator uses. The
  // stud-spacing field was removed outright (not reclassified).
  'assemblies.id':              { consumedBy: 'both' }, // asmMap key
  // Drives the W/C Type-ID prefix auto-fill for that row (AssembliesPage
  // handleCategoryChange); calculator.js never reads it, agent now does.
  'assemblies.category':        { consumedBy: 'agent' },
  'assemblies.studSize':        { consumedBy: 'both' },
  'assemblies.layers':          { consumedBy: 'both' },
  'assemblies.boardType':       { consumedBy: 'both' },
  // Captured and sent to the agent; still not in any cost formula.
  'assemblies.fireRating':      { consumedBy: 'agent' },
  'assemblies.acoustic':        { consumedBy: 'both' },
  'assemblies.finishLevel':     { consumedBy: 'both' },
  // Yes/No, Wall assemblies only. 'Yes' makes calculateWallCosts() use
  // rates.extwall instead of rates.hanging. Sent to the agent as part of
  // the whole assemblies row now (superseding the earlier "not sent
  // individually" call — the job-level conditions.exteriorExposure signal
  // still covers the job-wide read).
  'assemblies.exteriorWall':    { consumedBy: 'both' },
  'assemblies.notes':           { consumedBy: 'agent' }, // free-text, agent-only
  'assemblies.wastePctOverride': { consumedBy: 'both' },

  // ── walls (row shape) — quantities are consumed as the derived netSF ──
  'walls.location':  { consumedBy: 'both' },
  'walls.typeId':    { consumedBy: 'both' },
  'walls.height':    { consumedBy: 'both', calcToken: 'netSF' }, // dimensions-mode grossSF input
  'walls.lf':        { consumedBy: 'both' },
  'walls.grossSF':   { consumedBy: 'both', calcToken: 'netSF' },
  'walls.openings':  { consumedBy: 'both', calcToken: 'netSF' },

  // ── ceilings (row shape) ─────────────────────────────────────────
  'ceilings.location':  { consumedBy: 'both' },
  'ceilings.typeId':    { consumedBy: 'both' },
  'ceilings.height':    { consumedBy: 'both', calcToken: 'netSF' },
  'ceilings.grossSF':   { consumedBy: 'both', calcToken: 'netSF' },
  'ceilings.soffitLF':  { consumedBy: 'agent' }, // captured + sent; never costed
  'ceilings.openings':  { consumedBy: 'both', calcToken: 'netSF' },

  // ── page-level toggles ───────────────────────────────────────────
  'wallsMode':    { consumedBy: 'display-only' }, // column-visibility control; calculator never sees the mode
  'ceilingsMode': { consumedBy: 'display-only' },

  // ── markupInputs (applyMarkup) ───────────────────────────────────
  'markupInputs.overheadPct':    { consumedBy: 'calculator' },
  'markupInputs.contingencyPct': { consumedBy: 'calculator' },
  'markupInputs.profitPct':      { consumedBy: 'calculator' },
};
