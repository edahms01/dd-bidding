// ─────────────────────────────────────────────────────────────────────
// RowUndoToast.jsx — 3.5, undo-on-delete. Shell-owned, always mounted
// (same pattern as FinalizeModal.jsx), not tied to any one page — a row
// can be deleted from Assemblies, Walls, or Ceilings, and this shows
// regardless of which is currently active.
//
// Deliberately a NEW component rather than an extension of js/forms.js's
// _showFormToast()/js/ui.js's _showBidToast() — both are generic
// fire-and-forget message toasts used by several unrelated callers;
// retrofitting an action button onto either risks regressing those
// call sites for a feature specific to this one.
//
// Toast, not a confirm dialog, per the decision record: "deleting a bid
// record asks for confirmation; deleting a takeoff row after 40 minutes
// of entry does not — inverted risk... confirms on repetitive actions
// get click-throughed within a day."
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store.jsx';

const AUTO_DISMISS_MS = 6000;

const SECTION_LABEL = { assemblies: 'assembly', walls: 'wall row', ceilings: 'ceiling row' };

export default function RowUndoToast() {
  const [state, dispatch] = useStore();
  const { rowUndo } = state.ui;
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!rowUndo) return;
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_FIELD', path: ['ui', 'rowUndo'], value: null });
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timerRef.current);
  }, [rowUndo, dispatch]);

  if (!rowUndo) return null;

  return (
    <div className="row-undo-toast">
      <span>Deleted {SECTION_LABEL[rowUndo.section] || 'row'}.</span>
      <button
        className="row-undo-toast-btn"
        onClick={() => {
          clearTimeout(timerRef.current);
          dispatch({ type: 'UNDO_DELETE_ROW' });
          // 3.5 — plain reducer dispatch, not a native DOM event; see
          // AppShell.jsx's reactive-calc effect comment for why autosave
          // is fixed per-action here, not with a blanket watcher.
          window._handleFormChange?.();
        }}
      >
        Undo
      </button>
    </div>
  );
}
