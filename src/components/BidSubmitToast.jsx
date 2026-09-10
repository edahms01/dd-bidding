// ─────────────────────────────────────────────────────────────────────
// BidSubmitToast.jsx — post-finalize confirmation toast. Shell-owned,
// always mounted (same tier as RowUndoToast.jsx / FinalizeModal.jsx).
//
// Replaces js/ui.js's classic-script _showBidToast(). Modelled directly
// on RowUndoToast.jsx: reads a single ui.* field, a setTimeout auto-
// dismiss that clears it via the generic SET_FIELD setter, hard unmount
// (no fade — matches RowUndoToast; the old _showBidToast()'s 400ms fade
// is deliberately dropped). Single-phase: no button-transform stage.
//
// FinalizeModal.jsx sets state.ui.bidSubmitToast AFTER the modal closes
// and Home is showing, so this toast overlays Home, not a page mid-
// transition — which also retires _showBidToast()'s old #agent-finalize-
// btn DOM mutation entirely (the user is no longer on Bid Strategy).
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store.jsx';

// 3000ms visible + the 400ms the old fade covered, collapsed to one
// timer since there's no fade transition to stage (see components.css).
const AUTO_DISMISS_MS = 3400;

// Inline one-liner rather than importing js/ui.js's fmtCost (a classic
// script) into a component — identical formatting to the original.
const fmtCost = (n) => '$' + Math.round(n || 0).toLocaleString();

export default function BidSubmitToast() {
  const [state, dispatch] = useStore();
  const { bidSubmitToast } = state.ui;
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!bidSubmitToast) return;
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_FIELD', path: ['ui', 'bidSubmitToast'], value: null });
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timerRef.current);
  }, [bidSubmitToast, dispatch]);

  if (!bidSubmitToast) return null;

  // id kept for the existing e2e specs that locate the old toast by
  // #bid-submit-toast; `label` is carried in state for signature parity
  // but not rendered (the original _showBidToast() never rendered it).
  return (
    <div id="bid-submit-toast" className="bid-submit-toast">
      Bid submitted: {fmtCost(bidSubmitToast.amount)} logged to history ✓
    </div>
  );
}
