// ─────────────────────────────────────────────────────────────────────
// TabConfirmButton.jsx — the "Finished with this tab" / "Reviewed" button
// that drives the manual tab-confirmation model (see stepStatus.js).
//
// One shared component, rendered as the first child of each input page's
// .page-actions. Bid Strategy has no button; every other workflow tab
// does (Cost Summary says "Reviewed", it has no inputs of its own).
//
// Clicking confirms the tab and stores a snapshot of its owned bid slice;
// clicking again un-confirms. The tab reverts to amber on its own when
// the live slice stops matching the snapshot — nothing here watches for
// that, stepStatus.js's tabStatus() just recomputes every render.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { ownedSliceJSON, tabEligible, tabStatus } from '../state/stepStatus.js';

export default function TabConfirmButton({ tab }) {
  const [state, dispatch] = useStore();

  // A bare dispatch fires no native DOM event, so the .workflow-area
  // autosave listener never sees it — trigger a save explicitly, one
  // render later so collectFormData()'s window.__getTabConfirmations()
  // read lands on committed state (RatesPage's needsImmediateSave
  // precedent). Deliberately NOT a blanket state.bid.tabConfirmations
  // watcher in AppShell: a write side effect can't tell a user click
  // from a hydration/reset and would fight those flows (CLAUDE.md).
  const [pendingSave, setPendingSave] = useState(0);
  useEffect(() => {
    if (pendingSave) window._autosave?.();
  }, [pendingSave]);

  const conf = state.bid.tabConfirmations[tab];
  const sliceJSON = ownedSliceJSON(tab, state);
  const eligible = tabEligible(tab, state);
  const status = tabStatus(sliceJSON, conf, eligible); // 'empty' | 'partial' | 'complete'

  const verb = tab === 'output' ? 'Reviewed' : 'Finished with this tab';
  const label = status === 'complete' ? '✓ ' + verb : verb;

  function toggle() {
    const on = status === 'complete';
    dispatch({
      type: 'SET_TAB_CONFIRMATION',
      tab,
      confirmed: !on,
      snapshot: on ? null : sliceJSON
    });
    setPendingSave((n) => n + 1);
  }

  return (
    <button
      type="button"
      className={'btn btn-sm tab-confirm-btn' + (status === 'complete' ? ' confirmed' : '')}
      disabled={status !== 'complete' && !eligible}
      onClick={toggle}
    >
      {label}
    </button>
  );
}
