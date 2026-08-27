// ─────────────────────────────────────────────────────────────────────
// AgentPage.jsx — full React port of index.html's #page-agent (the
// former <template id="legacy-tpl-agent">, a one-line static
// placeholder — the real content always came from js/ui.js's
// renderAgentTab()/_renderAgentResult() innerHTML writes).
//
// Step 4 of the Agent conversion (see CLAUDE.md) applied the neutral-
// card/win-likelihood-pill treatment on top of step 3's structure —
// OPT_COLORS (competitive/recommended/ambitious-specific card colors)
// is gone. The three options are choices, not statuses: cards are
// visually neutral by default (var(--surface)/var(--border), the same
// values OPT_COLORS' own fallback already used for an unrecognized
// type), selection state is var(--action-dim)/var(--action-border) —
// consistent with FinalizeModal.jsx's .bid-option-row.selected (already
// action-blue since A1's token work, css/components.css). The
// "Agent pick" badge is neutral now too (a category label, not a
// status) — the same treatment StatusPill's own "Neutral" variant
// already uses on this page. Win-likelihood color is the one thing
// that stays: it's a genuine status (how likely this option is to
// win), not a category, so WinLikelihoodPill/WIN_LIKELIHOOD_STYLES are
// untouched from step 3.
//
// Renders directly from state.ui.agent, which js/ui.js's
// renderAgentTab()/_renderAgentResult() dispatch into via
// window.__renderAgentTab (see bridges.js) on every call site they
// always ran from — window.goto('agent'), both steps of
// _launchBidAgent(), and runAgentIfNeeded()'s background pre-run.
// Branch order/priority replicates the original exactly: a cached
// result wins even over a fresh load in flight (nothing clears
// cachedResult until a draft switch, via window.__resetAgentCache) —
// not a simplification, the real original behavior, verified directly.
// selectedOption resets to 'recommended' on every cache-hit dispatch,
// i.e. every tab revisit, matching _renderAgentResult()'s own
// unconditional reset exactly — card selection does not persist across
// tab switches, only the underlying result does.
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }

function StatusPill({ status }) {
  if (status === 'positive') return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(58,191,122,.1)', border: '1px solid rgba(58,191,122,.25)', color: 'var(--green)' }}>Positive</span>;
  if (status === 'warning') return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(232,124,42,.1)', border: '1px solid rgba(232,124,42,.3)', color: 'var(--accent)' }}>Warning</span>;
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text3)' }}>Neutral</span>;
}

function FlagDot({ severity }) {
  const col = severity === 'high' ? '#e85c4a' : severity === 'medium' ? 'var(--accent)' : 'var(--text3)';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0, marginTop: 5, display: 'inline-block' }} />;
}

const WIN_LIKELIHOOD_STYLES = {
  'Very High': { background: 'rgba(58,191,122,.15)', border: '1px solid rgba(58,191,122,.35)', color: '#3abf7a' },
  'High': { background: 'rgba(58,191,122,.10)', border: '1px solid rgba(58,191,122,.25)', color: '#3abf7a' },
  'Medium': { background: 'rgba(232,124,42,.12)', border: '1px solid rgba(232,124,42,.30)', color: '#e87c2a' },
  'Low–Medium': { background: 'rgba(232,92,74,.10)', border: '1px solid rgba(232,92,74,.25)', color: '#e85c4a' },
  'Low': { background: 'rgba(232,92,74,.15)', border: '1px solid rgba(232,92,74,.35)', color: '#e85c4a' }
};

function WinLikelihoodPill({ val }) {
  const s = WIN_LIKELIHOOD_STYLES[val] || { background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)', color: 'var(--text3)' };
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, ...s }}>{val || '—'}</span>;
}

function Header({ options, dispatch }) {
  return (
    <div className="page-hdr">
      <div>
        <div className="page-title">Agent Recommendation</div>
        <div className="page-sub">Bid strategy analysis by Claude AI</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-ghost" onClick={() => window.goto('output')}>← Back</button>
        {/* A2 cleanup pass: dispatches OPEN_FINALIZE_MODAL directly —
            window._showFinalizeModal/window.__getLastAgentResult are
            gone, they had no remaining classic-script consumer once
            Agent/Output converted (see bridges.js), and options is
            already available here as a prop (state.ui.agent.cachedResult
            — the same value _lastAgentResult held). */}
        <button id="agent-finalize-btn" className="btn btn-primary" onClick={() => dispatch({ type: 'OPEN_FINALIZE_MODAL', options: options || [] })}>Finalize bid →</button>
      </div>
    </div>
  );
}

function OptionCard({ opt, isSelected, dispatch }) {
  const isRec = opt.type === 'recommended';
  return (
    <div
      data-bid-opt={opt.type}
      onClick={() => dispatch({ type: 'SELECT_AGENT_OPTION', option: opt.type })}
      style={{
        flex: 1, background: isSelected ? 'var(--action-dim)' : 'var(--surface)',
        border: '1px solid ' + (isSelected ? 'var(--action-border)' : 'var(--border)'),
        borderRadius: 'var(--rl)', padding: '18px 16px', cursor: 'pointer', position: 'relative', transition: 'all .15s'
      }}
    >
      {isRec && (
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text3)', letterSpacing: '.03em' }}>Agent pick</span>
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>{opt.label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 3 }}>{fmtCost(opt.bidAmount)}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{opt.margin}% margin</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', marginBottom: 5, textTransform: 'uppercase' }}>WIN LIKELIHOOD</div>
        <WinLikelihoodPill val={opt.winLikelihood} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginTop: 12 }}>{opt.rationale}</div>
    </div>
  );
}

function AgentResult({ r, selectedOption, historyUnavailable, dispatch }) {
  return (
    <>
      <Header options={r.options} dispatch={dispatch} />
      {historyUnavailable && (
        <div style={{ background: 'rgba(232,124,42,.08)', border: '1px solid rgba(232,124,42,.3)', borderRadius: 'var(--rl)', padding: '10px 16px', marginBottom: 20, fontSize: 12, color: 'var(--accent)' }}>
          Historical bid data unavailable — recommendation based on this bid only.
        </div>
      )}

      <div className="section-block">
        <div className="section-label">Agent analysis</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '16px 18px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
          {r.reasoning || 'No analysis provided.'}
        </div>
      </div>

      <div className="section-block">
        <div className="section-label">Bid options</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          {(r.options || []).map((opt) => (
            <OptionCard key={opt.type} opt={opt} isSelected={selectedOption === opt.type} dispatch={dispatch} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '0 2px' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>← Higher win rate</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 16px' }} />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Higher margin →</span>
        </div>
      </div>

      <div className="section-block">
        <div className="section-label">Signal summary</div>
        {r.signals && r.signals.length > 0 ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Signal</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                {r.signals.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{s.label}</td>
                    <td style={{ color: 'var(--text2)' }}>{s.value}{s.note && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.note}</div>}</td>
                    <td><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No signals returned.</div>
        )}
      </div>

      <div className="section-block">
        <div className="section-label">Risk flags</div>
        {!r.riskFlags || r.riskFlags.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No significant risk flags identified.</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '4px 20px 12px' }}>
            {r.riskFlags.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <FlagDot severity={f.severity} />
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 8 }}>{f.severity}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{f.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-label">Historical context</div>
        {!r.historicalNotes || r.historicalNotes.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>
            No historical data yet for this GC or building type. Win rate tracking will appear here after bids are logged.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {r.historicalNotes.map((note, i) => (
              <li key={i} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text2)', paddingLeft: 16, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: 'var(--text3)' }}>›</span>{note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function AgentPage({ active }) {
  const [state, dispatch] = useStore();
  const { cachedResult, loading, historyUnavailable, selectedOption } = state.ui.agent;

  let body;
  if (cachedResult) {
    body = <AgentResult r={cachedResult} selectedOption={selectedOption} historyUnavailable={historyUnavailable} dispatch={dispatch} />;
  } else if (loading) {
    body = (
      <>
        <Header options={[]} dispatch={dispatch} />
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Agent is analyzing your bid…</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>This takes a few seconds.</div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Header options={[]} dispatch={dispatch} />
        <div className="empty-state">Complete your bid setup and click "Generate bid output →" on Tab 6 to get the agent's recommendation.</div>
      </>
    );
  }

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-agent">
      {body}
    </div>
  );
}
