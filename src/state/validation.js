// ─────────────────────────────────────────────────────────────────────
// validation.js — 3.1, shared orphan-reference detection. Used by
// AgentPage.jsx (disabling "Finalize bid →"), FinalizeModal.jsx
// (disabling "Confirm + submit"), and WallsPage.jsx/CeilingsPage.jsx
// (the inline per-row warning) — one source of truth so the three
// enforcement/display points can't drift out of sync with each other.
//
// Deliberately narrower than calculator.js's own per-row `error` flag.
// calculateWallCosts()/calculateCeilingCosts() (js/calculator.js) flag
// EVERY row with an unmatched typeId, including a genuinely blank one
// (typeId: '') — exactly what every fresh draft's default starter row
// looks like before the user has touched Walls/Ceilings at all. Reusing
// that flag here would block Finalize on brand-new, still-empty drafts —
// found by direct investigation before shipping (calculateWallCosts()
// is called unconditionally on every row, blank or not), not assumed
// safe. "A reference goes orphaned" (the brief's own phrasing) means a
// row that HAD a real reference that's now invalid — an assembly
// deleted, or an imported/legacy draft carrying a stale one — not a row
// nobody has filled in yet. Blank stays out of scope here, same as it
// always has been (calculator.js already silently zeroes an unmatched
// row's cost regardless of why it's unmatched).
export function isOrphanTypeId(typeId, assemblies) {
  return !!typeId && !(assemblies || []).some((a) => a.id === typeId);
}

export function hasUnresolvedReferences(bid) {
  const walls = bid?.walls || [];
  const ceilings = bid?.ceilings || [];
  const assemblies = bid?.assemblies || [];
  return walls.some((w) => isOrphanTypeId(w.typeId, assemblies)) ||
         ceilings.some((c) => isOrphanTypeId(c.typeId, assemblies));
}
