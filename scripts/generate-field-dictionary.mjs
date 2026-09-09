#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// generate-field-dictionary.mjs — regenerates the two field-dictionary
// docs from src/state/fieldRegistry.js. Run by hand:
//
//   node scripts/generate-field-dictionary.mjs
//
// NOT wired into CI and NOT part of the app bundle. Re-run it whenever a
// registry entry's label / description / tab changes, or a field is
// added or removed (CLAUDE.md, "New bid-field rule"). The committed
// docs/field-dictionary-*.md files must match this script's output —
// tests/unit/fieldDictionaryDocs.test.js is the drop-a-field backstop.
//
// Why the data: URL import: package.json is "type": "commonjs", so a
// plain `node` run can't `import` fieldRegistry.js (an ESM-syntax .js)
// directly. The registry file has no imports of its own, so loading its
// source through a data: URL — always treated as ESM — is the simplest
// dependency-free way in. If fieldRegistry.js ever grows a relative
// import, switch this to vite/esbuild transform instead.
// ─────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const registryUrl = new URL('../src/state/fieldRegistry.js', import.meta.url);
const src = readFileSync(registryUrl, 'utf8');
const { FIELD_REGISTRY } = await import(
  'data:text/javascript,' + encodeURIComponent(src)
);

// Canonical tab order — the workflow section of src/state/router.js's
// ROUTES, keys verbatim.
const TAB_ORDER = [
  'project', 'conditions', 'assemblies', 'walls', 'ceilings',
  'rates', 'output', 'market', 'agent',
];

// Friendly headings for the docs (the raw key is the `tab` value).
const TAB_HEADINGS = {
  project: 'Project',
  conditions: 'Site Conditions',
  assemblies: 'Assemblies',
  walls: 'Walls',
  ceilings: 'Ceilings',
  rates: 'Rates',
  output: 'Cost Summary',
  market: 'Market Read',
  agent: 'Bid Strategy',
};

// ── Validate before writing anything ────────────────────────────────
const problems = [];
for (const [path, entry] of Object.entries(FIELD_REGISTRY)) {
  if (!entry.label) problems.push(`${path}: missing label`);
  if (!entry.description) problems.push(`${path}: missing description`);
  if (!entry.tab) problems.push(`${path}: missing tab`);
  else if (!TAB_ORDER.includes(entry.tab)) {
    problems.push(`${path}: tab "${entry.tab}" is not one of ${TAB_ORDER.join(', ')}`);
  }
}
if (problems.length) {
  console.error('Field dictionary generation aborted — fix these registry entries:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

// ── Group by tab, preserving registry insertion order within a tab ──
const byTab = Object.fromEntries(TAB_ORDER.map((t) => [t, []]));
for (const [path, entry] of Object.entries(FIELD_REGISTRY)) {
  byTab[entry.tab].push({ path, ...entry });
}

const EMPTY_TAB_LINE = '_No fields are entered on this tab._';
const GEN_NOTE =
  '_Generated from `src/state/fieldRegistry.js` by `scripts/generate-field-dictionary.mjs` — do not edit by hand._';

// ── Simple doc — for a non-technical reader ─────────────────────────
function renderSimple() {
  const out = ['# Field Dictionary', '', GEN_NOTE, ''];
  for (const tab of TAB_ORDER) {
    out.push(`## ${TAB_HEADINGS[tab]}`, '');
    const fields = byTab[tab];
    if (!fields.length) {
      out.push(EMPTY_TAB_LINE, '');
      continue;
    }
    for (const f of fields) out.push(`**${f.label}** — ${f.description}`, '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

// ── Full doc — for Code / Eric ─────────────────────────────────────
function renderFull() {
  const out = ['# Field Dictionary (full)', '', GEN_NOTE, ''];
  for (const tab of TAB_ORDER) {
    out.push(`## ${TAB_HEADINGS[tab]} (${tab})`, '');
    const fields = byTab[tab];
    if (!fields.length) {
      out.push(EMPTY_TAB_LINE, '');
      continue;
    }
    for (const f of fields) {
      out.push(`### ${f.path}`);
      out.push(`- **Label:** ${f.label}`);
      out.push(`- **Description:** ${f.description}`);
      out.push(`- **consumedBy:** ${f.consumedBy}`);
      if (f.knownGap === true) {
        out.push('- **Known gap:** not yet wired into calculator.js');
      }
      if (f.calcToken) out.push(`- **calcToken:** ${f.calcToken}`);
      out.push('');
    }
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

const simplePath = fileURLToPath(new URL('../docs/field-dictionary-simple.md', import.meta.url));
const fullPath = fileURLToPath(new URL('../docs/field-dictionary-full.md', import.meta.url));
writeFileSync(simplePath, renderSimple());
writeFileSync(fullPath, renderFull());

// ── Summary ────────────────────────────────────────────────────────
let total = 0;
for (const tab of TAB_ORDER) {
  const n = byTab[tab].length;
  total += n;
  console.log(`  ${TAB_HEADINGS[tab].padEnd(14)} ${tab.padEnd(12)} ${n}`);
}
console.log(`  ${''.padEnd(27)} ${total} fields`);
console.log('Wrote docs/field-dictionary-simple.md and docs/field-dictionary-full.md');
