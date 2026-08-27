// ─────────────────────────────────────────────────────────────────────
// DashboardPage.jsx — full React port of js/ui.js's renderDashboard() +
// duplicateDraftAndRefresh()/confirmDeleteDraft(). Same "innerHTML-
// replace-to-component" pattern already proven on HistoryPage.jsx —
// own local state, refetched on every becomes-active transition
// (matches the original showDashboard() calling renderDashboard()
// fresh every left-nav click), not a network fetch this time
// (getAllDrafts() reads localStorage synchronously), so no loading/
// error states — same reason the original never had them either.
//
// Classic-script-global audit done before writing this (same
// discipline as Assemblies/Walls/Ceilings and Agent): getAllDrafts()/
// switchToDraft()/createDraft()/duplicateDraft()/deleteDraft() are all
// safely callable directly (getAllDrafts() is a pure data read;
// the rest are plain `function` declarations, already `window`-exposed,
// same as every other cross-file classic-script call this migration
// has relied on). No new bridge needed — first page conversion this
// migration where that's been true. window.showDashboard (bridges.js)
// no longer calls window.renderDashboard?.() — this page owns its own
// refresh via the active-triggered effect below, same as
// window.showHistory not calling renderHistory() once HistoryPage
// existed. renderDashboard()/duplicateDraftAndRefresh()/
// confirmDeleteDraft() (js/ui.js) are now fully dead — nothing calls
// them any more, verified not assumed.
//
// Row actions call the underlying primitives directly (switchToDraft/
// duplicateDraft/deleteDraft), not the old *AndRefresh/confirm*
// wrappers — those wrappers' only other job (calling the now-dead
// renderDashboard()) is replaced by this component's own load() call,
// same pattern as every other row-action conversion this migration has
// done (_selectBidOption() -> dispatch, _modalSelectRow() -> dispatch).
// The native confirm() dialog for delete is kept unchanged.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

function fmtModified(d) { return d.lastModifiedAt ? new Date(d.lastModifiedAt).toLocaleString() : '—'; }

export default function DashboardPage({ active }) {
  const [drafts, setDrafts] = useState([]);

  function load() {
    const all = Object.values(window.getAllDrafts())
      .sort((a, b) => new Date(b.lastModifiedAt) - new Date(a.lastModifiedAt));
    setDrafts(all);
  }

  useEffect(() => {
    if (active) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function handleDuplicate(id) {
    window.duplicateDraft(id);
    load();
  }

  function handleDelete(id) {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    window.deleteDraft(id);
    load();
  }

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-dashboard">
      <div className="page-hdr">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Every bid currently in progress</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => window.createDraft()}>+ New Bid</button>
        </div>
      </div>

      <div className="section-block">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Project</th><th>Building type</th><th>Last modified</th><th></th></tr></thead>
            <tbody>
              {drafts.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No drafts yet — click "New Bid" to start one.</td></tr>
              ) : drafts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{(d.project && d.project.name) || 'Untitled bid'}</td>
                  <td style={{ color: 'var(--text2)' }}>{(d.project && d.project.buildingType) || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtModified(d)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => window.switchToDraft(d.id)}>Open</button>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDuplicate(d.id)}>Duplicate</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 4 }} onClick={() => handleDelete(d.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
