// ─────────────────────────────────────────────────────────────────────
// useUniformRowWidths.js — the production version of the measurement
// script both `.rr-*`/`.tray` design mockups (rates-standardized-
// layout-v4.html / site-conditions-redesign-v2.html) ran against a
// hidden offscreen clone. Here the page's own real rows serve as the
// measurement source directly (useLayoutEffect runs before paint, so
// there's no visible flash) — no offscreen clone needed.
//
// Sets three CSS custom properties on the given container, per design
// doc §7/§8/§16 (`bid-iq-compact-ui-design-system-v2.md`):
//   --sfx-width  — uniform width for every .rr-sfx on this tab
//   --box-width  — uniform width for every .rr-input/.rr-select on this tab
//   --rr-width   — uniform width for every .rr row on this tab
// Each tab computes its own values; the variable *names* never change
// (design doc §16 — this is what "--select-width" drifting from
// "--box-width" was actually about).
//
// MUST measure sequentially — sfx, then box, then row — never batched.
// .rr-sfx is a child of .rr-input, so .rr-input's natural width is only
// correct *after* --sfx-width has already been applied and the browser
// has reflowed. Measuring box-width before (or alongside) sfx-width can
// lock in a box sized for a short suffix, which then overflows once
// every suffix in the column standardizes to the widest one. Same
// dependency again for row-width depending on the now-final box-width.
// This is exactly the class of bug both mockups' own comments describe
// finding and fixing (re-querying after a var was already set;
// measuring one field type and assuming, not checking, it was widest).
// ─────────────────────────────────────────────────────────────────────
import { useLayoutEffect } from 'react';

function maxWidth(root, selector) {
  let max = 0;
  root.querySelectorAll(selector).forEach((el) => {
    const w = el.getBoundingClientRect().width;
    if (w > max) max = w;
  });
  return max;
}

function measure(root) {
  // Pass 1 — suffix chips. Read, then write; nothing downstream has been
  // touched yet, so this read is against fully natural widths.
  const sfxW = maxWidth(root, '.rr-sfx');
  if (sfxW > 0) root.style.setProperty('--sfx-width', Math.ceil(sfxW) + 'px');

  // Pass 2 — input/select boxes. .rr-sfx children have now reflowed to
  // the standardized width from pass 1, so this read reflects that.
  const boxW = maxWidth(root, '.rr-input, .rr-select');
  if (boxW > 0) root.style.setProperty('--box-width', Math.ceil(boxW) + 'px');

  // Pass 3 — whole rows. .rr-input/.rr-select have now reflowed too.
  const rowW = maxWidth(root, '.rr');
  if (rowW > 0) root.style.setProperty('--rr-width', Math.ceil(rowW) + 'px');
}

// Scoped per page (pass that page's own root ref), not app-wide — each
// tab's "every dark box on THIS tab" rule needs its own independent
// measurement, not one shared global width across the whole app.
export function useUniformRowWidths(containerRef) {
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    measure(root);

    // Resize handling the mockups never had to solve (a static demo file
    // has no viewport to resize). Clear the vars first so the remeasure
    // reads natural widths again, not the previous pass's fixed sizes —
    // the same reasoning as the initial mount, applied to a later trigger.
    let raf = null;
    let skippedInitial = false;
    function remeasure() {
      root.style.removeProperty('--sfx-width');
      root.style.removeProperty('--box-width');
      root.style.removeProperty('--rr-width');
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => measure(root));
    }

    const ro = new ResizeObserver(() => {
      // ResizeObserver fires once immediately after observe() with the
      // current size — redundant with the measure() call just above.
      if (!skippedInitial) { skippedInitial = true; return; }
      remeasure();
    });
    ro.observe(root);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef]);
}
