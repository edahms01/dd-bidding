import { describe, it, expect } from 'vitest';
import { parseAgentResponse } from '../../netlify/functions/lib/bid-agent-response.js';

const RECOMMENDATION = {
  options: [{ type: 'recommended', label: 'Recommended', bidAmount: 284500, margin: 28.4, winLikelihood: 'High', rationale: 'Solid margin given the relationship.' }],
  reasoning: 'Well-defined scope, strong GC relationship.',
  signals: [],
  riskFlags: [],
  historicalNotes: []
};

// Primary path: the forced tool call.
function toolBody(input) {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_bid_recommendation', id: 'toolu_x', input }] };
}
// Fallback path: a plain text block that should be JSON.
function textBody(text) {
  return { content: [{ type: 'text', text }] };
}

describe('parseAgentResponse', () => {
  it('returns the tool_use input directly (no string parsing)', () => {
    const result = parseAgentResponse(toolBody(RECOMMENDATION));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('finds the recommendation tool_use even when other blocks precede it', () => {
    const body = { content: [{ type: 'text', text: 'thinking out loud' }, { type: 'tool_use', name: 'submit_bid_recommendation', input: RECOMMENDATION }] };
    const result = parseAgentResponse(body);
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('fails cleanly when the tool_use block has no input object', () => {
    const result = parseAgentResponse({ content: [{ type: 'tool_use', name: 'submit_bid_recommendation' }] });
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  // Fallback text path.
  it('parses a plain JSON text block when no tool_use is present', () => {
    const result = parseAgentResponse(textBody(JSON.stringify(RECOMMENDATION)));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('strips markdown code fences on the fallback text path', () => {
    const result = parseAgentResponse(textBody('```json\n' + JSON.stringify(RECOMMENDATION) + '\n```'));
    expect(result.ok).toBe(true);
    expect(result.recommendation).toEqual(RECOMMENDATION);
  });

  it('returns a structured failure, not a throw, on malformed fallback text', () => {
    expect(() => parseAgentResponse(textBody('{not valid json'))).not.toThrow();
    const result = parseAgentResponse(textBody('{not valid json'));
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns a structured failure when content is missing entirely', () => {
    expect(() => parseAgentResponse({})).not.toThrow();
    expect(parseAgentResponse({}).ok).toBe(false);
  });

  it('returns a structured failure when the content array is empty', () => {
    expect(parseAgentResponse({ content: [] }).ok).toBe(false);
  });
});
