// ─────────────────────────────────────────────────────────────────────
// agent.js — Bid decision agent
// All Anthropic API interaction lives here — single swap point for
// future model changes or proxy migration.
//
// Live path (DEMO_MODE false — i.e. running on the production host):
// POSTs the business-data payload to the background
// function /.netlify/functions/bid-agent-background and then polls
// /.netlify/functions/bid-agent-result for the outcome. The server holds
// ANTHROPIC_API_KEY, the system prompt, and the forced-tool schema
// (Track A) — the client never sees any of them. It's a background
// function because a full structured-output Sonnet response (~40-45s)
// exceeds Netlify's synchronous HTTP timeout.
// ─────────────────────────────────────────────────────────────────────

// Live Anthropic calls (via the server-side proxy) run in production only.
// Demo everywhere else — deploy previews / branch deploys
// (deploy-preview-N--bid-iq.netlify.app etc.), localhost, and Vitest's node
// env (no `location`, hence the same `typeof` guard the window.* bridges use
// below). If the production host ever changes, update the hostname here.
const DEMO_MODE =
  typeof location === 'undefined' || location.hostname !== 'bid-iq.netlify.app';

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

// Fixed demo response for the Harborview Plaza retail project (seed dataset).
// Every field here is a fixed literal, winLikelihood included — the live
// Anthropic path (production only; see DEMO_MODE at the top of this file)
// returns winLikelihood and the per-option `factors` breakdown directly.
// The old client-side win-likelihood scoring table was removed once the
// live model reported its own factors — it never had any connection to
// what the real model actually reasoned.
function _demoResponse(state, summary, markupResult, bidHistory) {
  return {
    options: [
      {
        type:           'competitive',
        label:          'Competitive',
        bidAmount:      271000,
        margin:         22.4,
        winLikelihood:  'Very High',
        rationale:      'Sharpens the number to maximise win probability. Best used when pipeline pressure is high or the GC relationship needs strengthening. Leaves less room for cost overruns; only viable if confidence in the takeoff is solid.',
        factors: [
          { label: 'Strong relationship with Callahan', direction: 'positive', note: 'Callahan has awarded Dirigo work before and values quality over lowest price, so a sharpened number lands with an already-favourable GC.' },
          { label: 'Priced below the takeoff risk', direction: 'positive', note: 'At 22.4% margin this sits well under the Recommended option, leaving the widest gap against competitors on a scope that plays to Dirigo strengths.' },
          { label: 'Thin cushion for the curved feature wall', direction: 'negative', note: "The curved wall is captured in conditions but carries more execution risk than a standard fit-out, and this margin leaves the least room to absorb an overrun." }
        ]
      },
      {
        type:           'recommended',
        label:          'Recommended',
        bidAmount:      284500,
        margin:         28.4,
        winLikelihood:  'High',
        rationale:      "The agent's best read of this bid given current signals. Callahan Construction Group values quality over lowest price and your relationship is strong, so this margin is defensible. The 8% contingency is appropriate given medium confidence on the takeoff.",
        factors: [
          { label: 'Strong relationship with Callahan', direction: 'positive', note: 'Callahan values quality over lowest price and the relationship here is strong — less pressure to sharpen the number.' },
          { label: 'Curved feature wall adds real risk', direction: 'negative', note: "It's captured in conditions, but curved-wall work carries more execution risk than a standard retail fit-out." },
          { label: 'Medium takeoff confidence', direction: 'neutral', note: 'The 8% contingency built into this option is appropriate given medium confidence on the takeoff, not high.' }
        ]
      },
      {
        type:           'ambitious',
        label:          'Ambitious',
        bidAmount:      298000,
        margin:         34.1,
        winLikelihood:  'Medium',
        rationale:      'Reaches for maximum margin at the cost of win probability. Justified when crews are fully available and pipeline is healthy; a loss here costs nothing. Only viable with a GC who prioritises quality over price, which Callahan does. Worth attempting if Dirigo has recently won other work from this GC.',
        factors: [
          { label: 'Reaches past the winnable range', direction: 'negative', note: 'At 34.1% margin this is roughly 12 points above the Recommended option, trading win probability for upside on a competitively-bid retail job.' },
          { label: 'Quality-focused GC softens the downside', direction: 'positive', note: 'Callahan weighs quality and reliability, not just price, so a higher number is not dismissed outright the way a lowest-price GC would.' },
          { label: 'No pipeline pressure to win this one', direction: 'neutral', note: 'Crews are fully available and pipeline pressure is neutral, so a loss at this margin costs nothing and the reach is low-stakes.' }
        ]
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
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 900));
    return _demoResponse(state, summary, markupResult, bidHistory);
  }

  // project / conditions go whole (minus an empty denylist) rather than
  // hand-picked, so a new state.project / state.conditions field reaches
  // the agent automatically — see js/agent-payload.js, loaded just before
  // this file, and docs/dirigo-ux-decisions.md §9.10.
  const payload = buildAgentPayload(state, summary, markupResult, bidHistory);

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

// Guarded CommonJS export so the demo response shape can be unit-tested
// under Vitest's node env without a browser — inert in the browser (no
// `module`), same pattern as js/ui.js's escapeHtml export.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _demoResponse, AGENT_FALLBACK };
}
