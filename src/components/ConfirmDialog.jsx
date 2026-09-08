// ─────────────────────────────────────────────────────────────────────
// ConfirmDialog.jsx — an in-page confirm() replacement.
//
// ConfirmDialog is the presentational modal. It reuses .modal-overlay /
// .modal / .modal-header / .modal-title / .modal-footer from
// components.css (FinalizeModal.jsx's styling — no new overlay CSS, just
// one .modal-message body class), and mirrors FinalizeModal's
// always-mounted / .open-class-driven visibility so the fade/slide
// transition works.
//
// ConfirmHost is the single always-mounted instance plus the
// classic-script bridge: data/seed.js's loadDemoLive() awaits
//   const ok = await window.__confirm(title, message)
// in place of the native confirm() that a CDP-based browser-automation
// tool (Claude's included) can't see or dismiss — every attempt hangs
// the tab. Same stop-and-confirm UX before a billable live-agent call,
// fully clickable by automation.
//
// Registered via registerConfirmBridge() (bridges.js) from a mount
// effect, same shape as registerDemoConfirmAllTabs(). Promise-returning,
// unlike the other bridges: the resolver is stashed in a ref and called
// by the dialog's Continue / Cancel buttons.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { registerConfirmBridge } from '../state/bridges.js';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Focus the safe default (Cancel) on open — the always-mounted modal
    // means a bare autoFocus attribute would steal focus at page load
    // instead, so it's an on-open effect rather than markup.
    cancelRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // The current confirm() text uses blank lines for readability — keep
  // that as real paragraphs rather than collapsing to one block.
  const paragraphs = String(message || '').split('\n\n');

  return (
    <div
      className={'modal-overlay' + (open ? ' open' : '')}
      id="confirm-dialog-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="modal-header">
          <div className="modal-title" id="confirm-dialog-title">{title}</div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        {paragraphs.map((p, i) => (
          <p key={i} className="modal-message">{p}</p>
        ))}
        <div className="modal-footer">
          <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmHost() {
  const [dlg, setDlg] = useState(null); // { title, message } while open, else null
  const resolverRef = useRef(null);

  useEffect(() => {
    registerConfirmBridge((title, message) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setDlg({ title, message });
      })
    );
  }, []);

  function settle(result) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDlg(null);
    resolve?.(result);
  }

  return (
    <ConfirmDialog
      open={!!dlg}
      title={dlg?.title}
      message={dlg?.message}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
