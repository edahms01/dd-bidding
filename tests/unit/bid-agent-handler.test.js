import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handler } from '../../netlify/functions/bid-agent.js';

// Covers bid-agent.js's "ANTHROPIC_API_KEY unset" path by calling the
// handler directly with process.env manipulated in this isolated Node/
// Vitest process — no netlify dev, no network. See
// tests/e2e/bid-agent-not-configured.spec.js for why this moved here
// instead of a Playwright integration test: netlify dev falls back to
// ddbidding's real production-context ANTHROPIC_API_KEY value whenever
// no truthy dev-context override exists, which made the missing-key
// case impossible to reproduce reliably through the real HTTP layer
// once a real key went live. This test never calls fetch() at all —
// the handler returns before ever attempting the Anthropic call.

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

function postEvent(body) {
  return { httpMethod: 'POST', body: JSON.stringify(body) };
}

describe('bid-agent handler — missing ANTHROPIC_API_KEY', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  });

  it('returns a clean 503 not_configured response, not a crash or hang', async () => {
    const result = await handler(postEvent({ project: {}, costs: {}, conditions: {}, intelligence: {}, history: {} }));
    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('not_configured');
  });

  it('never attempts to reach Anthropic when the key is missing', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (...args) => {
      fetchCalled = true;
      return originalFetch(...args);
    };
    try {
      await handler(postEvent({ project: {}, costs: {}, conditions: {}, intelligence: {}, history: {} }));
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('bid-agent handler — method routing', () => {
  it('rejects non-POST methods with 405', async () => {
    const result = await handler({ httpMethod: 'GET' });
    expect(result.statusCode).toBe(405);
  });
});
