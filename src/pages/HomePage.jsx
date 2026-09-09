// ─────────────────────────────────────────────────────────────────────
// HomePage.jsx — the cold-load launcher (Home-launcher brief, Option A).
//
// Replaces the workflow as the default landing so opening the app no
// longer drops you mid-form into whatever draft was last active. One
// New Bid CTA, the 3 most recent drafts (window.getAllDrafts() — the
// same source BidsPage uses, no new storage), and a link into the full
// Bids list. Deliberately minimal: no Insights teaser, no Bid Decision
// nudges, no rate-staleness nudges, no Load Demo button (the dev-only
// Load Demo toolbar elsewhere is untouched).
//
// "Open" on a draft is just window.switchToDraft(id) — same as
// BidsPage's Open button, which lands on the Project tab
// (switchToDraft -> goto('project')). There is no per-draft last-tab
// memory anywhere in the app and this brief does not add one.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';

// Relative timestamp — same shape as AppShell.jsx's fmtWhen (kept local
// rather than exported/shared for one caller).
function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.round(hr / 24);
  if (day < 7) return day + 'd ago';
  return d.toLocaleDateString();
}

// Newest-first, capped at 3. Same source + sort as AppShell.jsx's
// sortedOpenDrafts() / BidsPage's draft list.
function recentDrafts() {
  let map = {};
  try { map = window.getAllDrafts ? window.getAllDrafts() : {}; } catch (e) { map = {}; }
  return Object.values(map)
    .sort((a, b) => new Date(b.lastModifiedAt || b.createdAt || 0) - new Date(a.lastModifiedAt || a.createdAt || 0))
    .slice(0, 3);
}

export default function HomePage({ active }) {
  const [, dispatch] = useStore();
  const [drafts, setDrafts] = useState([]);

  // Refetch on every becomes-active transition so a draft created or
  // renamed elsewhere shows current data on return (same pattern as
  // BidsPage's loadDrafts()).
  useEffect(() => { if (active) setDrafts(recentDrafts()); }, [active]);

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-home" data-noautosave>
      <div className="page-hdr">
        <div>
          <div className="page-title">Bid IQ</div>
          <div className="page-sub">Start a new bid, or pick up a recent one.</div>
        </div>
      </div>

      <button
        className="btn btn-primary home-newbid"
        onClick={() => window.createDraft?.()}
      >+ New Bid</button>

      {drafts.length === 0 ? (
        <div className="empty-state">No bids yet. Start one above.</div>
      ) : (
        // 2-column body: Recent bids fills column 1 (.tray-half sizes it
        // to one column; the right half is left open), same tray-column
        // sizing MarketReadPage uses. Collapses to full width <=768px.
        <div className="tray tray-half">
          <div className="tray-hdr">Recent bids</div>
          {drafts.map((d) => (
            <div className="home-draft-row" key={d.id}>
              <div className="home-draft-name">{d.project?.name?.trim() || 'Untitled bid'}</div>
              <div className="home-draft-meta">
                {(d.project?.buildingType || '—')} · {fmtWhen(d.lastModifiedAt || d.createdAt)}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.switchToDraft?.(d.id)}
              >Open</button>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-sm home-viewall"
            onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'bids' })}
          >View all bids →</button>
        </div>
      )}
    </div>
  );
}
