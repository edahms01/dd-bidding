// ─────────────────────────────────────────────────────────────────────
// OutputPage.jsx — full React port of index.html's #page-output (the
// former <template id="legacy-tpl-output">) plus js/ui.js's
// renderOutput() (the innerHTML-replace render function that used to
// own #output-phase3/#output-bid).
//
// Different shape from every page converted so far: this isn't a form
// whose fields feed the reducer directly — it's a *derived display* of
// whatever runCalculation() (js/ui.js) last computed from calculator.js
// (wallCosts/ceilCosts/summary/markupResult), still orchestrated by
// that same classic-script function (pre-fill contingency,
// collectFormData(), the six calculator calls, launching the agent —
// none of that moved, per "no business logic changes"). Its final step
// (window.__renderOutput, see bridges.js) now dispatches the computed
// values into state.ui.output instead of writing #output-phase3/
// #output-bid.innerHTML directly. state.ui.output is null until the
// first calculation — this page renders the original template's
// static "Complete rates and click..." placeholder for that case.
//
// Markup (overhead/contingency/profit) is the one genuinely form-like
// part of this page — real React-controlled inputs, SET_FIELD-dispatched,
// same pattern as every scalar page. collectFormData() (js/state.js)
// keeps reading these by DOM id unmodified, same as it always has.
//
// submitBid() (js/ui.js)'s post-finalize success/failure panel used to
// overwrite #output-bid's content directly — window.__setSubmitResult
// now dispatches into state.ui.submitResult instead, and this page
// renders that in place of the normal Phase 4 breakdown when it's set.
// Deliberately preserves the known wrong-tab bug exactly: submitResult
// is set regardless of which tab was active when submitBid() ran (Tab 8,
// via the finalize modal, in the bug's actual case), so it becomes
// visible here the moment the user is *looking* at this page, not
// necessarily when the submission happened. Not fixed — see CLAUDE.md/
// the A2 plan. A fresh calculation (RENDER_OUTPUT) clears submitResult,
// matching the original's implicit behavior (any renderOutput() call
// overwrote whatever #output-bid held, submit panel included).
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n)  { return (+n).toFixed(1) + '%'; }

function SubtotalRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: accent || 'var(--text)' }}>{value}</span>
    </div>
  );
}

function AreaRow({ r, qty }) {
  if (r.error) {
    return (
      <tr><td colSpan="6" style={{ padding: 8, color: '#e85c4a', fontStyle: 'italic' }}>
        {r.location || '(unnamed)'} — {r.error}
      </td></tr>
    );
  }
  return (
    <tr>
      <td>{r.location || '—'}</td>
      <td style={{ color: 'var(--text2)' }}>{r.typeId}{r.layers > 1 ? ' ×' + r.layers : ''}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>{qty}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCost(r.laborTotal)}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCost(r.materialTotal)}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtCost(r.total)}</td>
    </tr>
  );
}

function GroupHead({ label }) {
  return (
    <tr><td colSpan="6" style={{ padding: '10px 8px 3px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
      {label}
    </td></tr>
  );
}

function Phase3({ output }) {
  const { wallCosts, ceilCosts, summary } = output;
  const hasWalls = wallCosts.length > 0;
  const hasCeilings = ceilCosts.length > 0;
  const hasAreas = hasWalls || hasCeilings;

  return (
    <>
      <div className="totals-bar" style={{ marginBottom: 28 }}>
        <div className="total-item"><div className="total-val">{fmtCost(summary.laborTotal)}</div><div className="total-lbl">Labor</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">{fmtCost(summary.materialTotal)}</div><div className="total-lbl">Materials</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">{fmtCost(summary.logisticsTotal)}</div><div className="total-lbl">Logistics</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val green">{fmtCost(summary.directCostTotal)}</div><div className="total-lbl">Direct cost total</div></div>
      </div>

      <div className="section-block">
        <div className="section-label">Per-area breakdown</div>
        {hasAreas ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>Location</th><th>Assembly</th><th>Quantity</th><th>Labor</th><th>Materials</th><th>Subtotal</th>
              </tr></thead>
              <tbody>
                {hasWalls && <GroupHead label="Walls" />}
                {wallCosts.map((r, i) => <AreaRow key={'w' + i} r={r} qty={r.lf ? r.lf.toLocaleString() + ' LF' : '— LF'} />)}
                {hasCeilings && <GroupHead label="Ceilings" />}
                {ceilCosts.map((r, i) => <AreaRow key={'c' + i} r={r} qty={r.netSF.toLocaleString() + ' SF'} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>No wall or ceiling rows with data.</div>
        )}
      </div>

      <div className="section-block">
        <div className="section-label">Category subtotals</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '4px 20px 12px' }}>
          <SubtotalRow label="Labor (raw)" value={fmtCost(summary.laborTotal)} accent="var(--teal)" />
          <SubtotalRow label={'Materials (incl. ' + fmtPct(summary.weightedWastePct) + ' waste)'} value={fmtCost(summary.materialTotal)} />
          <SubtotalRow
            label={'Logistics (' + output.state.conditions.trips + ' trips' + (summary.logisticsTotal > 0 ? ', lift ' + fmtCost(output.state.rates.lift) + '/wk' : '') + ')'}
            value={fmtCost(summary.logisticsTotal)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 6px', marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Direct cost total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{fmtCost(summary.directCostTotal)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Phase4({ output }) {
  const { summary, markupResult } = output;
  const mu = output.state.markupInputs;
  return (
    <>
      <div className="section-block">
        <div className="section-label">Pricing breakdown</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '4px 20px 12px' }}>
          <SubtotalRow label="Direct cost total" value={fmtCost(markupResult.directCostTotal)} accent="var(--teal)" />
          <SubtotalRow label={'Company overhead (' + fmtPct(mu.overheadPct) + ')'} value={fmtCost(markupResult.overhead)} />
          <SubtotalRow label={'Risk / contingency (' + fmtPct(mu.contingencyPct) + ')'} value={fmtCost(markupResult.contingency)} />
          <SubtotalRow label={'Profit margin (' + fmtPct(mu.profitPct) + ')'} value={fmtCost(markupResult.profit)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 6px', marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Total markup</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>{fmtCost(markupResult.totalMarkup)}</span>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div style={{ background: 'var(--surface)', border: '2px solid var(--green)', borderRadius: 'var(--rl)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 6 }}>Final bid price</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Effective margin: {fmtPct(markupResult.effectiveMargin)}</div>
          </div>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 38, fontWeight: 700, color: 'var(--green)' }}>{fmtCost(markupResult.finalBidPrice)}</div>
        </div>
      </div>
    </>
  );
}

function SubmitResultPanel({ result, agentOptions, dispatch }) {
  if (result.status === 'error') {
    return (
      <div className="section-block">
        <div style={{ background: 'var(--surface)', border: '2px solid #e85c4a', borderRadius: 'var(--rl)', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 24, color: '#e85c4a', marginBottom: 10 }}>✕</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Bid submission failed</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            Nothing was saved — your draft is unchanged. Check your connection and try again.
          </div>
          {/* A2 cleanup pass: dispatches OPEN_FINALIZE_MODAL directly —
              window._showFinalizeModal/window.__getLastAgentResult are
              gone, no remaining classic-script consumer once Agent/
              Output converted (see bridges.js); agentOptions is
              state.ui.agent.cachedResult?.options, the same value
              _lastAgentResult?.options held. */}
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'OPEN_FINALIZE_MODAL', options: agentOptions || [] })}>Try again</button>
        </div>
      </div>
    );
  }
  const { saved } = result;
  return (
    <div className="section-block">
      <div style={{ background: 'var(--surface)', border: '2px solid var(--green)', borderRadius: 'var(--rl)', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 24, color: 'var(--green)', marginBottom: 10 }}>✓</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Bid submitted</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {saved.project_name || '(unnamed project)'} — {fmtCost(saved.final_bid)}
        </div>
        <button className="btn btn-primary" onClick={() => window.goto('history')}>View bid history →</button>
        <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => window.runCalculation?.()}>Back to output</button>
      </div>
    </div>
  );
}

export default function OutputPage({ active }) {
  const [state, dispatch] = useStore();
  const { output, submitResult, agent } = state.ui;
  const mu = state.bid.markupInputs;

  const setMarkup = (field, value) => dispatch({ type: 'SET_FIELD', path: ['bid', 'markupInputs', field], value });

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-output">
      <div className="page-hdr">
        <div><div className="page-title">Cost Summary</div><div className="page-sub">Direct cost breakdown and pricing</div></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.goto('rates')}>← Back</button>
          {/* 4.2: manual Recalculate removed — calculation is reactive now
              (window.scheduleRecalc, js/ui.js), wired from js/forms.js's
              autosave-change handler and AppShell.jsx's state.bid watcher.
              The button implied a number could go stale with nothing
              indicating when; nothing here should need it anymore. */}
          <button className="btn btn-primary" onClick={() => window.goto('market')}>Next: Market Read →</button>
        </div>
      </div>

      <div id="output-phase3">
        {output
          ? <Phase3 output={output} />
          : <div className="empty-state">Enter rates and takeoff quantities — the cost summary calculates automatically.</div>}
      </div>

      <div className="section-block">
        <div className="section-label">Markup</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '20px 20px 8px' }}>
          <div className="rgrid g3">
            <div className="rcard">
              <div className="rcard-lbl">Company overhead <span className="badge b-pct">%</span></div>
              <div className="iw"><input id="markup-overhead" className="ri" type="number" min="0" step="0.1" placeholder="10.0" value={mu.overheadPct} onChange={(e) => setMarkup('overheadPct', e.target.value)} /><span className="isfx">%</span></div>
              <div className="rhint">Office, insurance, fleet — % of direct costs</div>
            </div>
            <div className="rcard">
              <div className="rcard-lbl">Risk / contingency <span className="badge b-pct">%</span></div>
              <div className="iw"><input id="markup-contingency" className="ri" type="number" min="0" step="0.1" placeholder="—" value={mu.contingencyPct} onChange={(e) => setMarkup('contingencyPct', e.target.value)} /><span className="isfx">%</span></div>
              <div className="rhint">Pre-filled from confidence level — editable</div>
            </div>
            <div className="rcard">
              <div className="rcard-lbl">Profit margin <span className="badge b-pct">%</span></div>
              <div className="iw"><input id="markup-profit" className="ri" type="number" min="0" step="0.1" placeholder="8.0" value={mu.profitPct} onChange={(e) => setMarkup('profitPct', e.target.value)} /><span className="isfx">%</span></div>
              <div className="rhint">Target profit on direct costs</div>
            </div>
          </div>
        </div>
      </div>

      <div id="output-bid">
        {submitResult ? <SubmitResultPanel result={submitResult} agentOptions={agent.cachedResult?.options} dispatch={dispatch} /> : (output ? <Phase4 output={output} /> : null)}
      </div>
    </div>
  );
}
