import { describe, it, expect } from 'vitest';
import { AGENT_POLL_MAX_WAIT_MS } from '../../src/state/agent.js';
import { PER_ATTEMPT_TIMEOUT_MS } from '../../netlify/functions/lib/bid-agent-call.js';

describe('live agent client poll window', () => {
  // The client must outwait one full server attempt, or a slow-but-
  // successful first call (measured 74s) is abandoned as a timeout while
  // the background function is still working.
  it('outlasts a single server-side attempt', () => {
    expect(AGENT_POLL_MAX_WAIT_MS).toBeGreaterThan(PER_ATTEMPT_TIMEOUT_MS);
  });
});
