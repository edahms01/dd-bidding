// ─────────────────────────────────────────────────────────────────────
// expectedValue.js — Phase E 5.1. Expected value per agent option:
// P(win) × margin$, rendered as a RANGE with a visible caveat, never a
// false-precision point value.
//
// Honesty constraint (docs/dirigo-ux-decisions.md §5.1): deriveWinLikelihood()
// (js/agent.js) is a hand-tuned integer score with zero calibrated bid
// outcomes behind it yet — it is not a probability. So P(win) is a wide
// band per likelihood label (Q2 = A, decided with Eric), and the band
// width itself is the signal that EV is directional. Do not narrow these
// without real win/loss data to calibrate against.
//
// Shared by AgentPage.jsx's option cards (5.1) and WhatIfSlider.jsx (5.3,
// Step 4) so the slider's endpoints reproduce each option card's own EV
// exactly.
// ─────────────────────────────────────────────────────────────────────

export const WIN_LIKELIHOOD_BANDS = {
  'Very High':  [0.70, 0.90],
  'High':       [0.55, 0.75],
  'Medium':     [0.40, 0.60],
  'Low–Medium': [0.25, 0.45],
  'Low':        [0.10, 0.30]
};

export function winProbBand(label) {
  return WIN_LIKELIHOOD_BANDS[label] || null;
}

// margin$ if the bid wins. opt.margin is a percent of the bid amount
// (matches how the option cards already display "{margin}% margin").
export function marginDollars(opt) {
  if (!opt || opt.bidAmount == null || opt.margin == null) return null;
  return opt.bidAmount * (opt.margin / 100);
}

// EV range = P(win) band × margin$. Returns { lo, hi } or null when the
// likelihood label is unrecognised or the option lacks amount/margin.
export function expectedValueRange(opt, likelihoodLabel) {
  const band = winProbBand(likelihoodLabel);
  const m = marginDollars(opt);
  if (!band || m == null) return null;
  return { lo: band[0] * m, hi: band[1] * m };
}

function lerp(a, b, t) { return a + (b - a) * t; }

// 5.3 — interpolate margin% / P(win) band / EV at an arbitrary bid amount
// `x`, strictly from the demo response's own three option anchors — NOT an
// independent recompute. The §5.3 constraint: the slider and the option
// cards must not visibly disagree at the endpoints during a pitch. So when
// `x` is exactly an anchor's bidAmount, that anchor's own figures are
// returned verbatim (no lerp), making the endpoint match dollar-exact
// regardless of float error; between anchors, margin% and the band
// endpoints are linearly interpolated between the two bracketing anchors.
//
// Returns { bidAmount, marginPct, winBand:[lo,hi], winLabel|null,
// marginDollars, ev:{lo,hi} } or null with fewer than one usable anchor.
export function interpolateAtBid(options, x) {
  const anchors = (options || [])
    .filter((o) => o.bidAmount != null && o.margin != null)
    .slice()
    .sort((a, b) => a.bidAmount - b.bidAmount);
  if (anchors.length === 0) return null;

  const exact = anchors.find((a) => a.bidAmount === x);
  if (exact) {
    return {
      bidAmount: x,
      marginPct: exact.margin,
      winBand: winProbBand(exact.winLikelihood),
      winLabel: exact.winLikelihood,
      marginDollars: marginDollars(exact),
      ev: expectedValueRange(exact, exact.winLikelihood)
    };
  }

  const min = anchors[0].bidAmount;
  const max = anchors[anchors.length - 1].bidAmount;
  const xc = Math.min(max, Math.max(min, x));

  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (xc >= anchors[i].bidAmount && xc <= anchors[i + 1].bidAmount) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
  }
  const span = hi.bidAmount - lo.bidAmount;
  const t = span > 0 ? (xc - lo.bidAmount) / span : 0;

  const marginPct = lerp(lo.margin, hi.margin, t);
  const loBand = winProbBand(lo.winLikelihood) || [0, 0];
  const hiBand = winProbBand(hi.winLikelihood) || [0, 0];
  const winBand = [lerp(loBand[0], hiBand[0], t), lerp(loBand[1], hiBand[1], t)];
  const m = xc * (marginPct / 100);

  return {
    bidAmount: xc,
    marginPct,
    winBand,
    winLabel: null,
    marginDollars: m,
    ev: { lo: winBand[0] * m, hi: winBand[1] * m }
  };
}
