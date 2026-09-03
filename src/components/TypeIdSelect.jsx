// ─────────────────────────────────────────────────────────────────────
// TypeIdSelect.jsx — 3.1, Type ID dropdown bound to Assemblies. Replaces
// the free-text typeId <input> in WallRow/CeilRow with a real <select>
// populated live from state.bid.assemblies, so a case mismatch or typo
// (the UX report's highest-severity item) becomes structurally
// impossible — the only way to end up with an unmatched value going
// forward is an assembly that existed when this row was set and has
// since been deleted, or an imported/legacy draft carrying a stale
// reference (see src/state/validation.js's isOrphanTypeId()).
//
// The one deliberately controlled field in an otherwise fully
// uncontrolled row (see WallsPage.jsx/CeilingsPage.jsx's header
// comments) — orphan detection needs to react across pages (an assembly
// deleted on Assemblies must invalidate a reference already displayed
// on Walls), which only real reducer state can do; a same-row ref-based
// side effect (the pattern this row's other fields use) can't reach
// across pages.
// ─────────────────────────────────────────────────────────────────────
export default function TypeIdSelect({ assemblies, value, onChange, className }) {
  const rows = assemblies || [];
  const resolved = value === '' || rows.some((a) => a.id === value);
  return (
    <select className={className} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">-</option>
      {/* Synthetic option so a controlled <select> can actually display
          an orphaned value instead of silently snapping to the first
          real option — a real hazard otherwise: a <select>'s value with
          no matching <option> renders as if nothing were selected,
          hiding the very problem this dropdown exists to surface. */}
      {!resolved && <option value={value}>{value} (not found)</option>}
      {rows.map((a) => (
        <option key={a.id} value={a.id}>{a.id}: {a.studSize} / {a.boardType} / L{a.finishLevel}</option>
      ))}
    </select>
  );
}
