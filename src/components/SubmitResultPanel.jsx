// ─────────────────────────────────────────────────────────────────────
// SubmitResultPanel.jsx — Phase E, Step 1 (5.6).
//
// The post-finalize success / failure confirmation panel, extracted
// verbatim from OutputPage.jsx's former inline SubmitResultPanel so it
// can render from BOTH OutputPage and AgentPage bound to the same
// state.ui.submitResult. That's the wrong-tab fix (docs/
// dirigo-ux-decisions.md §9.9): finalize is triggered from AgentPage
// ('agent' tab) but the durable panel only ever rendered on OutputPage
// ('output' tab), so the confirmation the user needs to see was on a tab
// they weren't looking at. Rendering the identical component on both
// pages — the two real finalize origins (Agent's "Finalize bid →",
// OutputPage's post-failure "Try again") — means it's always visible on
// whichever page is active when the submit resolves.
//
// No `id` on the wrapper: both pages are always mounted, so this
// component is in the DOM twice whenever submitResult is set. Tests key
// off `#page-agent .submit-result-panel` / `#page-output
// .submit-result-panel`.
//
// 5.6 also adds recommended-vs-chosen on the success panel — the gap
// between what the agent recommended and what was actually bid. Reads
// saved.recommended_bid (persisted by buildBidRecord() as of this step)
// with a live cachedResult fallback for records predating the field.
// ─────────────────────────────────────────────────────────────────────
function fmtCost(n) { return '$' + Math.round(n || 0).toLocaleString(); }

function RecommendedVsChosen({ saved, agentOptions }) {
  const recFromRecord = saved.recommended_bid;
  const recFromLive = (agentOptions || []).find((o) => o.type === 'recommended')?.bidAmount;
  const rec = recFromRecord != null ? recFromRecord : (recFromLive != null ? recFromLive : null);
  const chosen = saved.final_bid;
  if (rec == null || chosen == null) return null;

  const delta = chosen - rec;
  const pct = rec ? (delta / rec) * 100 : 0;
  const matched = Math.abs(delta) < 1;
  const sign = delta > 0 ? '+' : '−';
  const optLabel = saved.selected_option && saved.selected_option !== 'recommended'
    ? ' · chose ' + saved.selected_option
    : '';

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
      {matched ? (
        <span>Matched the recommended bid ({fmtCost(rec)}).</span>
      ) : (
        <span>
          Recommended {fmtCost(rec)} · you bid {fmtCost(chosen)}{' '}
          <span style={{ color: delta > 0 ? 'var(--green)' : '#e85c4a' }}>
            ({sign}{fmtCost(Math.abs(delta))}, {sign}{Math.abs(pct).toFixed(1)}%)
          </span>
          {optLabel}
        </span>
      )}
    </div>
  );
}

export default function SubmitResultPanel({ result, agentOptions, dispatch }) {
  if (result.status === 'error') {
    return (
      <div className="section-block submit-result-panel">
        <div style={{ background: 'var(--surface)', border: '2px solid #e85c4a', borderRadius: 'var(--rl)', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 24, color: '#e85c4a', marginBottom: 10 }}>✕</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Bid submission failed</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            Nothing was saved. Your draft is unchanged. Check your connection and try again.
          </div>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'OPEN_FINALIZE_MODAL', options: agentOptions || [] })}>Try again</button>
        </div>
      </div>
    );
  }

  const { saved } = result;
  return (
    <div className="section-block submit-result-panel">
      <div style={{ background: 'var(--surface)', border: '2px solid var(--green)', borderRadius: 'var(--rl)', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 24, color: 'var(--green)', marginBottom: 10 }}>✓</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Bid submitted</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {saved.project_name || '(unnamed project)'}: {fmtCost(saved.final_bid)}
        </div>
        <RecommendedVsChosen saved={saved} agentOptions={agentOptions} />
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'bids' })}>View bid history →</button>
          <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => window.calculateOnly?.()}>Back to output</button>
        </div>
      </div>
    </div>
  );
}
