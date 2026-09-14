import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Cleanup pass: AgentPage.jsx renders agent-returned text (reasoning,
// signals, risk flags, historical notes, option label/rationale) as
// plain JSX text content, which auto-escapes — this spec proves that
// holds regardless of what the agent returns.
//
// DEMO_MODE is a hardcoded top-level `const` in js/agent.js (true), so
// there's no live response to inject markup into via page.route without
// either a real Anthropic call or a `const`-redeclaration collision
// across <script> tags (this codebase's top-level let/const share one
// global lexical scope across plain <script src> files). Instead this
// calls window.__renderAgentTab (src/state/bridges.js) directly — the
// same dispatch js/ui.js's renderAgentTab()/runAgentIfNeeded() make —
// with a crafted result object standing in for whatever a live
// Anthropic response or a compromised/buggy upstream could return.
// (Migration Phase 4: js/ui.js's own _renderAgentResult() wrapper this
// spec used to call is deleted — it was already just a thin dispatch to
// this same bridge in every real browser context, so calling the bridge
// directly is the same injection, one layer closer to what actually
// happens.)
//
// What this proves and what it doesn't: this confirms the render
// boundary (React's JSX text-content escaping in AgentPage.jsx) is safe
// regardless of what reaches it. It does NOT exercise
// parseAgentResponse()'s JSON.parse() path
// (netlify/functions/lib/bid-agent-response.js) — it starts from an
// already-parsed JS object, so it says nothing about how malformed or
// malicious JSON from the live API would be parsed. Those are two
// different guarantees; only the render-boundary one is covered here.
test('agent-returned text with markup-like content renders as literal text in every field, never as actual elements', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-agent');
  await page.waitForTimeout(500);

  const fakeResult = {
    reasoning: 'Reasoning <b>bold injected</b> text.',
    options: [
      {
        type: 'recommended',
        label: 'Recommended <i>label</i>',
        bidAmount: 250000,
        margin: 25,
        winLikelihood: 'High <u>likelihood</u>',
        rationale: 'Rationale <script>window.__xss=1</script> text.',
        factors: [
          { label: 'Factor <b>label</b> one', direction: 'positive', note: 'Factor <script>window.__xss=1</script> note one.' },
          { label: 'Factor <i>label</i> two', direction: 'negative', note: 'Factor <b>note</b> two.' }
        ]
      }
    ],
    signals: [
      { label: 'Signal <b>label</b>', value: 'Signal <b>value</b>', status: 'positive', note: 'Signal <b>note</b>' }
    ],
    riskFlags: [
      { severity: 'high <b>sev</b>', message: 'Risk <b>message</b>' }
    ],
    historicalNotes: [
      'Historical <b>note</b> text.'
    ]
  };

  await page.evaluate((result) => {
    window.__renderAgentTab({ cachedResult: result, loading: false, historyUnavailable: false, generatedAt: null });
  }, fakeResult);

  const agentPage = page.locator('#page-agent');

  // Signal summary / Risk flags / Historical context are collapsed
  // accordions now — expand all three so their fields are in the DOM to
  // assert on.
  for (const toggle of await agentPage.locator('.agent-section-toggle').all()) {
    await toggle.click();
  }

  // The win-likelihood attribution panel (the model's per-option `factors`)
  // only mounts once the pill is expanded — open it so its label/note text
  // is in the DOM to assert on.
  await agentPage.locator('[data-bid-opt="recommended"] .win-likelihood-pill-btn').click();
  await expect(agentPage.locator('.win-attr')).toBeVisible();

  // Every injected tag must show up as literal visible text...
  await expect(agentPage).toContainText('Reasoning <b>bold injected</b> text.');
  await expect(agentPage).toContainText('Recommended <i>label</i>');
  await expect(agentPage).toContainText('High <u>likelihood</u>');
  await expect(agentPage).toContainText('Rationale <script>window.__xss=1</script> text.');
  await expect(agentPage).toContainText('Signal <b>label</b>');
  await expect(agentPage).toContainText('Signal <b>value</b>');
  await expect(agentPage).toContainText('Signal <b>note</b>');
  // Risk severity is no longer echoed as raw agent text — SeverityPill maps
  // it to a fixed 'High'/'Medium'/'Low' label — so there's nothing to
  // escape there now; the message field is still rendered verbatim.
  await expect(agentPage).toContainText('Risk <b>message</b>');
  await expect(agentPage).toContainText('Historical <b>note</b> text.');
  await expect(agentPage).toContainText('Factor <b>label</b> one');
  await expect(agentPage).toContainText('Factor <script>window.__xss=1</script> note one.');
  await expect(agentPage).toContainText('Factor <i>label</i> two');

  // ...and never as actual injected elements or an executed script.
  expect(await agentPage.locator('b, i, u, script').count()).toBe(0);
  const xssRan = await page.evaluate(() => window.__xss);
  expect(xssRan).toBeUndefined();
});
