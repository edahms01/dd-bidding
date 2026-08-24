import { test, expect } from '@playwright/test';

// Track A: bid-agent.js's "not configured" (missing ANTHROPIC_API_KEY)
// path is covered at the unit level instead — see
// tests/unit/bid-agent-handler.test.js. Confirmed via a real run that
// `netlify dev` isn't a reliable place to test that specific case once a
// real key is live on ddbidding: it resolves a site's `production`-
// context value as a fallback whenever no truthy `dev`-context value is
// present — an empty override (via a local .env, via Playwright's
// webServer.env, and via an explicit empty `dev`-context value set on
// the site itself) was tried and none suppressed the fallback. Since
// bid-agent.js's handler is a plain require()-able async function with
// no Blobs/connectLambda dependency, testing the missing-key branch by
// calling it directly in Vitest with process.env manipulated in an
// isolated Node process sidesteps that fallback entirely and is more
// reliable, not less, than going through the real HTTP layer for this
// one case.
//
// What's left here is real HTTP-layer coverage that doesn't depend on
// ANTHROPIC_API_KEY's value either way.

test('bid-agent function rejects non-POST methods cleanly', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const resp = await fetch('/.netlify/functions/bid-agent', { method: 'GET' });
    return { status: resp.status };
  });

  expect(result.status).toBe(405);
});
