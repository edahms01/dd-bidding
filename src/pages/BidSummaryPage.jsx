// ─────────────────────────────────────────────────────────────────────
// BidSummaryPage.jsx — Phase D, Step 2 of the plan / Tier 2 of §7.
//
// A read-only, single-column rollup of the CURRENT active bid, for
// checking a number on a phone without walking the 9-step flow. Every
// value is a live projection of state.bid + state.ui (output, agent) —
// no inputs, no local state, nothing persisted, and it re-renders in
// step with the reactive calculation like every other consumer of
// state.ui.output.
//
// Q2 (decided at plan approval): this is the CURRENT bid, not a
// per-submitted-bid view. buildBidRecord() (js/state.js) doesn't store
// the agent options / risk flags / quantity totals that §7 lists — they
// only exist in state.ui for the bid being worked on. A per-submitted
// summary is a recorded Phase E candidate (docs/dirigo-ux-decisions.md
// §9.9), not built here.
//
// Reached only from the mobile-only "Bid summary" drawer item
// (.nav-item-mobile, CSS-hidden >=768px) and the #/summary route — the
// same activeSection + router pattern Phase C's 'biddecision' used.
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';
import { agentStaleness } from '../state/agentStaleness.js';
import AgentStalenessWarning from '../components/AgentStalenessWarning.jsx';

function fmtCost(n) { return '$' + Math.round(n || 0).toLocaleString(); }
function fmtPct(n) { return (+n || 0).toFixed(1) + '%'; }
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString();
}

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)' };

function Empty({ children }) {
  return <div className="empty-state" style={{ padding: 20, textAlign: 'left' }}>{children}</div>;
}

export default function BidSummaryPage({ active }) {
  const [state, dispatch] = useStore();
  const { project } = state.bid;
  const output = state.ui.output;
  const agent = state.ui.agent.cachedResult;
  // Phase E, Step 2 — the same active staleness warning AgentPage shows,
  // above the same stacked options. §9.9 notes this surface is if
  // anything *more* warranted on a phone: the live final-bid figure and
  // the frozen option amounts sit within one short scroll.
  const staleness = agentStaleness(state);
  const generatedBidPrice = agent ? (state.ui.agent.generatedAt?.bidPrice ?? null) : null;
  const currentBidPrice = output?.markupResult?.finalBidPrice ?? null;

  // Quantity totals reuse state.ui.output's per-area rows (same source
  // the Cost Summary breakdown and the Walls/Ceilings <tfoot> derive
  // from) rather than re-walking state.bid.
  const wallLF = output ? output.wallCosts.reduce((s, r) => s + (r.error ? 0 : (r.lf || 0)), 0) : 0;
  const ceilSF = output ? output.ceilCosts.reduce((s, r) => s + (r.error ? 0 : (r.netSF || 0)), 0) : 0;

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-summary" data-noautosave>
      <div className="page-hdr">
        <div>
          <div className="page-title">{project.name?.trim() || 'Current bid'}</div>
          <div className="page-sub">Read-only summary of the bid in progress</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'workflow' })}>
            Open full workflow →
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Project / GC / due date */}
        <div style={{ ...card, padding: '14px 18px', marginBottom: 16 }}>
          <Line label="General contractor" value={project.gc?.trim() || '—'} />
          <Line label="Bid due" value={fmtDate(project.bidDate)} last />
        </div>

        {/* Final bid */}
        {output ? (
          <div style={{ ...card, border: '2px solid var(--green)', padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 6 }}>Final bid price</div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 34, fontWeight: 700, color: 'var(--green)', lineHeight: 1.1 }}>
              {fmtCost(output.markupResult.finalBidPrice)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Effective margin {fmtPct(output.markupResult.effectiveMargin)}
            </div>
          </div>
        ) : (
          <div style={{ ...card, padding: '4px 20px 8px', marginBottom: 16 }}>
            <Empty>Enter takeoff quantities and rates to see the bid price.</Empty>
          </div>
        )}

        {/* Cost + quantity totals */}
        {output && (
          <div style={{ ...card, padding: '4px 20px 12px', marginBottom: 16 }}>
            <Line label="Direct cost" value={fmtCost(output.summary.directCostTotal)} />
            <Line label="Total markup" value={fmtCost(output.markupResult.totalMarkup)} />
            <Line label="Wall framing" value={wallLF ? wallLF.toLocaleString() + ' LF' : '—'} />
            <Line label="Ceiling area" value={ceilSF ? ceilSF.toLocaleString() + ' SF' : '—'} last />
          </div>
        )}

        {/* Agent options, stacked */}
        <div className="section-label" style={{ marginBottom: 8 }}>Agent options</div>
        {agent && agent.options && agent.options.length > 0 && staleness.stale && generatedBidPrice != null && (
          <AgentStalenessWarning
            bidPriceDelta={staleness.bidPriceDelta}
            generatedBidPrice={generatedBidPrice}
            currentBidPrice={currentBidPrice}
            onRerun={() => window.runCalculation?.()}
          />
        )}
        {agent && agent.options && agent.options.length > 0 ? (
          agent.options.map((opt) => (
            <div key={opt.type} style={{ ...card, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {opt.label}{opt.type === 'recommended' ? ' · agent pick' : ''}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmtCost(opt.bidAmount)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                {opt.margin}% margin · {opt.winLikelihood} win likelihood
              </div>
              {opt.rationale && <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginTop: 8 }}>{opt.rationale}</div>}
            </div>
          ))
        ) : (
          <div style={{ ...card, padding: '4px 20px 8px', marginBottom: 16 }}>
            <Empty>Run the bid agent on Bid Strategy to see recommended options.</Empty>
          </div>
        )}

        {/* Risk flags */}
        <div className="section-label" style={{ margin: '20px 0 12px' }}>Risk flags</div>
        {agent && agent.riskFlags && agent.riskFlags.length > 0 ? (
          <div style={{ ...card, padding: '4px 20px 12px' }}>
            {agent.riskFlags.map((f, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < agent.riskFlags.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 8 }}>{f.severity}</span>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{f.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, padding: '4px 20px 8px' }}>
            <Empty>{agent ? 'No significant risk flags identified.' : 'Available once the bid agent has run.'}</Empty>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border)'
    }}>
      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
