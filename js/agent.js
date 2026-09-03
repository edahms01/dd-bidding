// ─────────────────────────────────────────────────────────────────────
// agent.js — Bid decision agent
// All Anthropic API interaction lives here — single swap point for
// future model changes or proxy migration.
//
// Live path (DEMO_MODE = false, or the dual-demo "Load Demo — live
// agent" button): POSTs the business-data payload to the background
// function /.netlify/functions/bid-agent-background and then polls
// /.netlify/functions/bid-agent-result for the outcome. The server holds
// ANTHROPIC_API_KEY, the system prompt, and the forced-tool schema
// (Track A) — the client never sees any of them. It's a background
// function because a full structured-output Sonnet response (~40-45s)
// exceeds Netlify's synchronous HTTP timeout.
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
    { type: 'competitive', label: 'Competitive', bidAmount: null, margin: null, winLikelihood: 'High',        rationale: 'Agent unavailable. Calculate a competitive price manually.' },
    { type: 'recommended', label: 'Recommended', bidAmount: null, margin: null, winLikelihood: 'Medium',      rationale: 'Agent unavailable. Review signals manually.' },
    { type: 'ambitious',   label: 'Ambitious',   bidAmount: null, margin: null, winLikelihood: 'Low–Medium',  rationale: 'Agent unavailable. Calculate an ambitious price manually.' }
  ],
  reasoning:       'Bid agent is temporarily unavailable. Review signals manually.',
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
        rationale:      'Sharpens the number to maximise win probability. Best used when pipeline pressure is high or the GC relationship needs strengthening. Leaves less room for cost overruns; only viable if confidence in the takeoff is solid.'
      },
      {
        type:           'recommended',
        label:          'Recommended',
        bidAmount:      284500,
        margin:         28.4,
        winLikelihood:  deriveWinLikelihood(intel, 'recommended'),
        rationale:      "The agent's best read of this bid given current signals. Callahan Construction Group values quality over lowest price and your relationship is strong, so this margin is defensible. The 8% contingency is appropriate given medium confidence on the takeoff."
      },
      {
        type:           'ambitious',
        label:          'Ambitious',
        bidAmount:      298000,
        margin:         34.1,
        winLikelihood:  deriveWinLikelihood(intel, 'ambitious'),
        rationale:      'Reaches for maximum margin at the cost of win probability. Justified when crews are fully available and pipeline is healthy; a loss here costs nothing. Only viable with a GC who prioritises quality over price, which Callahan does. Worth attempting if Dirigo has recently won other work from this GC.'
      }
    ],

    reasoning: 'Harborview Plaza is a well-defined retail fit-out with manageable complexity. ' +
      'Your direct cost model is solid. The restricted site access and curved feature wall are ' +
      'both captured in conditions and the 12% waste factor is appropriate for a two-level retail ' +
      'scope with exterior exposure. Callahan Construction Group values quality over lowest price ' +
      'and your relationship is strong, which makes the Recommended or Ambitious options both viable. ' +
      'There is no strategic reason to sharpen the pencil unless pipeline pressure increases.',

    signals: [
      {
        label:  'GC relationship',
        value:  'Strong',
        status: 'positive',
        note:   'Callahan has awarded Dirigo work before. Relationship is an asset here, so price accordingly.'
      },
      {
        label:  'GC price sensitivity',
        value:  'Balanced',
        status: 'positive',
        note:   'Not a lowest-price-wins GC. Quality and reliability factor into their decision.'
      },
      {
        label:  'Competition level',
        value:  'Moderate, 3–4 bidders',
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
        note:   'Overall material pricing is stable, but 2-1/2" stud and Type-X board are individually flagged with a 5% rate escalation on this bid: estimator judgment on specific commodity risk, not a blanket markup.'
      },
      {
        label:  "Dirigo's edge",
        value:  'Strong, best fit',
        status: 'positive',
        note:   'Retail fit-out with plaster feature elements and exterior exposure plays to Dirigo strengths.'
      },
      {
        label:  'Estimator confidence',
        value:  'Medium',
        status: 'warning',
        note:   'Medium confidence noted. The 8% contingency is appropriate; do not reduce it before reviewing the Level 2 ceiling quantities.'
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
        message:  'Exterior exposure on Level 1 feature wall adds weatherproofing requirements. Verify spec section with GC; moisture-resistant assembly W3 may need additional waterproofing membrane not currently in scope.'
      },
      {
        severity: 'low',
        message:  'Start date is 90 days out. A 5% escalation is already flagged on 2-1/2" stud pricing; confirm it still tracks current supplier quotes before locking them in.'
      },
      {
        severity: 'low',
        message:  'No historical win/loss data for Callahan Construction Group yet. Recommendation is based on current signals only. Log the outcome of this bid to build GC-specific intelligence over time.'
      }
    ],

    historicalNotes: [
      'No previous bids logged against Callahan Construction Group. After this bid is submitted and the outcome is known, that data will inform future recommendations for this GC.',
      'No completed retail projects in bid history yet. Cost variance tracking (how closely your estimate matched actual job cost) will appear here after your first retail job closes.',
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
    history: bidHistory
    // No `schema` key — the server-side function attaches the forced
    // recommendation tool (Track A). Same request for the dual-demo live
    // button and the real product path — same model, same everything.
  };

  // Async flow: a full structured-output Sonnet 4.6 response takes
  // ~40-45s, and Netlify's *synchronous* function HTTP path cuts off
  // around ~26-30s → 504. So we kick a background function (15-min
  // limit, returns 202 immediately) that writes its result to a Blobs
  // store, and poll bid-agent-result for it. See
  // netlify/functions/bid-agent-background.js.
  const jobId = _agentJobId();
  try {
    const kick = await fetch('/.netlify/functions/bid-agent-background', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(Object.assign({ jobId: jobId }, payload))
    });
    // Background functions answer 202 with an empty body. Anything that
    // isn't 2xx means the invocation itself failed.
    if (!kick.ok && kick.status !== 202) {
      return _liveFallback('could not start the bid agent (HTTP ' + kick.status + ')');
    }

    const POLL_MS     = 2000;
    const MAX_WAIT_MS = 120000; // Anthropic ~45s + Blobs lag + margin
    const deadline    = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_MS));
      let rec;
      try {
        const pr = await fetch('/.netlify/functions/bid-agent-result?id=' + encodeURIComponent(jobId), { cache: 'no-store' });
        if (!pr.ok) continue;           // transient — keep polling
        rec = await pr.json();
      } catch (e) {
        continue;                        // transient network — keep polling
      }
      if (rec && rec.status === 'done' && rec.recommendation) return rec.recommendation;
      if (rec && rec.status === 'error') return _liveFallback(rec.error || 'the bid agent reported an error');
      // 'pending' (or an absent record) → keep polling
    }
    return _liveFallback('timed out after ' + (MAX_WAIT_MS / 1000) + 's waiting for the bid agent');
  } catch (e) {
    console.error('Bid agent (async) error:', e);
    return _liveFallback('network error: ' + (e && e.message ? e.message : 'request failed'));
  }
}

// Opaque per-call id for the async bid-agent job (client-generated, used
// as the Blobs key the background function writes to and the poll reads).
function _agentJobId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'job-' + crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// A recommendation-shaped fallback tagged with `_liveError` so the
// dual-demo toolbar (data/seed.js) shows an explicit failure instead of
// letting AGENT_FALLBACK read as a quiet, degraded recommendation.
function _liveFallback(reason) {
  return Object.assign({}, AGENT_FALLBACK, { _liveError: reason });
}
