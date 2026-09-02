// ─────────────────────────────────────────────────────────────────────
// WhatIfSlider.jsx — Phase E 5.3. A price slider between the competitive
// and ambitious option amounts, live-recomputing margin / win-likelihood
// band / EV as it moves. Rendered BELOW the option cards (not inside any
// [data-bid-opt] card), so there is no card onClick to propagate to —
// SELECT_AGENT_OPTION can't fire from a slider gesture. stopPropagation()
// on the range and the anchor buttons anyway, defensively.
//
// §5.3 constraint: it must interpolate from the demo response's OWN three
// anchors (interpolateAtBid, src/state/expectedValue.js), never recompute
// independently — otherwise the slider and the cards visibly disagree the
// moment anyone drags it during a pitch. At an anchor value the readout
// equals that option card's figures to the dollar.
//
// Pure local state. Sets nothing on the bid, persists nothing, does not
// feed finalize — exploratory only.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { interpolateAtBid } from '../state/expectedValue.js';

function fmtCost(n) { return '$' + Math.round(n || 0).toLocaleString(); }
function fmtPct(n) { return n == null ? '—' : (+n).toFixed(1) + '%'; }

export default function WhatIfSlider({ options }) {
  const priced = (options || []).filter((o) => o.bidAmount != null && o.margin != null);
  const amounts = priced.map((o) => o.bidAmount).sort((a, b) => a - b);
  const min = amounts[0];
  const max = amounts[amounts.length - 1];
  const rec = priced.find((o) => o.type === 'recommended');
  const [value, setValue] = useState(rec ? rec.bidAmount : min);

  if (priced.length < 2 || min === max) return null;

  const clamped = Math.min(max, Math.max(min, value));
  const at = interpolateAtBid(options, clamped);
  const winText = at.winLabel
    ? at.winLabel
    : '~' + Math.round(at.winBand[0] * 100) + '–' + Math.round(at.winBand[1] * 100) + '%';

  return (
    <div
      className="whatif-slider"
      style={{ marginTop: 18, border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '16px 18px', background: 'var(--surface)' }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
        What-if price
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="whatif-price" style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          {fmtCost(clamped)}
        </span>
        <span className="whatif-margin" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtPct(at.marginPct)} margin</span>
      </div>

      <input
        type="range"
        className="whatif-range"
        min={min}
        max={max}
        step={100}
        value={clamped}
        onChange={(e) => setValue(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%' }}
        aria-label="What-if bid price"
      />

      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        {priced.map((o) => {
          const left = ((o.bidAmount - min) / (max - min)) * 100;
          return (
            <button
              key={o.type}
              type="button"
              className="whatif-anchor"
              data-anchor={o.type}
              title={o.label + ' · ' + fmtCost(o.bidAmount)}
              onClick={(e) => { e.stopPropagation(); setValue(o.bidAmount); }}
              style={{
                position: 'absolute', left: left + '%', transform: 'translateX(-50%)', top: 0,
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap'
              }}
            >
              ▲ {o.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, fontSize: 12 }}>
        <span style={{ color: 'var(--text3)' }}>
          Win likelihood <span className="whatif-win" style={{ color: 'var(--text2)' }}>{winText}</span>
        </span>
        <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          EV <span className="whatif-ev">{at.ev ? fmtCost(at.ev.lo) + '–' + fmtCost(at.ev.hi) : '—'}</span>
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
        Interpolated between the agent's three options — it does not re-run the model. Exploratory only; changes nothing.
      </div>
    </div>
  );
}
