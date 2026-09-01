// ─────────────────────────────────────────────────────────────────────
// BidTotalRail.jsx — 4.1, persistent bid-total rail. First component in
// src/components/ (previously every custom component lived directly
// under src/pages/) — shell-owned and always mounted, same pattern as
// FinalizeModal.jsx, not tied to any one page.
//
// Reads state.ui.output directly, the same object OutputPage.jsx's
// Phase3/Phase4 already render — no new calculation path, just a second,
// persistent place to show numbers 4.2's reactive calculation already
// keeps fresh. Rendered from AppShell.jsx, gated to the tabs where a
// takeoff number is actually meaningful (Assemblies onward — not
// Project/Conditions/Rates, which either precede any takeoff data or
// already have their own totals display, see RatesPage.jsx).
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }

export default function BidTotalRail({ output }) {
  const prevRef = useRef(null);
  const [flash, setFlash] = useState(false);

  // Flash on change — pure React state, no DOM-read conflict (unlike the
  // takeoff row fields, output is already React-owned via state.ui.output,
  // kept live by 4.2's reactive calculation). Skips the flash on the very
  // first value (nothing to compare against yet) and on any transition to
  // /from null (output not yet computed, not a "the number changed" event).
  useEffect(() => {
    const next = output?.markupResult?.finalBidPrice ?? null;
    const prev = prevRef.current;
    prevRef.current = next;
    if (prev == null || next == null || next === prev) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [output]);

  if (!output) {
    return (
      <div className="bid-total-rail">
        <div className="total-item"><div className="total-val">—</div><div className="total-lbl">Direct cost</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">—</div><div className="total-lbl">Markup</div></div>
        <div className="total-div" />
        <div className="total-item"><div className="total-val">—</div><div className="total-lbl">Bid price</div></div>
      </div>
    );
  }

  const { summary, markupResult } = output;
  return (
    <div className={'bid-total-rail' + (flash ? ' flash' : '')}>
      <div className="total-item"><div className="total-val">{fmtCost(summary.directCostTotal)}</div><div className="total-lbl">Direct cost</div></div>
      <div className="total-div" />
      <div className="total-item"><div className="total-val">{fmtCost(markupResult.totalMarkup)}</div><div className="total-lbl">Markup</div></div>
      <div className="total-div" />
      <div className="total-item"><div className="total-val green">{fmtCost(markupResult.finalBidPrice)}</div><div className="total-lbl">Bid price</div></div>
    </div>
  );
}
