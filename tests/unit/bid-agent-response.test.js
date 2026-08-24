import { describe, it, expect } from 'vitest';
import { parseAgentResponse } from '../../netlify/functions/lib/bid-agent-response.js';

const RECOMMENDATION = {
  options: [{ type: 'recommended', label: 'Recommended', bidAmount: 284500, margin: 28.4, winLikelihood: 'High', rationale: 'Solid margin given the relationship.' }],
  reasoning: 'Well-defined scope, strong GC relationship.',
  signals: [],
  riskFlags: [],
  historicalNotes: []
};

function anthropicBody(text) {
  return { content: [{ type: 'text', text }] };
}

describe('parseAgentResponse', () => {
  it('parses valid JSON text into a recommendation', () => {
    const result = parseAgentResponse(anthropicBody(JSON.stringify(RECOMMENDATION)));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('strips markdown code fences before parsing', () => {
    const fenced = '```json\n' + JSON.stringify(RECOMMENDATION) + '\n```';
    const result = parseAgentResponse(anthropicBody(fenced));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('strips fences with no language tag', () => {
    const fenced = '```\n' + JSON.stringify(RECOMMENDATION) + '\n```';
    const result = parseAgentResponse(anthropicBody(fenced));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('returns a structured failure, not a throw, on malformed JSON', () => {
    expect(() => parseAgentResponse(anthropicBody('{not valid json'))).not.toThrow();
    const result = parseAgentResponse(anthropicBody('{not valid json'));
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns a structured failure, not a throw, when content is missing entirely', () => {
    expect(() => parseAgentResponse({})).not.toThrow();
    const result = parseAgentResponse({});
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns a structured failure when content array is empty', () => {
    const result = parseAgentResponse({ content: [] });
    expect(result.ok).toBe(false);
  });
});
