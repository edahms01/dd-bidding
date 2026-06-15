// ─────────────────────────────────────────────────────────────────────
// agent.js — Bid decision agent
// All Anthropic API interaction lives here — single swap point for
// future model changes or proxy migration.
//
// Auth: reads 'dirigo_api_key' from localStorage. No key in source.
// Production path: replace fetch() target with a backend proxy that
// injects the key server-side and removes direct-browser-access header.
// ─────────────────────────────────────────────────────────────────────

// Set to false to enable live Anthropic API calls (requires API key in localStorage).
const DEMO_MODE = true;

const AGENT_SYSTEM = `You are a bid strategy advisor for Dirigo Drywall, a commercial drywall subcontractor. You analyze bid data and market signals to recommend whether to bid as calculated, adjust the price, or pass on a job. You respond only in valid JSON matching the exact schema provided. Be direct and specific — your reasoning should reference the actual signals provided, not generic advice.`;

const AGENT_FALLBACK = {
  recommendation:  'unknown',
  suggestedBid:    null,
  rangeLow:        null,
  rangeHigh:       null,
  reasoning:       'Agent unavailable — review signals manually.',
  signals:         [],
  riskFlags:       [{ severity: 'high', message: 'Could not connect to bid agent. Submit bid based on your own judgment.' }],
  historicalNotes: []
};

// Fixed demo response for the Harborview Plaza retail project (seed dataset).
// Illustrates the full agent output format including per-signal notes.
// Replace with _demoResponse(state, …) dynamic logic if a generic demo is needed.
function _demoResponse(state, summary, markupResult, bidHistory) {
  return {
    recommendation: 'bid_as_calculated',
    suggestedBid:   284500,
    rangeLow:       274000,
    rangeHigh:      291000,

    reasoning: 'Harborview Plaza is a well-defined retail fit-out with manageable complexity. ' +
      'Your direct cost model is solid — the restricted site access and curved feature wall are ' +
      'both captured in conditions and the 12% waste factor is appropriate for a two-level retail ' +
      'scope with exterior exposure. At $284,500 with an effective margin of 28.4%, you are priced ' +
      'competitively for moderate competition without leaving money on the table. Callahan ' +
      'Construction Group values quality over lowest price and your relationship is strong — there ' +
      'is no strategic reason to sharpen the pencil on this one. Hold the number.',

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
        note:   'No escalation risk flagged beyond the standard 3% already included in markup.'
      },
      {
        label:  'Dirigo\'s edge',
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
        message:  'Start date is 90 days out. Material prices are currently stable but monitor steel stud pricing over the next 30 days before locking supplier quotes.'
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
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 900));
    return _demoResponse(state, summary, markupResult, bidHistory);
  }

  const apiKey = localStorage.getItem('dirigo_api_key') || '';
  if (!apiKey) {
    return Object.assign({}, AGENT_FALLBACK, {
      reasoning:  'API key not configured. Enter your Anthropic API key in the setup panel on Tab 9.',
      riskFlags: [{ severity: 'high', message: 'Anthropic API key required — see Tab 9 setup panel.' }]
    });
  }

  const payload = JSON.stringify({
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
      escalation:      Math.round(markupResult.escalation),
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
    schema: {
      recommendation:  'bid_as_calculated | bid_lower | bid_higher | dont_bid',
      suggestedBid:    'number — your recommended final bid price',
      rangeLow:        'number — low end of acceptable bid range',
      rangeHigh:       'number — high end of acceptable bid range',
      reasoning:       'string — 2-3 sentences directly referencing the signals provided',
      signals:         '[{ label: string, value: string, status: "positive"|"warning"|"neutral" }] — one entry per intelligence field',
      riskFlags:       '[{ severity: "high"|"medium"|"low", message: string }] — empty array if none',
      historicalNotes: '[string] — observations from bid history; empty array if none'
    }
  }, null, 2);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     AGENT_SYSTEM,
        messages:   [{ role: 'user', content: payload }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('Bid agent API error:', resp.status, err);
      return Object.assign({}, AGENT_FALLBACK, {
        reasoning: 'API error (' + resp.status + ') — check your API key and try again.',
        riskFlags: [{ severity: 'high', message: 'API error ' + resp.status + '. See browser console for details.' }]
      });
    }

    const data  = await resp.json();
    const text  = data.content?.[0]?.text || '';
    // Strip markdown code fences if the model wraps the JSON
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('Bid agent error:', e);
    return AGENT_FALLBACK;
  }
}
