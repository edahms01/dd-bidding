import { test, expect } from '@playwright/test';

// Track A, async flow: the "not configured" (missing/invalid
// ANTHROPIC_API_KEY) path is now handled inside bid-agent-background.js —
// it writes an `error` job record ("not_configured — …") that the client
// surfaces via bid-agent-result.js. That's not reliably testable through
// `netlify dev` (it resolves the site's production-context key as a
// fallback; documented at length in the old sync-function version of this
// spec), and the background function needs Blobs so it can't be
// require()d into Vitest either. It's covered by the deploy-preview
// manual live check + lib/bid-agent-jobs.js unit tests instead.
//
// What stays here is HTTP-layer coverage that doesn't depend on the key:
// the poll endpoint is GET-only.

test('bid-agent-result rejects non-GET methods cleanly', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const resp = await fetch('/.netlify/functions/bid-agent-result?id=job-000000000000', { method: 'POST' });
    return { status: resp.status };
  });

  expect(result.status).toBe(405);
});

test('bid-agent-result requires a valid id', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const resp = await fetch('/.netlify/functions/bid-agent-result', { method: 'GET' });
    return { status: resp.status };
  });

  expect(result.status).toBe(400);
});
