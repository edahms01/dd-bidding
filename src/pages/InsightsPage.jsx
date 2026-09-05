// ─────────────────────────────────────────────────────────────────────
// InsightsPage.jsx — Phase F, 8.1. Renders the estimating analytics
// js/history-analytics.js has computed and unit-tested since Tier 1/2
// but never surfaced: the margin-outcome curve, seasonality, and
// competitor loss patterns. Read-only — no inputs, nothing persisted,
// no bid record touched.
//
// Consumes existing exports only (docs/dirigo-ux-decisions.md §8, Phase
// F brief non-goal): the three compute* functions are classic-script
// globals (js/history-analytics.js is a non-module <script> in
// index.html, loaded before main.jsx), reached here as window.*, the
// same way js/history.js already calls them. Their "not enough data"
// gates (MIN_BIDS_FOR_MARGIN_CURVE = 15 decided bids;
// MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE = 2) are honoured as-is — no new
// thresholds invented here.
//
// Data comes from window.getAllBids() with the same
// loading / ready / error tri-state BidsPage.jsx uses (js/history.js
// throws rather than returning [] so "zero bids" and "fetch failed" stay
// distinguishable). Charting is CSS-only bars — no charting dependency
// added (decided at Step 1: §9.1's "no dependency rot" value, ≤8 bands,
// trivially theme-aware and testable). Cost Summary is the visual
// precedent, not Rates: .tray / .tray-hdr / .empty-state, and .tray-cols
// so the three sections inherit the 3→2→1 reflow (§6.10) with no
// Insights-specific responsive code.
//
// Standalone screen: activeSection 'insights' + #/insights route, its
// own left-nav item — same shape as 'biddecision'. 8.3's GC scorecard
// lands here as one more section.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';

// Proportional-width bar row: label | track | value. `pct` drives the
// fill width (clamped 0–100); `value` is the text to its right.
function BarRow({ label, pct, value }) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="insight-bar">
      <div className="insight-bar-label">{label}</div>
      <div className="insight-bar-track">
        <div className="insight-bar-fill" style={{ width: w + '%' }} />
      </div>
      <div className="insight-bar-val">{value}</div>
    </div>
  );
}

function MarginCurve({ bids }) {
  const curve = window.computeMarginOutcomeCurve(bids);
  if (!curve.available) {
    return (
      <div className="empty-state">
        Not enough decided bids yet: {curve.count} of {curve.minRequired}.
        <br />Win rate by margin band appears once {curve.minRequired} bids have been won or lost.
      </div>
    );
  }
  return (
    <div>
      {curve.bands.map((b) => (
        <BarRow
          key={b.low}
          label={b.label}
          pct={b.winRate}
          value={<span>{b.winRate}% won <span className="insight-bar-sub">· {b.wins}/{b.count}</span></span>}
        />
      ))}
    </div>
  );
}

function Seasonality({ bids }) {
  const quarters = window.computeSeasonality(bids);
  if (quarters.length === 0) {
    return <div className="empty-state">No decided bids with a bid date yet.</div>;
  }
  const totalDecided = quarters.reduce((s, q) => s + q.totalBids, 0);
  return (
    <div>
      {quarters.map((q) => (
        <BarRow
          key={q.quarter}
          label={q.quarter}
          pct={q.winRate}
          value={<span>{q.winRate}% won <span className="insight-bar-sub">· {q.wins}/{q.totalBids}</span></span>}
        />
      ))}
      {totalDecided < 8 && (
        <div className="insight-note">Limited history: quarters with few bids swing hard on one outcome.</div>
      )}
    </div>
  );
}

function CompetitorPatterns({ bids }) {
  const rows = window.computeCompetitorPatterns(bids);
  if (rows.length === 0) {
    return <div className="empty-state">No losses recorded against a named competitor yet.</div>;
  }
  const anyGated = rows.some((r) => r.avgUndercutPct == null);
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr><th>Competitor</th><th>Losses to them</th><th>Avg undercut</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.timesLost}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: r.avgUndercutPct == null ? 'var(--text3)' : 'var(--text)' }}>
                {r.avgUndercutPct == null ? '-' : r.avgUndercutPct + '%'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {anyGated && (
        <div className="insight-note">A dash means fewer than 2 of the losses to that competitor have the winning bid recorded, so there is nothing to average yet.</div>
      )}
    </div>
  );
}

export default function InsightsPage({ active }) {
  const [, dispatch] = useStore();
  const [bids, setBids] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setStatus('loading');
    window.getAllBids()
      .then((b) => { if (!cancelled) { setBids(b); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [active]);

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-insights" data-noautosave>
      <div className="page-hdr">
        <div>
          <div className="page-title">Insights</div>
          <div className="page-sub">What past bids say about pricing, timing, and who we lose to</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'bids' })}>← Back to Bids</button>
        </div>
      </div>

      {status === 'loading' && <div className="empty-state">Loading bid history…</div>}

      {status === 'error' && (
        <div className="empty-state" style={{ color: 'var(--danger)' }}>
          Couldn't load bid history. Check your connection and try again.
        </div>
      )}

      {status === 'ready' && (
        <div className="tray-cols" style={{ '--col-min': '340px', gap: 24, justifyContent: 'start' }}>
          <div className="tray">
            <div className="tray-hdr">Win rate by margin band</div>
            <MarginCurve bids={bids} />
          </div>
          <div className="tray">
            <div className="tray-hdr">Win rate by quarter</div>
            <Seasonality bids={bids} />
          </div>
          <div className="tray">
            <div className="tray-hdr">Competitor loss patterns</div>
            <CompetitorPatterns bids={bids} />
          </div>
        </div>
      )}
    </div>
  );
}
