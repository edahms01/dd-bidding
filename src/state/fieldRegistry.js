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
  'project.name': {
    consumedBy: 'agent', // payload.project.name today
    label: 'Project name',
    description: 'The name of the job being bid. Identifies this bid in history and on the agent summary.',
    tab: 'project',
  },
  'project.gc': {
    consumedBy: 'agent',
    label: 'General contractor',
    description: 'The general contractor inviting the bid. Used to pull up past history with that GC and to weigh relationship and payment risk.',
    tab: 'project',
  },
  'project.bidDate': {
    consumedBy: 'agent',
    label: 'Bid due date',
    description: 'The date the completed bid is due to the GC. Frames how much time is left to refine the numbers.',
    tab: 'project',
  },
  'project.address': {
    consumedBy: 'display-only', // reference-only by design
    label: 'Project address',
    description: 'Street address of the job site. Kept for the record only; it does not affect pricing.',
    tab: 'project',
  },
  'project.buildingType': {
    consumedBy: 'agent',
    label: 'Building type',
    description: 'The kind of building, such as office, retail, or healthcare. Helps the agent compare this job to similar past work.',
    tab: 'project',
  },
  'project.drawingsRef': {
    consumedBy: 'display-only', // reference-only by design
    label: 'Drawing set reference',
    description: 'Which drawing set and revision the takeoff was done from. Reference only, so a newer revision can be spotted later.',
    tab: 'project',
  },
  'project.startDate': {
    consumedBy: 'agent',
    label: 'Estimated start date',
    description: 'When work is expected to begin on site. Feeds the season and schedule-risk read.',
    tab: 'project',
  },
  // calculator.js reads conditions.durationWeeks (liftWeeks); collectFormData()
  // copies proj-dur into its conditions slice, so it also reaches the agent.
  'project.durationWeeks': {
    consumedBy: 'both',
    label: 'Duration (weeks)',
    description: 'Expected job length in weeks. Drives waste-disposal cost, which is billed per month on site, and the agent schedule read.',
    tab: 'project',
    calcToken: 'durationWeeks',
  },
  // Already reaches the agent — payload.project is sent whole
  // (js/agent-payload.js, empty denylist) and floors is a key on it
  // (js/state.js collectFormData). The old 'unresolved' tag was stale.
  'project.floors': {
    consumedBy: 'agent',
    label: 'Number of floors',
    description: 'How many floors the work covers. A rough measure of job size and how much the work repeats.',
    tab: 'project',
  },
  'project.scope': {
    consumedBy: 'agent', // risk-relevant: what's in/out of the bid
    label: 'Scope inclusions',
    description: 'Which parts of the work are included in this bid, such as metal framing, drywall, or plastering. Tells the agent what is and is not priced.',
    tab: 'project',
  },
  'project.exclusions': {
    consumedBy: 'agent', // live once Part 2 ships
    label: 'Exclusions / notes',
    description: 'A written list of what the bid deliberately leaves out, plus any qualifying notes. Protects against being held to work that was never priced.',
    tab: 'project',
  },

  // ── conditions ───────────────────────────────────────────────────
  'conditions.maxHt': {
    consumedBy: 'agent',
    label: 'Max ceiling height',
    description: 'The tallest ceiling height on the job, in feet. Sets whether high-work adders and lift rental come into play.',
    tab: 'conditions',
  },
  'conditions.sfAbove12': {
    consumedBy: 'both', // calculateLogistics + sent today
    label: 'SF above 12 ft',
    description: 'Square footage of board that sits between 12 and 20 feet up. Priced with a labor uplift and triggers lift rental.',
    tab: 'conditions',
  },
  'conditions.sfAbove20': {
    consumedBy: 'both', // sent today + buildCostSummary() height uplift (>20 ft band, stacked adders)
    label: 'SF above 20 ft',
    description: 'Square footage of board above 20 feet. Priced with a larger labor uplift that stacks on top of the 12-foot one.',
    tab: 'conditions',
  },
  'conditions.curvedWalls': {
    consumedBy: 'agent',
    label: 'Curved walls',
    description: 'Whether the job has any curved wall work. Curved framing and board are slower, so this is flagged to the agent.',
    tab: 'conditions',
  },
  'conditions.curvedWallsLF': {
    consumedBy: 'agent',
    label: 'Curved wall length',
    description: 'Linear feet of curved wall, entered when curved walls is set to yes.',
    tab: 'conditions',
  },
  'conditions.exteriorExposure': {
    consumedBy: 'agent',
    label: 'Exterior exposure',
    description: 'Whether crews will be working exposed to the weather. A job-wide risk signal to the agent, separate from the per-assembly exterior flag.',
    tab: 'conditions',
  },
  'conditions.phasedWork': {
    consumedBy: 'agent',
    label: 'Phased work',
    description: 'Whether the GC is releasing the work in separate phases rather than all at once. Phasing adds remobilization cost and coordination risk.',
    tab: 'conditions',
  },
  'conditions.phaseCount': {
    consumedBy: 'agent',
    label: 'Number of phases',
    description: 'How many separate phases the work is broken into, entered when phased work is set to yes.',
    tab: 'conditions',
  },
  'conditions.accessDifficulty': {
    consumedBy: 'agent',
    label: 'Access difficulty',
    description: 'Whether getting crews and material to the work area is normal or restricted. Restricted access slows production.',
    tab: 'conditions',
  },
  'conditions.parking': {
    consumedBy: 'agent',
    label: 'Parking / unloading',
    description: 'Whether on-site parking and an unloading zone are available or restricted. Affects how much daily labor is lost to hauling material.',
    tab: 'conditions',
  },
  'conditions.wastePct': {
    consumedBy: 'both', // board-material waste mult + sent today
    label: 'Waste factor override',
    description: 'Job-wide extra board material bought to cover offcuts and damage, as a percent. Blank means 10 percent; individual assemblies can override it.',
    tab: 'conditions',
  },
  'conditions.trips': {
    consumedBy: 'calculator', // deliveryCost; not in today's hand-picked payload
    label: 'Estimated delivery trips',
    description: 'How many material deliveries the job will need. Multiplied by the delivery rate to get delivery cost.',
    tab: 'conditions',
  },
  'conditions.confidence': {
    consumedBy: 'agent',
    label: 'Estimator confidence',
    description: 'How sure the estimator is about the takeoff overall: high, medium, or low. Signals to the pricing agent how much risk buffer the bid should carry.',
    tab: 'market',
  },
  'conditions.notes': {
    consumedBy: 'agent',
    label: 'Estimator notes',
    description: 'Free-text gut feel: GC history, site concerns, anything not captured in the structured fields. Passed to the agent as context.',
    tab: 'market',
  },

  // ── intelligence (payload.intelligence = state.intelligence, whole) ──
  'intelligence.crewAvailability': {
    consumedBy: 'agent',
    label: 'Crew availability',
    description: "How booked Dirigo's crews are right now. Tight availability pushes the target margin up.",
    tab: 'market',
  },
  'intelligence.pipelinePressure': {
    consumedBy: 'agent',
    label: 'Pipeline pressure',
    description: 'How badly Dirigo needs this job given the rest of the pipeline. A direct signal on how aggressive to price.',
    tab: 'market',
  },
  'intelligence.materialTrend': {
    consumedBy: 'agent',
    label: 'Material price trend',
    description: 'Whether material prices are rising, stable, or falling. A rising trend may warrant rate escalation or more contingency.',
    tab: 'market',
  },
  'intelligence.gcRelationship': {
    consumedBy: 'agent',
    label: 'GC relationship',
    description: 'How strong the working relationship with this GC is. Strong relationships lower payment risk and can justify a tighter margin.',
    tab: 'market',
  },
  'intelligence.gcPriceSensitivity': {
    consumedBy: 'agent',
    label: 'GC price sensitivity',
    description: 'Whether this GC always takes the lowest number or will pay for quality. Sets how much margin the market will bear.',
    tab: 'market',
  },
  'intelligence.competitionLevel': {
    consumedBy: 'agent',
    label: 'Competition level',
    description: 'How many other firms are expected to bid. More competition means a tighter spread between winning and losing.',
    tab: 'market',
  },
  'intelligence.knownCompetitors': {
    consumedBy: 'agent',
    label: 'Known competitors',
    description: 'Names of the other firms expected to bid. Logged for win-rate pattern analysis; not used in the current calculation.',
    tab: 'market',
  },
  'intelligence.dirigoEdge': {
    consumedBy: 'agent',
    label: "Dirigo's edge",
    description: 'The estimator’s read on how well Dirigo fits this job versus competitors. A strong edge supports premium pricing.',
    tab: 'market',
  },

  // ── rates ────────────────────────────────────────────────────────
  'rates.framing': {
    consumedBy: 'calculator',
    label: 'Metal framing rate',
    description: 'Labor price to install metal stud framing, per linear foot, at standard height. Height adders are applied on top automatically.',
    tab: 'rates',
  },
  'rates.hanging': {
    consumedBy: 'calculator',
    label: 'Drywall hanging rate',
    description: 'Labor price to hang gypsum board, per square foot, multiplied by the number of board layers in each assembly.',
    tab: 'rates',
  },
  'rates.extwall': {
    consumedBy: 'calculator', // swaps in for rates.hanging on Exterior-flagged wall assemblies
    label: 'External wall rate',
    description: 'Labor price per square foot that replaces the drywall hanging rate for any wall assembly flagged as exterior.',
    tab: 'rates',
  },
  'rates.burdenPct': {
    consumedBy: 'calculator', // applyLaborBurden() via buildCostSummary()
    label: 'Labor burden %',
    description: 'Payroll taxes, workers comp, and benefits added on top of raw wages, as a percent of labor. Typically 28 to 40 percent.',
    tab: 'rates',
  },
  'rates.superPct': {
    consumedBy: 'calculator', // applyLaborBurden() via buildCostSummary()
    label: 'Supervision %',
    description: 'Foreman cost as a percent of total labor. Typically 6 to 12 percent.',
    tab: 'rates',
  },
  'rates.finish': {
    consumedBy: 'calculator', // LEAF_SUBTREE — rates.finish[level]
    label: 'Taping + finishing rates',
    description: 'Labor price per square foot to tape and finish board, with one rate per finish level, 1 through 5.',
    tab: 'rates',
  },
  'rates.adder12Pct': {
    consumedBy: 'calculator', // buildCostSummary() height uplift (12–20 ft band)
    label: 'Above 12 ft adder %',
    description: 'Extra labor percent applied to board area between 12 and 20 feet up, where a lift is needed.',
    tab: 'rates',
  },
  'rates.adder20Pct': {
    consumedBy: 'calculator', // buildCostSummary() height uplift (>20 ft band, stacked on adder12Pct)
    label: 'Above 20 ft adder %',
    description: 'Extra labor percent applied to board area above 20 feet. Stacks on top of the 12-foot adder.',
    tab: 'rates',
  },
  'rates.stud': {
    consumedBy: 'calculator', // LEAF_SUBTREE
    label: 'Stud + track prices',
    description: 'Material price per linear foot for studs and track, with one price per stud size.',
    tab: 'rates',
  },
  'rates.board': {
    consumedBy: 'calculator', // LEAF_SUBTREE
    label: 'Drywall board prices',
    description: 'Material price per square foot for gypsum board, with one price per board type: standard, Type-X, moisture, or impact.',
    tab: 'rates',
  },
  'rates.tape': {
    consumedBy: 'calculator',
    label: 'Tape + compound rate',
    description: 'Material allowance per finished square foot for joint tape and compound.',
    tab: 'rates',
  },
  'rates.insul': {
    consumedBy: 'calculator',
    label: 'Insulation rate',
    description: 'Material price per square foot for insulation, applied to assemblies with the acoustic flag set.',
    tab: 'rates',
  },
  'rates.fasten': {
    consumedBy: 'calculator',
    label: 'Fasteners + adhesive rate',
    description: 'Flat material allowance per square foot for screws, adhesive, and related fasteners.',
    tab: 'rates',
  },
  'rates.delivery': {
    consumedBy: 'calculator',
    label: 'Delivery rate',
    description: 'Cost per material delivery trip. Multiplied by the estimated number of trips.',
    tab: 'rates',
  },
  'rates.disposal': {
    consumedBy: 'calculator', // calculateLogistics: disposalMonths * rate
    label: 'Waste disposal rate',
    description: 'Dumpster and haul-off cost per month on site. Multiplied by the job duration in whole months.',
    tab: 'rates',
  },
  'rates.lift': {
    consumedBy: 'calculator',
    label: 'Lift rental rate',
    description: 'Rental cost per week for a lift. Only charged when there is board area above 12 feet.',
    tab: 'rates',
  },

  // ── rateEscalation (applyRateEscalation) ─────────────────────────
  'rateEscalation.stud': {
    consumedBy: 'calculator', // LEAF_SUBTREE
    label: 'Stud price escalation %',
    description: 'Expected price increase over the life of the job for studs and track, per stud size, added on top of the base material price.',
    tab: 'rates',
  },
  'rateEscalation.board': {
    consumedBy: 'calculator', // LEAF_SUBTREE
    label: 'Board price escalation %',
    description: 'Expected price increase over the life of the job for gypsum board, per board type.',
    tab: 'rates',
  },
  'rateEscalation.tape': {
    consumedBy: 'calculator',
    label: 'Tape + compound escalation %',
    description: 'Expected price increase over the life of the job for tape and compound.',
    tab: 'rates',
  },
  'rateEscalation.insul': {
    consumedBy: 'calculator',
    label: 'Insulation escalation %',
    description: 'Expected price increase over the life of the job for insulation.',
    tab: 'rates',
  },
  'rateEscalation.fasten': {
    consumedBy: 'calculator',
    label: 'Fasteners escalation %',
    description: 'Expected price increase over the life of the job for fasteners and adhesive.',
    tab: 'rates',
  },

  // ── assemblies (row shape — registered once per field, not per row) ──
  // 2026-09-08: the whole assemblies/walls/ceilings row shape now goes to
  // the agent verbatim (js/agent-payload.js maps each array through omit()
  // with only a `_key`/`_num` denylist). Fields the cost math actually
  // reads are `both`; fields the agent reads but calculator.js never
  // touches (category, fireRating, notes, soffitLF) are `agent` — tagging
  // those `both` would fail the calculator-consumption grep in
  // fieldRegistry.test.js and misrepresent what the calculator uses. The
  // stud-spacing field was removed outright (not reclassified).
  'assemblies.id': {
    consumedBy: 'both', // asmMap key
    label: 'Assembly type ID',
    description: 'Short code for this wall or ceiling system, like W1 or C2. Each wall and ceiling row references it to pull in the assembly makeup.',
    tab: 'assemblies',
  },
  // Drives the W/C Type-ID prefix auto-fill for that row (AssembliesPage
  // handleCategoryChange); calculator.js never reads it, agent now does.
  'assemblies.category': {
    consumedBy: 'agent',
    label: 'Category',
    description: 'Whether this assembly is a wall or a ceiling. Sets which takeoff table references it and drives the auto-generated type ID.',
    tab: 'assemblies',
  },
  'assemblies.studSize': {
    consumedBy: 'both',
    label: 'Stud size',
    description: 'Width of the metal studs in this assembly. Picks the matching stud material price.',
    tab: 'assemblies',
  },
  'assemblies.layers': {
    consumedBy: 'both',
    label: 'Board layers',
    description: 'How many layers of gypsum board per face. Multiplies the hanging labor and the board material for this assembly.',
    tab: 'assemblies',
  },
  'assemblies.boardType': {
    consumedBy: 'both',
    label: 'Board type',
    description: 'The kind of gypsum board: standard, Type-X, moisture, or impact. Picks the matching board material price.',
    tab: 'assemblies',
  },
  // Captured and sent to the agent; still not in any cost formula.
  'assemblies.fireRating': {
    consumedBy: 'agent',
    label: 'Fire rating',
    description: 'The fire-resistance rating of this assembly. Captured for the record and the agent; not currently used in a cost formula.',
    tab: 'assemblies',
  },
  'assemblies.acoustic': {
    consumedBy: 'both',
    label: 'Acoustic',
    description: 'Whether this assembly carries acoustic insulation. When set to yes, adds insulation material cost (net square footage times the insulation rate); no labor is added.',
    tab: 'assemblies',
  },
  'assemblies.finishLevel': {
    consumedBy: 'both',
    label: 'Finish level',
    description: 'The finish level, 1 through 5, for this assembly. Picks the matching taping and finishing rate.',
    tab: 'assemblies',
  },
  // Yes/No, Wall assemblies only. 'Yes' makes calculateWallCosts() use
  // rates.extwall instead of rates.hanging. Sent to the agent as part of
  // the whole assemblies row now (superseding the earlier "not sent
  // individually" call — the job-level conditions.exteriorExposure signal
  // still covers the job-wide read).
  'assemblies.exteriorWall': {
    consumedBy: 'both',
    label: 'Exterior wall',
    description: 'Wall assemblies only. When set to yes, this assembly is priced with the external wall rate instead of the drywall hanging rate.',
    tab: 'assemblies',
  },
  'assemblies.notes': {
    consumedBy: 'agent', // free-text, agent-only
    label: 'Notes',
    description: 'Free-text notes about this assembly. Passed to the agent; not costed.',
    tab: 'assemblies',
  },
  'assemblies.wastePctOverride': {
    consumedBy: 'both',
    label: 'Waste % override',
    description: 'A waste percent for this assembly alone, replacing the job-wide waste factor when set.',
    tab: 'assemblies',
  },

  // ── walls (row shape) — quantities are consumed as the derived netSF ──
  'walls.location': {
    consumedBy: 'both',
    label: 'Location',
    description: 'Where this run of wall is: floor, area, or zone. Labels the row; not costed.',
    tab: 'walls',
  },
  'walls.typeId': {
    consumedBy: 'both',
    label: 'Type ID',
    description: 'The assembly type ID this wall run is built from. Pulls in that assembly’s studs, board, layers, and finish.',
    tab: 'walls',
  },
  'walls.height': {
    consumedBy: 'both',
    label: 'Wall height (ft)',
    description: 'Floor-to-ceiling height of the run, in feet. Used with linear feet to work out board area when entering by dimensions.',
    tab: 'walls',
    calcToken: 'netSF', // dimensions-mode grossSF input
  },
  'walls.lf': {
    consumedBy: 'both',
    label: 'LF framing',
    description: 'Linear feet of wall to frame. Drives framing labor and, with height, the board area.',
    tab: 'walls',
  },
  'walls.grossSF': {
    consumedBy: 'both',
    label: 'Gross SF board',
    description: 'Total board square footage for this run before openings are taken out.',
    tab: 'walls',
    calcToken: 'netSF',
  },
  'walls.openings': {
    consumedBy: 'both',
    label: 'Openings (SF)',
    description: 'Square footage of doors and windows to subtract from gross, giving the net board area that gets priced.',
    tab: 'walls',
    calcToken: 'netSF',
  },

  // ── ceilings (row shape) ─────────────────────────────────────────
  'ceilings.location': {
    consumedBy: 'both',
    label: 'Location',
    description: 'Where this ceiling area is: floor, room, or zone. Labels the row; not costed.',
    tab: 'ceilings',
  },
  'ceilings.typeId': {
    consumedBy: 'both',
    label: 'Type ID',
    description: 'The assembly type ID this ceiling area is built from. Pulls in that assembly’s makeup.',
    tab: 'ceilings',
  },
  'ceilings.height': {
    consumedBy: 'both',
    label: 'Ceiling height (ft)',
    description: 'Height of this ceiling above the floor, in feet. Used for high-work adders when entering by dimensions.',
    tab: 'ceilings',
    calcToken: 'netSF',
  },
  'ceilings.grossSF': {
    consumedBy: 'both',
    label: 'Gross SF board',
    description: 'Total ceiling board square footage before openings are taken out.',
    tab: 'ceilings',
    calcToken: 'netSF',
  },
  'ceilings.soffitLF': {
    consumedBy: 'agent', // captured + sent; never costed
    label: 'Soffit LF',
    description: 'Linear feet of soffit or bulkhead around this ceiling. Captured for the agent; not currently costed.',
    tab: 'ceilings',
  },
  'ceilings.openings': {
    consumedBy: 'both',
    label: 'Openings (SF)',
    description: 'Square footage of light fixtures and diffusers to subtract from gross, giving the net ceiling area that gets priced.',
    tab: 'ceilings',
    calcToken: 'netSF',
  },

  // ── page-level toggles ───────────────────────────────────────────
  'wallsMode': {
    consumedBy: 'display-only', // column-visibility control; calculator never sees the mode
    label: 'Wall entry mode',
    description: 'Whether wall quantities are entered by dimensions (height and length) or straight as area. Only changes which columns show, not the price.',
    tab: 'walls',
  },
  'ceilingsMode': {
    consumedBy: 'display-only',
    label: 'Ceiling entry mode',
    description: 'Whether ceiling quantities are entered by dimensions or straight as area. Only changes which columns show, not the price.',
    tab: 'ceilings',
  },

  // ── markupInputs (applyMarkup) ───────────────────────────────────
  'markupInputs.overheadPct': {
    consumedBy: 'calculator',
    label: 'Company overhead %',
    description: 'Office, insurance, and fleet cost added as a percent of direct cost. The first of the three markups that turn cost into price.',
    tab: 'rates',
  },
  'markupInputs.contingencyPct': {
    consumedBy: 'calculator',
    label: 'Risk / contingency %',
    description: 'The estimator’s own buffer for this job, as a percent. Starts blank and is a purely manual judgement call.',
    tab: 'rates',
  },
  'markupInputs.profitPct': {
    consumedBy: 'calculator',
    label: 'Profit margin %',
    description: 'Target profit taken on top of direct cost and overhead. The last markup applied before the bid price.',
    tab: 'rates',
  },
};
