// ─────────────────────────────────────────────────────────────────────
// BidDecisionPage.jsx — Phase C 8.4. A short scoring screen that
// recommends whether to pursue a job at all, deliberately OUTSIDE the
// 9-step bid flow (so it doesn't lengthen it) and reached only from the
// Bids list.
//
// Ephemeral by decision (Q3): the five factor answers are local
// component state, reset to neutral every time the screen becomes
// active. Nothing is persisted, no bid record is touched, and the
// recommendation is derived fresh from the answers on every render.
// Tying decisions to actual outcomes is a recorded Phase F candidate,
// not built here.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';

// Each factor: 'good' = +2, 'ok' = 0, 'bad' = -2. Range -10..+10.
const FACTORS = [
  {
    key: 'fit', label: 'Project fit',
    hint: 'Scope, size, and system types against what Dirigo does well',
    options: [['good', 'Strong fit'], ['ok', 'Workable'], ['bad', 'Outside our lane']]
  },
  {
    key: 'gc', label: 'GC history',
    hint: 'Past experience with this GC: payment, coordination, fairness',
    options: [['good', 'Good history'], ['ok', 'Neutral or unknown'], ['bad', 'Difficult / burned before']]
  },
  {
    key: 'competition', label: 'Competition',
    hint: 'How many others are likely bidding, and how hungry',
    options: [['good', 'Light (1–2)'], ['ok', 'Moderate (3–4)'], ['bad', 'Heavy (5+) / race to the bottom']]
  },
  {
    key: 'capacity', label: 'Crew capacity',
    hint: 'Can we actually staff this in the required window',
    options: [['good', 'Capacity available'], ['ok', 'Tight but doable'], ['bad', 'Fully booked']]
  },
  {
    key: 'schedule', label: 'Schedule risk',
    hint: 'Is the GC schedule realistic for the drywall scope',
    options: [['good', 'Comfortable'], ['ok', 'Tight'], ['bad', 'Unrealistic']]
  }
];

const SCORE = { good: 2, ok: 0, bad: -2 };
const blankAnswers = () => Object.fromEntries(FACTORS.map((f) => [f.key, 'ok']));

function verdict(total) {
  if (total >= 4) return { label: 'Bid', tone: 'good', blurb: 'The signals line up. Pursue this one.' };
  if (total <= -4) return { label: 'Pass', tone: 'bad', blurb: 'Too much working against it. Better to sit this out.' };
  return { label: 'Proceed with caution', tone: 'ok', blurb: 'Mixed signals; bid only if you can price the risk in.' };
}

const TONE = {
  good: { bg: 'rgba(58,191,122,.1)', bd: 'rgba(58,191,122,.3)', fg: 'var(--green)' },
  ok:   { bg: 'var(--status-warn-dim)', bd: 'var(--status-warn-border)', fg: 'var(--status-warn)' },
  bad:  { bg: 'var(--danger-dim)', bd: 'var(--danger-border)', fg: 'var(--danger)' }
};

export default function BidDecisionPage({ active }) {
  const [, dispatch] = useStore();
  const [answers, setAnswers] = useState(blankAnswers);

  // Ephemeral — every fresh visit starts from neutral.
  useEffect(() => {
    if (active) setAnswers(blankAnswers());
  }, [active]);

  const total = FACTORS.reduce((s, f) => s + SCORE[answers[f.key]], 0);
  const v = verdict(total);
  const tone = TONE[v.tone];

  return (
    <div className={'page' + (active ? ' active' : '')} id="page-biddecision" data-noautosave>
      <div className="page-hdr">
        <div>
          <div className="page-title">Bid / no-bid gate</div>
          <div className="page-sub">A quick gut-check before committing estimating time (not part of the bid itself)</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'GOTO_SECTION', section: 'bids' })}>← Back to Bids</button>
        </div>
      </div>

      <div className="grid g2" style={{ maxWidth: 640 }}>
        {FACTORS.map((f) => (
          <div className="field" key={f.key}>
            <span className="lbl">{f.label}</span>
            <select
              id={'bd-' + f.key}
              value={answers[f.key]}
              onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
            >
              {f.options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
            </select>
            <div className="rhint">{f.hint}</div>
          </div>
        ))}
      </div>

      <div
        id="bd-verdict"
        data-verdict={v.label}
        style={{
          marginTop: 28, maxWidth: 640, padding: '18px 20px', borderRadius: 'var(--rl)',
          background: tone.bg, border: '1px solid ' + tone.bd
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: tone.fg }}>{v.label}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{v.blurb}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Score {total >= 0 ? '+' + total : total} of ±10</div>
      </div>
    </div>
  );
}
