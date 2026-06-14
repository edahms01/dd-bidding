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

// Builds a realistic demo response from the actual bid numbers and intelligence
// signals so all four Tab 9 panels render meaningfully without an API call.
function _demoResponse(state, summary, markupResult, bidHistory) {
  const bid     = Math.round(markupResult.finalBidPrice);
  const intel   = state.intelligence || {};

  const SIG_LABELS = {
    crewAvailability:   'Crew availability',
    pipelinePressure:   'Pipeline pressure',
    materialTrend:      'Material trend',
    gcRelationship:     'GC relationship',
    gcPriceSensitivity: 'GC price sensitivity',
    competitionLevel:   'Competition level',
    knownCompetitors:   'Known competitors',
    dirigoEdge:         'Dirigo edge'
  };
  const SIG_VALUES = {
    crewAvailability:   { full: 'Full capacity', partial: 'Partially booked', tight: 'Tight' },
    pipelinePressure:   { need: 'Need the work', neutral: 'Neutral', pass: 'Can pass' },
    materialTrend:      { stable: 'Stable', rising: 'Rising ↑', falling: 'Falling ↓' },
    gcRelationship:     { strong: 'Strong', neutral: 'Neutral', new: 'New GC', difficult: 'Difficult' },
    gcPriceSensitivity: { lowest: 'Price-driven', balanced: 'Balanced', quality: 'Quality-first' },
    competitionLevel:   { light: 'Light', moderate: 'Moderate', heavy: 'Heavy', unknown: 'Unknown' },
    dirigoEdge:         { strong: 'Strong', neutral: 'Neutral', weak: 'Weak' }
  };
  const POSITIVE = { crewAvailability: 'full', pipelinePressure: 'pass', materialTrend: 'falling', gcRelationship: 'strong', gcPriceSensitivity: 'quality', competitionLevel: 'light', dirigoEdge: 'strong' };
  const WARNING  = { crewAvailability: 'tight', pipelinePressure: 'need', materialTrend: 'rising', gcRelationship: 'difficult', gcPriceSensitivity: 'lowest', competitionLevel: 'heavy', dirigoEdge: 'weak' };

  function sigStatus(field, val) {
    if (!val) return 'neutral';
    if (POSITIVE[field] === val) return 'positive';
    if (WARNING[field]  === val) return 'warning';
    return 'neutral';
  }

  const signals = Object.keys(SIG_LABELS).map(field => ({
    label:  SIG_LABELS[field],
    value:  field === 'knownCompetitors'
              ? (intel[field] || '—')
              : ((SIG_VALUES[field] && SIG_VALUES[field][intel[field]]) || intel[field] || '—'),
    status: field === 'knownCompetitors' ? 'neutral' : sigStatus(field, intel[field])
  }));

  const warnings  = signals.filter(s => s.status === 'warning').length;
  const positives = signals.filter(s => s.status === 'positive').length;

  let recommendation;
  if      (warnings >= 3)  recommendation = 'dont_bid';
  else if (warnings >= 2)  recommendation = 'bid_lower';
  else if (positives >= 4) recommendation = 'bid_higher';
  else                     recommendation = 'bid_as_calculated';

  const suggestedBid = recommendation === 'bid_lower'
    ? Math.round(bid * 0.96)
    : recommendation === 'bid_higher'
    ? Math.round(bid * 1.04)
    : bid;
  const rangeLow  = Math.round(suggestedBid * 0.95);
  const rangeHigh = Math.round(suggestedBid * 1.07);

  const riskFlags = [];
  if (intel.crewAvailability   === 'tight')     riskFlags.push({ severity: 'medium', message: 'Tight crew availability — schedule overlap risk if project starts as planned.' });
  if (intel.materialTrend      === 'rising')     riskFlags.push({ severity: 'medium', message: 'Rising material trend — escalation buffer may be insufficient if start is delayed.' });
  if (intel.gcRelationship     === 'difficult')  riskFlags.push({ severity: 'high',   message: 'Difficult GC relationship — elevated risk of scope disputes and slow payment.' });
  if (intel.competitionLevel   === 'heavy')      riskFlags.push({ severity: 'low',    message: 'Heavy competition — expect bids within 5–8% of each other.' });

  const historicalNotes = [];
  if (bidHistory.totalBids > 0) {
    historicalNotes.push('Overall win rate: ' + bidHistory.winRate + '% across ' + bidHistory.totalBids + ' logged bid' + (bidHistory.totalBids > 1 ? 's' : '') + '.');
    if (bidHistory.winsWithThisGC + bidHistory.lossesWithThisGC > 0) {
      historicalNotes.push('With this GC: ' + bidHistory.winsWithThisGC + ' win' + (bidHistory.winsWithThisGC !== 1 ? 's' : '') + ', ' + bidHistory.lossesWithThisGC + ' loss' + (bidHistory.lossesWithThisGC !== 1 ? 'es' : '') + '.');
    }
    if (bidHistory.winRateByBuildingType > 0 && state.project.buildingType) {
      historicalNotes.push(state.project.buildingType + ' win rate: ' + bidHistory.winRateByBuildingType + '%.');
    }
    if (bidHistory.avgCostVariance !== null) {
      const sign = bidHistory.avgCostVariance >= 0 ? '+' : '-';
      historicalNotes.push('Avg cost variance on won jobs: ' + sign + '$' + Math.abs(bidHistory.avgCostVariance).toLocaleString() + ' vs. estimate.');
    }
  }

  const recSentence = {
    bid_as_calculated: 'Signals are broadly balanced — the calculated price is the right call here.',
    bid_lower:         'Warning signals on ' + (intel.competitionLevel === 'heavy' ? 'competition and' : '') + ' key factors suggest sharpening the number to improve win probability.',
    bid_higher:        'Strong positive signals — GC relationship and pipeline give room to push margin without risking the award.',
    dont_bid:          'Multiple warning signals stack against this project — the risk-to-reward ratio does not support bidding at current pricing.'
  }[recommendation];

  const factors = [
    intel.gcRelationship && 'GC relationship is ' + (SIG_VALUES.gcRelationship[intel.gcRelationship] || intel.gcRelationship).toLowerCase(),
    intel.competitionLevel && 'competition is ' + (SIG_VALUES.competitionLevel[intel.competitionLevel] || intel.competitionLevel).toLowerCase(),
    intel.pipelinePressure && 'pipeline pressure is ' + (SIG_VALUES.pipelinePressure[intel.pipelinePressure] || intel.pipelinePressure).toLowerCase()
  ].filter(Boolean);

  const reasoning = recSentence
    + (factors.length ? ' Key factors: ' + factors.join(', ') + '.' : '')
    + ' [Demo mode — set DEMO_MODE = false and add an API key for live analysis.]';

  return { recommendation, suggestedBid, rangeLow, rangeHigh, reasoning, signals, riskFlags, historicalNotes };
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
