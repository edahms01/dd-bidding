import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll, loadSeed } from './helpers.js';

// ── Golden-export parity check ──────────────────────────────────────
// The A2 plan required this fixture captured at the end of A1 (vanilla,
// pre-React) and verified at the end of A2. It was never actually
// captured then — found and closed here, mid-migration, rather than
// left open until the end (see CLAUDE.md/the A2 plan for the intended
// timing). The comparison is still meaningful, arguably more so: it now
// covers everything converted so far (the spike, Project/Conditions,
// Assemblies, Walls, Ceilings) in one gate, verified once by checking
// out the pre-A2 commit (27e2eb2, the A1 merge — main's current tip)
// into an isolated worktree, running the identical clearAll() ->
// loadSeed() -> Export flow against it, and diffing the raw downloaded
// JSON byte-for-byte against the same flow run on this branch: zero
// diff, no normalization needed for this run. tests/fixtures/
// golden-export.json is that captured vanilla-era payload.
//
// Normalization seam, per the plan ("write the normalizer into the
// test itself, not by hand-editing the fixture"): normalize() is a
// no-op today because this export payload has no volatile fields
// (timestamp, draft id, schemaVersion is fixed at 1) — collectFormData()
// (js/state.js) builds a plain form-state snapshot, not a stored bid
// record. If a future field changes on every run (an exportedAt
// timestamp, a generated id), strip/freeze it here, not by hand-editing
// the fixture — keeps the normalization step inspectable and honest
// about what's actually being ignored.
function normalize(payload) {
  return payload;
}

test('exported seed-data payload matches the captured vanilla-era baseline byte-for-byte (after normalization)', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.exportBid())
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-golden-export.json');
  await download.saveAs(filePath);
  const actual = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fs.unlinkSync(filePath);

  const fixturePath = path.join(__dirname, '..', 'fixtures', 'golden-export.json');
  const expected = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  expect(normalize(actual)).toEqual(normalize(expected));
});
