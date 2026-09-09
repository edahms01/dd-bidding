import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIELD_REGISTRY } from '../../src/state/fieldRegistry.js';

// The two docs are generated from FIELD_REGISTRY by
// scripts/generate-field-dictionary.mjs. These checks are the backstop
// for a field silently dropped from the docs — e.g. by a mistyped `tab`
// value the generator groups nothing under, or by forgetting to re-run
// the generator after a registry change.
const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const simple = read('../../docs/field-dictionary-simple.md');
const full = read('../../docs/field-dictionary-full.md');
const keys = Object.keys(FIELD_REGISTRY);

describe('field dictionary docs', () => {
  it('every registry key appears in the full doc (by dot-path heading)', () => {
    const missing = keys.filter((k) => !full.includes(`### ${k}\n`));
    expect(
      missing,
      `missing from docs/field-dictionary-full.md — re-run scripts/generate-field-dictionary.mjs:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it("every registry entry's label appears in the simple doc", () => {
    const missing = keys.filter(
      (k) => !simple.includes(`**${FIELD_REGISTRY[k].label}** — `),
    );
    expect(
      missing,
      `label missing from docs/field-dictionary-simple.md — re-run the generator:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every entry has label, description, and a valid tab', () => {
    const TABS = [
      'project', 'conditions', 'assemblies', 'walls', 'ceilings',
      'rates', 'output', 'market', 'agent',
    ];
    const bad = keys.filter((k) => {
      const e = FIELD_REGISTRY[k];
      return !e.label || !e.description || !TABS.includes(e.tab);
    });
    expect(
      bad,
      `entries missing label/description/tab:\n  ${bad.join('\n  ')}`,
    ).toEqual([]);
  });

  it('both docs carry the "do not edit by hand" generated-file note', () => {
    expect(simple).toContain('do not edit by hand');
    expect(full).toContain('do not edit by hand');
  });
});
