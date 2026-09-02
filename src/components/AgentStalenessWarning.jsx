// ─────────────────────────────────────────────────────────────────────
// AgentStalenessWarning.jsx — Phase E, Step 2. The active replacement for
// the Phase B interim one-liner ("These options may reflect an earlier
// version of your inputs."), shown ONLY when agentStaleness() actually
// detects drift — on AgentPage (above the option cards), BidSummaryPage
// (above the stacked options), and FinalizeModal (above the footer,
// paired with the acknowledge checkbox that gates Confirm).
//
// `onRerun` is passed on the pages (a real "Re-run agent" action) but not
// in the modal — you acknowledge or cancel there, you don't recalculate
// mid-finalize. The demo-mode note is deliberate: re-running clears this
// check but does not move the numbers on the cards (js/agent.js
// DEMO_MODE, see agentStaleness.js).
// ─────────────────────────────────────────────────────────────────────
function fmtCost(n) { return '$' + Math.round(n || 0).toLocaleString(); }

export default function AgentStalenessWarning({ bidPriceDelta, generatedBidPrice, currentBidPrice, onRerun }) {
  const sign = bidPriceDelta > 0 ? '+' : '−';
  return (
    <div
      className="agent-staleness-warn"
      style={{
        background: 'rgba(232,124,42,.08)', border: '1px solid rgba(232,124,42,.3)',
        borderRadius: 'var(--rl)', padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--accent)'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 3 }}>Inputs changed since these options were generated</div>
      <div style={{ color: 'var(--text3)', lineHeight: 1.5 }}>
        Current bid price {fmtCost(currentBidPrice)} vs {fmtCost(generatedBidPrice)} when the agent ran
        {' '}(Δ {sign}{fmtCost(Math.abs(bidPriceDelta))}). The option amounts below are from that earlier run.
      </div>
      {onRerun && (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onRerun}>Re-run agent</button>
          <span style={{ marginLeft: 8, color: 'var(--text3)' }}>
            Demo mode: option amounts are fixed — re-running refreshes this check, not the numbers.
          </span>
        </div>
      )}
    </div>
  );
}
