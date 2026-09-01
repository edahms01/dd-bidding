// ─────────────────────────────────────────────────────────────────────
// stepStatus.js — Phase C 2.2. Per-step completion state for the tab
// bar's empty / partial / complete indicators (.tab / .tab.partial /
// .tab.done — the .done style was pre-built in css/components.css since
// A1; this is the wiring the decision record called for).
//
// Deliberately lightweight and built ONLY on signals that already
// exist — no new "is this step done" validation was invented:
//   - Rates       -> ui.rateTotals {l,m,x}, the same L/M/X class-sum the
//                    Rates totals bar shows (RatesPage.jsx's
//                    recomputeTotals(), the calc() port). NOT a second
//                    "enough rates entered" check.
//   - Walls/Ceil  -> isOrphanTypeId() from validation.js. A table with
//                    an orphaned Type ID reference must never show a
//                    green checkmark — same misleading-completion family
//                    as the contingency-default / orphan-Rates-input
//                    findings from earlier phases.
//   - Cost Summary -> ui.output (a calc has run) AND no unresolved
//                    references — a total computed against an orphaned
//                    row is wrong, so it shows 'partial', matching the
//                    amber Walls/Ceilings step feeding it.
//   - Bid Strategy -> ui.agent.cachedResult AND no unresolved
//                    references, same reasoning.
//   - Project / Site Conditions -> presence of their few key inputs.
//   - Market Read -> confidence + the two market fields the agent
//                    weighs most (competition level, GC relationship).
//   - Assemblies  -> whether the estimator has actually engaged with the
//                    table (see below) — a self-contained signal, no
//                    reference to downstream steps.
//
// Navigation stays unrestricted (decision record 2.2: show completion,
// don't gate — the only hard block is final submit, which
// hasUnresolvedReferences() already owns). This function is pure and
// display-only.
//
// Returns { [tabKey]: 'empty' | 'partial' | 'complete' } for all nine
// workflow tabs (project, conditions, assemblies, walls, ceilings,
// rates, output, market, agent).
// ─────────────────────────────────────────────────────────────────────
import { isOrphanTypeId, hasUnresolvedReferences } from './validation.js';

function filled(v) {
  return v != null && String(v).trim() !== '';
}

// 'complete' when every key field is filled, 'partial' when some are,
// 'empty' when none are.
function byKeyFields(obj, keys) {
  const n = keys.reduce((acc, k) => acc + (filled(obj?.[k]) ? 1 : 0), 0);
  if (n === 0) return 'empty';
  return n === keys.length ? 'complete' : 'partial';
}

// A walls/ceilings row counts as "real" once it carries a Type ID (the
// bound dropdown). Assemblies are judged differently — see stepStatus().
function realRows(rows) {
  return (rows || []).filter((r) => filled(r.typeId));
}

// The default starter assembly row (blankAssemblyRow(1) in store.jsx):
// every field except `notes`/`wastePctOverride` carries a real
// "first-listed-option" default, so a single untouched row is a valid
// but un-engaged-with assembly. These are the values that mean "the
// estimator hasn't touched this row yet". Keep in sync with
// blankAssemblyRow() if its defaults ever change.
const ASM_DEFAULTS = {
  category: 'Wall', studSize: '1-5/8"', spacing: '16"', layers: 1,
  boardType: 'Standard', fireRating: 'None', acoustic: 'No', finishLevel: 1
};

function asmRowIsCustomized(r) {
  if (filled(r.notes)) return true;
  if (r.wastePctOverride != null) return true;
  return Object.keys(ASM_DEFAULTS).some((k) => String(r[k]) !== String(ASM_DEFAULTS[k]));
}

export function stepStatus(bid, ui) {
  const b = bid || {};
  const u = ui || {};
  const assemblies = b.assemblies || [];
  const orphaned = hasUnresolvedReferences(b);

  // Project — the three fields every downstream view and the bid record
  // actually key on.
  const project = byKeyFields(b.project, ['name', 'gc', 'buildingType']);

  // Site Conditions — the cost-driving numeric inputs. Flags
  // (curvedWalls/exteriorExposure/phasedWork/access/parking) always
  // carry a value, so they carry no signal; confidence/notes render on
  // Market Read now and count there, not here.
  const conditions = byKeyFields(b.conditions, ['maxHt', 'wastePct', 'trips']);

  // Market Read — the price-driving judgement. `confidence` (drives
  // contingency) plus the two intelligence fields the agent leans on
  // most. Spans two slices, so computed inline rather than byKeyFields.
  const marketVals = [b.conditions?.confidence, b.intelligence?.competitionLevel, b.intelligence?.gcRelationship];
  const marketN = marketVals.filter(filled).length;
  const market = marketN === 0 ? 'empty' : marketN === marketVals.length ? 'complete' : 'partial';

  // Rates — the L/M/X totals the Rates bar already computes.
  const rt = u.rateTotals || { l: 0, m: 0, x: 0 };
  const rateBuckets = [rt.l, rt.m, rt.x].filter((v) => v > 0).length;
  const rates = rateBuckets === 0 ? 'empty' : rateBuckets === 3 ? 'complete' : 'partial';

  // Walls / Ceilings — real rows, and none of them orphaned. Orphan =>
  // 'partial', never 'complete', even with many valid rows alongside.
  function takeoffStatus(rows) {
    const real = realRows(rows);
    if (real.length === 0) return 'empty';
    const anyOrphan = real.some((r) => isOrphanTypeId(r.typeId, assemblies));
    return anyOrphan ? 'partial' : 'complete';
  }
  const walls = takeoffStatus(b.walls);
  const ceilings = takeoffStatus(b.ceilings);

  // Assemblies — a self-contained signal, local to this step: has the
  // estimator engaged with the table at all? Every fresh draft has one
  // row pre-filled with valid "first option" defaults, so row presence
  // alone means nothing — but a second row, or any field moved off its
  // default (or a note / waste override), is a real edit. A single
  // untouched default row stays neutral 'empty' rather than claiming a
  // green it can't justify.
  const assembliesStatus = (assemblies.length > 1 || assemblies.some(asmRowIsCustomized))
    ? 'complete'
    : 'empty';

  // Cost Summary — a calculation has produced a result, and it wasn't
  // computed against an unresolved reference (which would make the total
  // wrong). Orphan => 'partial', consistent with the Walls/Ceilings step
  // that feeds it.
  const output = u.output == null ? 'empty' : orphaned ? 'partial' : 'complete';

  // Bid Strategy — same shape: the agent returned something, and it
  // wasn't a recommendation built on an unresolved reference.
  const agentDone = u.agent && u.agent.cachedResult != null;
  const agent = !agentDone ? 'empty' : orphaned ? 'partial' : 'complete';

  return { project, conditions, rates, assemblies: assembliesStatus, walls, ceilings, output, market, agent };
}
