// ─────────────────────────────────────────────────────────────────────
// FinalizeModal.jsx — shell-owned component replacing js/ui.js's
// _initFinalizeModal()/_showFinalizeModal()/_closeFinalizeModal()/
// _modalSelectRow()/_modalCustomInput()/_finalizeBid(). Reachable from
// both Tab 7 (OutputPage's "Try again") and Tab 8 (Agent's "Finalize
// bid →", still classic-script until Agent converts) via the
// window._showFinalizeModal bridge (see bridges.js) — the modal itself
// doesn't know or care which tab opened it.
//
// Always mounted (rendered unconditionally by AppShell), visibility
// purely CSS-driven via the .open class, exactly like the original
// #finalize-modal-overlay always was — components.css's fade/slide
// transition is keyed off that class appearing on an already-present
// element; conditionally mounting the modal instead would skip the
// transition entirely (nothing to animate from on a fresh insert).
//
// Double-submit guard: isSubmitting is set via a synchronous dispatch
// at the top of handleConfirm(), before the `await submitBid()` —
// same timing the original's direct confirmBtn.disabled = true write
// relied on. No flushSync (see CLAUDE.md's scoping caution) — a
// dispatch from a synchronous portion of a click handler, before its
// first await, commits under React 18's automatic batching before the
// browser's next paint, the same guarantee the original had. Verified
// empirically against the existing (unmodified) bid-storage-error-
// handling.spec.js double-click spec, not just reasoned through.
// ─────────────────────────────────────────────────────────────────────
import { useStore } from '../state/store.jsx';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }

export default function FinalizeModal() {
  const [state, dispatch] = useStore();
  const { open, options, selected, customAmount, isSubmitting, error } = state.ui.finalizeModal;

  function selectOption(type) {
    dispatch({ type: 'SELECT_FINALIZE_OPTION', option: type });
  }

  async function handleConfirm() {
    let amount, label;
    if (selected === 'override') {
      amount = parseFloat(customAmount || 0);
      if (!amount || amount <= 0) return;
      label = 'Custom override';
    } else {
      const opt = (options || []).find((o) => o.type === selected);
      amount = opt?.bidAmount ?? null;
      label = opt?.label ?? selected;
    }
    if (!amount) return;

    dispatch({ type: 'SET_FINALIZE_SUBMITTING', value: true });
    try {
      // A2.5: pass the resolved selection through — submitBid() (js/ui.js)
      // used to ignore it and recompute final_bid/markup_pct from the
      // plain calculator instead. selected is the reducer's own option
      // vocabulary ('competitive'|'recommended'|'ambitious'|'override'),
      // reused verbatim, no translation layer.
      await window.submitBid({ amount, selectedOption: selected });
      dispatch({ type: 'CLOSE_FINALIZE_MODAL' });
      window._showBidToast?.(label, amount);
    } catch (e) {
      // submitBid() also dispatches into OutputPage's submitResult (Tab
      // 7, hidden behind this still-open modal on Tab 8) — same
      // wrong-tab-bug reasoning as before, preserved unchanged. Show the
      // failure here too, where the user is actually looking.
      dispatch({ type: 'SET_FINALIZE_ERROR', error: 'Bid submission failed — check your connection and try again.' });
      dispatch({ type: 'SET_FINALIZE_SUBMITTING', value: false });
    }
  }

  const confirmDisabled = isSubmitting || (selected === 'override' && !(parseFloat(customAmount) > 0));

  return (
    <div className={'modal-overlay' + (open ? ' open' : '')} id="finalize-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_FINALIZE_MODAL' }); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Select your final bid amount</div>
          <button className="modal-close" onClick={() => dispatch({ type: 'CLOSE_FINALIZE_MODAL' })}>×</button>
        </div>
        <div id="finalize-modal-body">
          {(options || []).map((opt) => (
            <div key={opt.type} className={'bid-option-row' + (selected === opt.type ? ' selected' : '')} data-modal-opt={opt.type} onClick={() => selectOption(opt.type)}>
              <input type="radio" name="finalize-modal-option" value={opt.type} className="bid-option-radio" checked={selected === opt.type} readOnly />
              <div style={{ flex: 1 }}>
                <div className="bid-option-label">{opt.label}</div>
                <div className="bid-option-note">{opt.margin}% margin</div>
              </div>
              <div className="bid-option-amount">{fmtCost(opt.bidAmount)}</div>
            </div>
          ))}
          <div className={'bid-option-row' + (selected === 'override' ? ' selected' : '')} data-modal-opt="override" onClick={() => selectOption('override')}>
            <input type="radio" name="finalize-modal-option" value="override" className="bid-option-radio" checked={selected === 'override'} readOnly />
            <div style={{ flex: 1 }}>
              <div className="bid-option-label">Custom override</div>
              <div className={'custom-amount-wrap' + (selected === 'override' ? ' visible' : '')} id="modal-custom-wrap">
                <input
                  type="number" id="modal-custom-amount" placeholder="Enter amount" min="0" step="500"
                  value={customAmount}
                  onChange={(e) => dispatch({ type: 'SET_FINALIZE_CUSTOM_AMOUNT', value: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 160, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 8px', fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}
                />
              </div>
            </div>
          </div>
        </div>
        <div id="finalize-modal-error" style={{ display: error ? 'block' : 'none', margin: '0 20px 12px', padding: '10px 14px', background: 'rgba(232,92,74,.08)', border: '1px solid rgba(232,92,74,.3)', borderRadius: 'var(--r)', color: '#e85c4a', fontSize: 12 }}>
          {error}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'CLOSE_FINALIZE_MODAL' })}>Cancel</button>
          <button className="btn btn-primary" id="finalize-confirm-btn" onClick={handleConfirm} disabled={confirmDisabled}>
            Confirm + submit →
          </button>
        </div>
      </div>
    </div>
  );
}
