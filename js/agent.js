// ─────────────────────────────────────────────────────────────────────
// agent.js — Bid decision agent
// All Anthropic API interaction lives here — single swap point for
// future model changes or proxy migration.
//
// Live path (DEMO_MODE = false): POSTs the business-data payload to
// /.netlify/functions/bid-agent, which holds ANTHROPIC_API_KEY, the
// system prompt, and the response schema server-side (Track A). The
// client never sees the key, the prompt, or the schema.
// ─────────────────────────────────────────────────────────────────────

// Set to false to enable live Anthropic API calls (via the server-side proxy).
const DEMO_MODE = true;

// Dual demo mode — a load-time, session-only override of DEMO_MODE for the
// "Load Demo — live agent" dev-toolbar button. When true, runBidAgent()
// takes the live /.netlify/functions/bid-agent path even though DEMO_MODE
// is still true. Deliberately NOT persisted (not on the bid record, not in
// drafts) and reset to false by every offline "Load Demo" load — it exists
// only so the real Anthropic connection can be exercised from the running
// app. Session-sticky by design: once on, later recalcs / Tab 7-8 visits
// in that session also call live (the confirm() gate is on the button, not
// on every downstream call). See data/seed.js's _loadDemo().
let liveAgentMode = false;
if (typeof window !== 'undefined') {
  // Guarded per CLAUDE.md checklist item 9 — tests/unit/*.test.js import
  // sibling classic scripts under Vitest's node env, no window.
  window.__setLiveAgentMode = function (on) { liveAgentMode = !!on; };
  window.__getLiveAgentMode = function () { return liveAgentMode; };
}

const AGENT_FALLBACK = {
  options: [
    { type: 'competitive', label: 'Competitive', bidAmount: null, margin: null, winLikelihood: 'High',        rationale: 'Agent unavailable — calculate a competitive price manually.' },
    { type: 'recommended', label: 'Recommended', bidAmount: null, margin: null, winLikelihood: 'Medium',      rationale: 'Agent unavailable — review signals manually.' },
    { type: 'ambitious',   label: 'Ambitious',   bidAmount: null, margin: null, winLikelihood: 'Low–Medium',  rationale: 'Agent unavailable — calculate an ambitious price manually.' }
  ],
  reasoning:       'Bid agent is temporarily unavailable — review signals manually.',
  signals:         [],
  riskFlags:       [{ severity: 'high', message: 'Could not reach the bid agent. Submit your bid based on your own judgment.' }],
  historicalNotes: []
};

// Derives win likelihood from intelligence signals + option type.
// Used in demo mode; live API returns winLikelihood directly.
//
// Phase E 5.2 — the scoring is now expressed as a data table so the same
// single source of truth can also produce a per-factor *breakdown* (which
// of the four signals pushed this option's likelihood up or down, and by
// how much) for the win-likelihood attribution UI. deriveWinLikelihood()
// stays as the thin label-only wrapper every existing caller uses
// (_demoResponse(), any future live path) — behaviour is identical, this
// is a refactor, not a change.
var _WIN_LIKELIHOOD_BASE = { competitive: 2, recommended: 0, ambitious: -2 };

// One entry per contributing signal, in the order the attribution UI
// shows them. `deltas` maps each recognised intelligence value to its
// score adjustment; any other value (incl. unset) contributes 0.
var _WIN_LIKELIHOOD_FACTORS = [
  { key: 'gcRelationship',     label: 'GC relationship',      deltas: { strong: 1, new: -1, difficult: -2 } },
  { key: 'gcPriceSensitivity', label: 'GC price sensitivity', deltas: { lowest: -2, quality: 1 } },
  { key: 'competitionLevel',   label: 'Competition level',    deltas: { light: 2, heavy: -2 } },
  { key: 'dirigoEdge',         label: "Dirigo's edge",        deltas: { strong: 1, weak: -2 } }
];

function _winLikelihoodLabel(score) {
  if (score >= 4)  return 'Very High';
  if (score >= 2)  return 'High';
  if (score >= 0)  return 'Medium';
  if (score >= -2) return 'Low–Medium';
  return 'Low';
}

// { label, score, base, optionType, contributions: [{ factor, value,
// delta, direction }] }. Same arithmetic the original if-chain did — the
// factor values are mutually exclusive per signal, so a table lookup and
// the chain produce identical scores.
function deriveWinLikelihoodBreakdown(intelligence, optionType) {
  var intel = intelligence || {};
  var base = _WIN_LIKELIHOOD_BASE[optionType] || 0;
  var score = base;
  var contributions = _WIN_LIKELIHOOD_FACTORS.map(function (f) {
    var value = intel[f.key] != null && intel[f.key] !== '' ? intel[f.key] : null;
    var delta = value != null && f.deltas[value] != null ? f.deltas[value] : 0;
    score += delta;
    return {
      factor: f.label,
      value: value,
      delta: delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
    };
  });
  return { label: _winLikelihoodLabel(score), score: score, base: base, optionType: optionType, contributions: contributions };
}

function deriveWinLikelihood(intelligence, optionType) {
  return deriveWinLikelihoodBreakdown(intelligence, optionType).label;
}

// Phase E 5.2 — read-only accessor for AgentPage.jsx's win-likelihood
// attribution. Guarded per CLAUDE.md checklist item 9 (a top-level
// window.X assignment must not throw if this file is ever imported in a
// no-window context).
if (typeof window !== 'undefined') {
  window.__winLikelihoodBreakdown = deriveWinLikelihoodBreakdown;
}

// Fixed demo response for the Harborview Plaza retail project (seed dataset).
// winLikelihood is derived dynamically from state.intelligence via deriveWinLikelihood().
// Set DEMO_MODE = false to use live Anthropic API.
function _demoResponse(state, summary, markupResult, bidHistory) {
  const intel = state.intelligence || {};
  return {
    options: [
      {
        type:           'competitive',
        label:          'Competitive',
        bidAmount:      271000,
        margin:         22.4,
        winLikelihood:  deriveWinLikelihood(intel, 'competitive'),
        rationale:      'Sharpens the number to maximise win probability. Best used when pipeline pressure is high or the GC relationship needs strengthening. Leaves less room for cost overruns — only viable if confidence in the takeoff is solid.'
      },
      {
        type:           'recommended',
        label:          'Recommended',
        bidAmount:      284500,
        margin:         28.4,
        winLikelihood:  deriveWinLikelihood(intel, 'recommended'),
        rationale:      "The agent's best read of this bid given current signals. Callahan Construction Group values quality over lowest price and your relationship is strong — this margin is defensible. The 8% contingency is appropriate given medium confidence on the takeoff."
      },
      {
        type:           'ambitious',
        label:          'Ambitious',
        bidAmount:      298000,
        margin:         34.1,
        winLikelihood:  deriveWinLikelihood(intel, 'ambitious'),
        rationale:      'Reaches for maximum margin at the cost of win probability. Justified when crews are fully available and pipeline is healthy — a loss here costs nothing. Only viable with a GC who prioritises quality over price, which Callahan does. Worth attempting if Dirigo has recently won other work from this GC.'
      }
    ],

    reasoning: 'Harborview Plaza is a well-defined retail fit-out with manageable complexity. ' +
      'Your direct cost model is solid — the restricted site access and curved feature wall are ' +
      'both captured in conditions and the 12% waste factor is appropriate for a two-level retail ' +
      'scope with exterior exposure. Callahan Construction Group values quality over lowest price ' +
      'and your relationship is strong, which makes the Recommended or Ambitious options both viable. ' +
      'There is no strategic reason to sharpen the pencil unless pipeline pressure increases.',

    signals: [
      {
        label:  'GC relationship',
        value:  'Strong',
        status: 'positive',
        note:   'Callahan has awarded Dirigo work before. Relationship is an asset here — price accordingly.'
      },
      {
        label:  'GC price sensitivity',
        value:  'Balanced',
        status: 'positive',
        note:   'Not a lowest-price-wins GC. Quality and reliability factor into their decision.'
      },
      {
        label:  'Competition level',
        value:  'Moderate — 3–4 bidders',
        status: 'neutral',
        note:   'Summit Drywall and Northeast Interiors are standard competition for this scope. Neither is known to significantly undercut on retail work.'
      },
      {
        label:  'Crew availability',
        value:  'Fully available',
        status: 'positive',
        note:   'No scheduling pressure. Dirigo can commit to this timeline without risk of overextension.'
      },
      {
        label:  'Pipeline pressure',
        value:  'Neutral',
        status: 'neutral',
        note:   'No urgency to win at reduced margin. Bid for profit, not volume.'
      },
      {
        label:  'Material price trend',
        value:  'Stable',
        status: 'positive',
        note:   'Overall material pricing is stable, but 2-1/2" stud and Type-X board are individually flagged with a 5% rate escalation on this bid — estimator judgment on specific commodity risk, not a blanket markup.'
      },
      {
        label:  "Dirigo's edge",
        value:  'Strong — best fit',
        status: 'positive',
        note:   'Retail fit-out with plaster feature elements and exterior exposure plays to Dirigo strengths.'
      },
      {
        label:  'Estimator confidence',
        value:  'Medium',
        status: 'warning',
        note:   'Medium confidence noted. The 8% contingency is appropriate — do not reduce it before reviewing the Level 2 ceiling quantities.'
      }
    ],

    riskFlags: [
      {
        severity: 'medium',
        message:  'Curved feature wall at main entrance (45 LF) is priced into conditions but should be field-verified before bid submission. Curved work on retail often expands in scope during execution.'
      },
      {
        severity: 'medium',
        message:  'Restricted site access and no dedicated parking will affect delivery scheduling. Confirm unloading window and loading dock availability with Callahan before finalizing the 6-trip delivery estimate.'
      },
      {
        severity: 'medium',
        message:  'Exterior exposure on Level 1 feature wall adds weatherproofing requirements. Verify spec section with GC — moisture-resistant assembly W3 may need additional waterproofing membrane not currently in scope.'
      },
      {
        severity: 'low',
        message:  'Start date is 90 days out. A 5% escalation is already flagged on 2-1/2" stud pricing — confirm it still tracks current supplier quotes before locking them in.'
      },
      {
        severity: 'low',
        message:  'No historical win/loss data for Callahan Construction Group yet. Recommendation is based on current signals only. Log the outcome of this bid to build GC-specific intelligence over time.'
      }
    ],

    historicalNotes: [
      'No previous bids logged against Callahan Construction Group. After this bid is submitted and the outcome is known, that data will inform future recommendations for this GC.',
      'No completed retail projects in bid history yet. Cost variance tracking — how closely your estimate matched actual job cost — will appear here after your first retail job closes.',
      'Tip: the more bids you log with outcomes, the more precisely the agent can identify which GC relationships, building types, and markup levels produce the best win rates for Dirigo.'
    ]
  };
}

async function runBidAgent(state, summary, markupResult, bidHistory) {
  if (DEMO_MODE && !liveAgentMode) {
    await new Promise(r => setTimeout(r, 900));
    return _demoResponse(state, summary, markupResult, bidHistory);
  }

  const payload = {
    project: {
      name:         state.project.name,
      gc:           state.project.gc,
      buildingType: state.project.buildingType,
      startDate:    state.project.startDate,
      bidDate:      state.project.bidDate
    },
    costs: {
      directCost:      Math.round(summary.directCostTotal),
      overhead:        Math.round(markupResult.overhead),
      contingency:     Math.round(markupResult.contingency),
      profit:          Math.round(markupResult.profit),
      totalMarkup:     Math.round(markupResult.totalMarkup),
      finalBidPrice:   Math.round(markupResult.finalBidPrice),
      effectiveMargin: +markupResult.effectiveMargin.toFixed(1)
    },
    conditions: {
      confidence:    state.conditions.confidence,
      wastePct:      state.conditions.wastePct,
      sfAbove12:     state.conditions.sfAbove12,
      sfAbove20:     state.conditions.sfAbove20,
      durationWeeks: state.conditions.durationWeeks
    },
    intelligence: state.intelligence,
    history: bidHistory,
    // No `schema` key — the server-side function injects it (Track A).
    //
    // `demoProbe` tells the function this call came from the dual-demo
    // "Load Demo — live agent" button (a connection test), not the real
    // product path. The function uses a faster model for a probe so the
    // round trip stays well under Netlify's ~26s synchronous HTTP cliff
    // (Sonnet 4.6 here runs ~26-33s and 504s intermittently). The real
    // path — DEMO_MODE=false without liveAgentMode — never sets this and
    // stays on Sonnet.
    demoProbe: liveAgentMode
  };

  try {
    const resp = await fetch('/.netlify/functions/bid-agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('Bid agent API error:', resp.status, err);
      if (err.error === 'not_configured') {
        return Object.assign({}, AGENT_FALLBACK, {
          reasoning: 'Bid agent is not configured on the server — contact your administrator.',
          riskFlags: [{ severity: 'high', message: 'Bid agent not configured. Submit your bid based on your own judgment.' }],
          // Distinguishes a failed *live* call from a genuine result so the
          // dual-demo toolbar can show an explicit error state instead of
          // letting AGENT_FALLBACK read as a quiet, degraded recommendation.
          _liveError: 'not configured on the server (missing/invalid ANTHROPIC_API_KEY)'
        });
      }
      return Object.assign({}, AGENT_FALLBACK, { _liveError: 'HTTP ' + resp.status + (err && err.error ? ' (' + err.error + ')' : '') });
    }

    return await resp.json();
  } catch (e) {
    console.error('Bid agent error:', e);
    return Object.assign({}, AGENT_FALLBACK, { _liveError: 'network error — ' + (e && e.message ? e.message : 'request failed') });
  }
}
