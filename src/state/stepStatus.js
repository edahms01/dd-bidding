// ─────────────────────────────────────────────────────────────────────
// stepStatus.js — per-tab empty / partial / complete indicators for the
// workflow tab bar (.tab / .tab.partial / .tab.done, rendered in
// AppShell).
//
// MANUAL CONFIRMATION MODEL (replaces the earlier field-presence
// heuristic, which produced a false-green Cost Summary on a blank bid).
// A tab is 'complete' (green) only when the estimator has explicitly
// clicked "Finished with this tab" AND the data hasn't changed since:
//
//   status = tabStatus(ownedSliceJSON(tab, state),
//                      state.bid.tabConfirmations[tab],
//                      tabEligible(tab, state))
//
//   - 'complete' : confirmed && stored snapshot === live slice
//   - 'partial'  : eligible but not confirmed, OR confirmed-then-edited
//   - 'empty'    : the "Finished" button isn't even clickable yet
//
// Editing a confirmed tab reverts it to amber for free — nothing watches
// for the edit, the snapshot just stops matching on the next render.
//
// Bid Strategy ('agent') has no button: agentTabStatus() derives it from
// request state + agentStaleness() (loading -> amber, cached+fresh ->
// green, cached+drifted -> amber, nothing sent -> gray).
//
// Owned slice per tab:
//   project      -> bid.project
//   conditions   -> bid.conditions minus confidence/notes
//   assemblies   -> (ui.output.state ?? bid).assemblies
//   walls        -> (ui.output.state ?? bid).walls
//   ceilings     -> (ui.output.state ?? bid).ceilings
//   rates        -> { rates, rateEscalation, markupInputs }
//   market       -> { confidence, notes, intelligence }
//   output       -> ui.output.summary
//
// Row tabs read ui.output.state (the live collectFormData() snapshot the
// reactive calc keeps ~500ms fresh) rather than bid.{...}, because those
// row fields are uncontrolled and never hit bid state on a keystroke —
// only ui.output.state moves when a row cell is edited. Before the first
// calc ui.output is null and row tabs are 'empty'.
//
// Snapshots are normalize()d (keys sorted, leaves String()-coerced)
// before stringify so a "12" -> 12 change across a save/reload round-trip
// (collectFormData()'s num() coercion) doesn't spuriously break green.
// ─────────────────────────────────────────────────────────────────────
import { agentStaleness } from './agentStaleness.js';

export const GATED_TABS = [
  'project', 'conditions', 'assemblies', 'walls', 'ceilings', 'rates', 'output', 'market'
];

// Site Conditions owns everything in bid.conditions EXCEPT these two,
// which are the price-driving half rendered on Market Read.
const CONDITIONS_EXCLUDE = ['confidence', 'notes'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function omitKeys(obj, keys) {
  const out = {};
  for (const k of Object.keys(obj || {})) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

// A field counts as "filled" if it has been given ANY value. Blank =
// undefined, '' / whitespace, or an empty array. An explicit 0, false,
// or null (a deliberate "not applicable") all count as filled — this is
// the rule most likely to get miscoded as "truthy" instead of "not
// blank", so it's a named predicate, distinct from `filled` below.
export function fieldFilled(v) {
  if (v === null) return true;
  if (v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true; // number (incl. 0), boolean, object
}

// Every leaf of a (possibly nested) plain object is filled. Recurses
// into rates.finish / .stud / .board etc.; arrays are treated as leaves.
export function allLeavesFilled(obj) {
  if (!isPlainObject(obj)) return fieldFilled(obj);
  return Object.values(obj).every((v) => (isPlainObject(v) ? allLeavesFilled(v) : fieldFilled(v)));
}

// Canonical serialization: sort object keys, String()-coerce every leaf,
// so the snapshot is stable across the string<->number drift a
// save/reload round-trip introduces.
export function normalize(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(normalize);
  if (isPlainObject(v)) {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = normalize(v[k]);
    return out;
  }
  return String(v);
}

// ── Row "engaged with" predicates (unchanged from the old heuristic,
// just pointed at ui.output.state now) ──

function filled(v) {
  return v != null && String(v).trim() !== '';
}

// A walls/ceilings row counts as "real" once it carries a Type ID.
function realRows(rows) {
  return (rows || []).filter((r) => filled(r.typeId));
}

// The default starter assembly row (blankAssemblyRow(1) in store.jsx):
// every field except notes/wastePctOverride carries a real
// "first-listed-option" default, so a single untouched row is a valid
// but un-engaged-with assembly. Keep in sync with blankAssemblyRow() if
// its defaults ever change (store.jsx carries the reciprocal note).
const ASM_DEFAULTS = {
  category: 'Wall', studSize: '1-5/8"', spacing: '16"', layers: 1,
  boardType: 'Standard', fireRating: 'None', acoustic: 'No', finishLevel: 1
};

function asmRowIsCustomized(r) {
  if (filled(r.notes)) return true;
  if (r.wastePctOverride != null) return true;
  return Object.keys(ASM_DEFAULTS).some((k) => String(r[k]) !== String(ASM_DEFAULTS[k]));
}

// ── Owned slice + serialization ──

export function rawOwnedSlice(tab, state) {
  const b = (state && state.bid) || {};
  const out = state && state.ui && state.ui.output;
  const rowSrc = (out && out.state) || b;
  switch (tab) {
    case 'project':    return b.project;
    case 'conditions': return omitKeys(b.conditions, CONDITIONS_EXCLUDE);
    case 'assemblies': return rowSrc.assemblies || [];
    case 'walls':      return rowSrc.walls || [];
    case 'ceilings':   return rowSrc.ceilings || [];
    case 'rates':      return { rates: b.rates, rateEscalation: b.rateEscalation, markupInputs: b.markupInputs };
    case 'market':     return { confidence: b.conditions ? b.conditions.confidence : undefined, notes: b.conditions ? b.conditions.notes : undefined, intelligence: b.intelligence };
    case 'output':     return (out && out.summary) || null;
    default:           return null;
  }
}

export function ownedSliceJSON(tab, state) {
  return JSON.stringify(normalize(rawOwnedSlice(tab, state)));
}

// ── Eligibility (when the "Finished" button becomes clickable) ──

export function tabEligible(tab, state) {
  const b = (state && state.bid) || {};
  const out = state && state.ui && state.ui.output;
  const rowSrc = (out && out.state) || b;
  switch (tab) {
    case 'project':
      return allLeavesFilled(b.project);
    case 'conditions':
      return allLeavesFilled(omitKeys(b.conditions, CONDITIONS_EXCLUDE));
    case 'rates':
      return allLeavesFilled(b.rates) && allLeavesFilled(b.markupInputs);
    case 'market':
      return fieldFilled(b.conditions ? b.conditions.confidence : undefined)
        && fieldFilled(b.conditions ? b.conditions.notes : undefined)
        && allLeavesFilled(b.intelligence);
    case 'assemblies': {
      if (!out) return false;
      const rows = rowSrc.assemblies || [];
      return rows.length > 1 || rows.some(asmRowIsCustomized);
    }
    case 'walls':
      return !!out && realRows(rowSrc.walls).length > 0;
    case 'ceilings':
      return !!out && realRows(rowSrc.ceilings).length > 0;
    case 'output':
      return !!out;
    default:
      return false;
  }
}

// ── Status derivation ──

export function tabStatus(liveSliceJSON, confirmation, eligible) {
  const c = confirmation || { confirmed: false, snapshot: null };
  if (c.confirmed && c.snapshot === liveSliceJSON) return 'complete';
  return eligible ? 'partial' : 'empty';
}

export function agentTabStatus(state) {
  const a = (state && state.ui && state.ui.agent) || {};
  if (a.loading) return 'partial';
  if (!a.cachedResult) return 'empty';
  return agentStaleness(state).stale ? 'partial' : 'complete';
}

// Returns { [tabKey]: 'empty' | 'partial' | 'complete' } for all nine
// workflow tabs. Only caller: AppShell's tab bar (+ MarketReadPage's
// Send-to-Agent gate, which reads GATED_TABS off this map).
export function stepStatus(state) {
  const s = state || {};
  const confs = (s.bid && s.bid.tabConfirmations) || {};
  const map = {};
  for (const tab of GATED_TABS) {
    map[tab] = tabStatus(ownedSliceJSON(tab, s), confs[tab], tabEligible(tab, s));
  }
  map.agent = agentTabStatus(s);
  return map;
}
