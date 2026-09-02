import { describe, it, expect } from 'vitest';
import { AGENT_SYSTEM, AGENT_SCHEMA, buildAnthropicRequest } from '../../netlify/functions/lib/bid-agent-request.js';

const REPRESENTATIVE_PAYLOAD = {
  project: { name: 'Harborview Plaza', gc: 'Callahan Construction Group', buildingType: 'retail', startDate: '2026-11-01', bidDate: '2026-08-20' },
  costs: { directCost: 200000, overhead: 20000, contingency: 10000, profit: 30000, totalMarkup: 60000, finalBidPrice: 260000, effectiveMargin: 23.1 },
  conditions: { confidence: 'medium', wastePct: 12, sfAbove12: 1000, sfAbove20: 200, durationWeeks: 8 },
  intelligence: { gcRelationship: 'strong', gcPriceSensitivity: 'quality', competitionLevel: 'moderate', dirigoEdge: 'strong' },
  history: { totalBids: 4, winRate: 0.5, winsWithThisGC: 2, lossesWithThisGC: 1, winRateByBuildingType: 0.6, avgCostVariance: 3.2 }
};

describe('buildAnthropicRequest', () => {
  it('sets model, max_tokens, and system correctly', () => {
    const req = buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(req.model).toBe('claude-sonnet-4-6');
    // 8192, not 1024 — the recommendation JSON is ~2.5-4k output tokens
    // and 1024 truncated it, producing invalid JSON (502 parse_error).
    expect(req.max_tokens).toBe(8192);
    expect(req.system).toBe(AGENT_SYSTEM);
  });

  it('produces a single user message', () => {
    const req = buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    expect(typeof req.messages[0].content).toBe('string');
  });

  it('embeds the full payload plus an injected schema in the message content', () => {
    const req  = buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    const body = JSON.parse(req.messages[0].content);

    expect(body.project).toEqual(REPRESENTATIVE_PAYLOAD.project);
    expect(body.costs).toEqual(REPRESENTATIVE_PAYLOAD.costs);
    expect(body.conditions).toEqual(REPRESENTATIVE_PAYLOAD.conditions);
    expect(body.intelligence).toEqual(REPRESENTATIVE_PAYLOAD.intelligence);
    expect(body.history).toEqual(REPRESENTATIVE_PAYLOAD.history);
    // schema is injected server-side, not expected from the caller
    expect(body.schema).toEqual(AGENT_SCHEMA);
  });

  it('does not mutate the input payload', () => {
    const original = JSON.parse(JSON.stringify(REPRESENTATIVE_PAYLOAD));
    buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(REPRESENTATIVE_PAYLOAD).toEqual(original);
  });

  it('routes a demoProbe call to the faster model and strips the flag from the prompt', () => {
    const req = buildAnthropicRequest({ ...REPRESENTATIVE_PAYLOAD, demoProbe: true });
    expect(req.model).toBe('claude-haiku-4-5');
    const body = JSON.parse(req.messages[0].content);
    expect(body.demoProbe).toBeUndefined();
    // business data still embedded
    expect(body.project).toEqual(REPRESENTATIVE_PAYLOAD.project);
    expect(body.schema).toEqual(AGENT_SCHEMA);
  });

  it('stays on Sonnet when demoProbe is absent or false (the real product path)', () => {
    expect(buildAnthropicRequest(REPRESENTATIVE_PAYLOAD).model).toBe('claude-sonnet-4-6');
    expect(buildAnthropicRequest({ ...REPRESENTATIVE_PAYLOAD, demoProbe: false }).model).toBe('claude-sonnet-4-6');
  });
});
