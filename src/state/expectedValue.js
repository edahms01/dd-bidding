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
