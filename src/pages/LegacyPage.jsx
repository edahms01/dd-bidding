// ─────────────────────────────────────────────────────────────────────
// LegacyPage.jsx — coexistence wrapper for not-yet-converted pages.
//
// Clones the page's exact existing static markup (kept in a <template>
// in index.html — see LEGACY_TEMPLATE_IDS below) into this component's
// DOM once, via a ref, on first mount — then never touches it again.
// This element's JSX never describes children (always `<div ref={...}>`
// with nothing inside), so React's reconciler has nothing to diff for
// this subtree on any subsequent render, no matter why AppShell
// re-rendered. The old vanilla scripts (populateForm(), addAsm(), calc(),
// etc.) go on reading/writing this DOM exactly as they did before
// AppShell existed.
//
// Only `active` (→ the `page`/`page active` className) is React-owned
// and re-rendered normally — that's an intentional, safe update; see
// the spike report for the empirical test proving the children stay
// untouched when this happens.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';

export default function LegacyPage({ id, active }) {
  const ref = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const tpl = document.getElementById('legacy-tpl-' + id);
    if (tpl && ref.current) {
      ref.current.appendChild(tpl.content.cloneNode(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={'page' + (active ? ' active' : '')} id={'page-' + id} ref={ref} />
  );
}
