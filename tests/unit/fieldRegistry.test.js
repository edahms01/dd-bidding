import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  walkLeafPaths,
  calcTokenFor,
  CONSUMED_BY_TAGS,
  FIELD_REGISTRY,
} from '../../src/state/fieldRegistry.js';
// Importing the real store (not a re-declared shape) is the point — the
// completeness check below only has teeth if it walks the SAME object the
// app boots with. store.jsx reads localStorage at module scope; the stub
// in tests/unit/_setup.js makes that import safe under the node env.
import { initialState } from '../../src/state/store.jsx';
import {
  AGENT_PROJECT_DENYLIST,
  AGENT_CONDITIONS_DENYLIST,
} from '../../js/agent-payload.js';

// Comments stripped: a field named only in a comment ("delivery/disposal/lift
// don't have commodity-price risk…") is not *consumed*, and would be a false
// pass for the calculator-consumption check.
const calcSrc = readFileSync(
  fileURLToPath(new URL('../../js/calculator.js', import.meta.url)),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const walkedPaths = [...walkLeafPaths(initialState.bid)];

describe('FIELD_REGISTRY completeness', () => {
  it('every leaf of initialState.bid has a registry entry', () => {
    const missing = walkedPaths.filter((p) => !(p in FIELD_REGISTRY));
    expect(
      missing,
      `unregistered bid field(s) — add to src/state/fieldRegistry.js in this PR:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every registry entry still corresponds to a real leaf (no stale keys)', () => {
    const walkedSet = new Set(walkedPaths);
    const stale = Object.keys(FIELD_REGISTRY).filter((k) => !walkedSet.has(k));
    expect(
      stale,
      `registry entr(ies) with no matching leaf in initialState.bid — remove or fix:\n  ${stale.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every entry has a valid consumedBy tag', () => {
    for (const [path, entry] of Object.entries(FIELD_REGISTRY)) {
      expect(CONSUMED_BY_TAGS, `${path}`).toContain(entry.consumedBy);
    }
  });

  it('knownGap is only set on calculator / both entries', () => {
    const bad = Object.entries(FIELD_REGISTRY)
      .filter(([, e]) => e.knownGap && !['calculator', 'both'].includes(e.consumedBy))
      .map(([p]) => p);
    expect(bad, `knownGap is meaningless on these: ${bad.join(', ')}`).toEqual([]);
  });
});

describe('calculator-consumption', () => {
  // A field tagged calculator/both must have a token present in
  // js/calculator.js's source. Presence, not correctness — a grep, not a
  // proof. knownGap entries run under it.fails(): the assertion genuinely
  // fails today (that's the tracked backlog), the suite stays green, and
  // wiring the field later makes this pass -> the test then goes red until
  // knownGap is removed from the registry entry.
  for (const [path, entry] of Object.entries(FIELD_REGISTRY)) {
    if (!['calculator', 'both'].includes(entry.consumedBy)) continue;
    const token = calcTokenFor(path, entry);
    const check = () => expect(calcSrc).toContain(token);
    if (entry.knownGap) {
      it.fails(`KNOWN GAP: ${path} ("${token}") is not wired into calculator.js`, check);
    } else {
      it(`${path} ("${token}") is wired into calculator.js`, check);
    }
  }
});

describe('agent-consumption', () => {
  // A field tagged agent/both must not be withheld from the payload —
  // asserted against the real denylists js/agent-payload.js exports
  // (both empty today). intelligence is a whole-object passthrough with
  // no denylist concept.
  const denylistFor = {
    project: AGENT_PROJECT_DENYLIST,
    conditions: AGENT_CONDITIONS_DENYLIST,
    intelligence: [],
  };

  for (const [path, entry] of Object.entries(FIELD_REGISTRY)) {
    if (!['agent', 'both'].includes(entry.consumedBy)) continue;
    const [slice, field] = path.split('.');
    it(`${path} reaches the agent payload`, () => {
      expect(denylistFor[slice], `unexpected agent slice: ${slice}`).toBeDefined();
      expect(denylistFor[slice]).not.toContain(field);
    });
  }
});
