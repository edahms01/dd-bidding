import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Cleanup pass: _renderAgentResult() interpolates agent-returned text
// (reasoning, signals, risk flags, historical notes, option label/
// rationale) into innerHTML the same way the brief's named user-input
// spots do — same escapeHtml() fix applies here too (see the scoping
// decision in the plan/close-out for this pass).
//
// DEMO_MODE is a hardcoded top-level `const` in js/agent.js (true), so
// there's no live response to inject markup into via page.route without
// either a real Anthropic call or a `const`-redeclaration collision
// across <script> tags (this codebase's top-level let/const share one
// global lexical scope across plain <script src> files). Instead this
// calls _renderAgentResult() directly — a bare top-level function
// reachable from page.evaluate() the same way this suite already reads
// other bare globals (hasUnsavedChanges, getHistorySummary) — with a
// crafted result object standing in for whatever a live Anthropic
// response or a compromised/buggy upstream could return.
//
// What this proves and what it doesn't: this confirms the render
// boundary (_renderAgentResult()) is safe regardless of what reaches it.
// It does NOT exercise parseAgentResponse()'s JSON.parse() path
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
        rationale: 'Rationale <script>window.__xss=1</script> text.'
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
    const pageEl = document.getElementById('page-agent');
    _renderAgentResult(pageEl, result);
  }, fakeResult);

  const agentPage = page.locator('#page-agent');

  // Signal summary / Risk flags / Historical context are collapsed
  // accordions now — expand all three so their fields are in the DOM to
  // assert on.
  for (const toggle of await agentPage.locator('.agent-section-toggle').all()) {
    await toggle.click();
  }

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

  // ...and never as actual injected elements or an executed script.
  expect(await agentPage.locator('b, i, u, script').count()).toBe(0);
  const xssRan = await page.evaluate(() => window.__xss);
  expect(xssRan).toBeUndefined();
});
