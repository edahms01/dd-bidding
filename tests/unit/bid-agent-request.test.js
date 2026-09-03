import { describe, it, expect } from 'vitest';
import { AGENT_SYSTEM, RECOMMENDATION_SCHEMA, RECOMMENDATION_TOOL, buildAnthropicRequest } from '../../netlify/functions/lib/bid-agent-request.js';

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
    // 8192, not 1024 — the recommendation is ~1.5k output tokens and
    // 1024 truncated it, producing invalid JSON (502 parse_error).
    expect(req.max_tokens).toBe(8192);
    expect(req.system).toBe(AGENT_SYSTEM);
  });

  it('produces a single user message carrying just the business payload', () => {
    const req = buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    const body = JSON.parse(req.messages[0].content);
    expect(body.project).toEqual(REPRESENTATIVE_PAYLOAD.project);
    expect(body.costs).toEqual(REPRESENTATIVE_PAYLOAD.costs);
    expect(body.conditions).toEqual(REPRESENTATIVE_PAYLOAD.conditions);
    expect(body.intelligence).toEqual(REPRESENTATIVE_PAYLOAD.intelligence);
    expect(body.history).toEqual(REPRESENTATIVE_PAYLOAD.history);
    // the schema is no longer smuggled into the prompt — it's the tool
    expect(body.schema).toBeUndefined();
  });

  it('forces the submit_bid_recommendation tool with a strict schema', () => {
    const req = buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(req.tools).toHaveLength(1);
    expect(req.tools[0].name).toBe('submit_bid_recommendation');
    expect(req.tools[0].strict).toBe(true);
    expect(req.tools[0].input_schema).toBe(RECOMMENDATION_SCHEMA);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'submit_bid_recommendation' });
  });

  it('exposes a strict-mode-shaped schema (object, additionalProperties:false, required)', () => {
    expect(RECOMMENDATION_SCHEMA.type).toBe('object');
    expect(RECOMMENDATION_SCHEMA.additionalProperties).toBe(false);
    expect(RECOMMENDATION_SCHEMA.required).toEqual(['options', 'reasoning', 'signals', 'riskFlags', 'historicalNotes']);
    const opt = RECOMMENDATION_SCHEMA.properties.options.items;
    expect(opt.additionalProperties).toBe(false);
    expect(opt.properties.type.enum).toContain('recommended');
    expect(opt.properties.winLikelihood.enum).toContain('Low–Medium');
    expect(RECOMMENDATION_TOOL.input_schema).toBe(RECOMMENDATION_SCHEMA);
  });

  it('does not mutate the input payload', () => {
    const original = JSON.parse(JSON.stringify(REPRESENTATIVE_PAYLOAD));
    buildAnthropicRequest(REPRESENTATIVE_PAYLOAD);
    expect(REPRESENTATIVE_PAYLOAD).toEqual(original);
  });
});
