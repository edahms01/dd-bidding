import { describe, it, expect } from 'vitest';
import {
  omit,
  buildAgentPayload,
  AGENT_PROJECT_DENYLIST,
  AGENT_CONDITIONS_DENYLIST,
} from '../../js/agent-payload.js';

// Mirrors the key sets js/state.js collectFormData() actually returns for
// its `project` and `conditions` slices (checked against that function,
// not the React store shape). If collectFormData() gains/loses a
// project/conditions key, update this fixture — that's the point: the
// payload should then carry the change automatically, and this test
// proves it does.
const COLLECT_FORM_DATA_PROJECT_KEYS = [
  'name', 'gc', 'buildingType', 'bidDate', 'address', 'drawingsRef',
  'startDate', 'durationWeeks', 'floors', 'scope', 'exclusions',
];
const COLLECT_FORM_DATA_CONDITIONS_KEYS = [
  'maxHt', 'sfAbove12', 'sfAbove20', 'curvedWalls', 'curvedWallsLF',
  'exteriorExposure', 'phasedWork', 'phaseCount', 'accessDifficulty',
  'parking', 'wastePct', 'trips', 'confidence', 'durationWeeks', 'notes',
];

function fakeStateWith(keys, prefix) {
  return Object.fromEntries(keys.map((k, i) => [k, `${prefix}-${i}`]));
}

function fakeArgs() {
  const state = {
    project: fakeStateWith(COLLECT_FORM_DATA_PROJECT_KEYS, 'p'),
    conditions: fakeStateWith(COLLECT_FORM_DATA_CONDITIONS_KEYS, 'c'),
    intelligence: { crewAvailability: 'high', openDraftCount: 3 },
  };
  const summary = { directCostTotal: 123456.78, laborTotal: 1, materialTotal: 2 };
  const markupResult = {
    overhead: 10.4, contingency: 20.6, profit: 30.9,
    totalMarkup: 61.9, finalBidPrice: 185518.68, effectiveMargin: 28.42,
  };
  const bidHistory = { marginOutcomeCurve: { available: false } };
  return { state, summary, markupResult, bidHistory };
}

describe('omit', () => {
  it('drops only the listed keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });
  it('empty denylist is a shallow copy', () => {
    const src = { a: 1, b: 2 };
    const out = omit(src, []);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });
  it('tolerates null/undefined', () => {
    expect(omit(null, ['x'])).toEqual({});
    expect(omit(undefined, [])).toEqual({});
  });
});

describe('buildAgentPayload', () => {
  it('sends every project key except the denylist (currently empty)', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    const expected = COLLECT_FORM_DATA_PROJECT_KEYS
      .filter((k) => !AGENT_PROJECT_DENYLIST.includes(k))
      .sort();
    expect(Object.keys(payload.project).sort()).toEqual(expected);
  });

  it('sends every conditions key except the denylist (currently empty)', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    const expected = COLLECT_FORM_DATA_CONDITIONS_KEYS
      .filter((k) => !AGENT_CONDITIONS_DENYLIST.includes(k))
      .sort();
    expect(Object.keys(payload.conditions).sort()).toEqual(expected);
  });

  it('carries strictly more project fields than the old hand-picked set', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    // The pre-denylist payload hand-picked exactly these five.
    for (const k of ['name', 'gc', 'buildingType', 'startDate', 'bidDate']) {
      expect(payload.project).toHaveProperty(k);
    }
    for (const k of ['address', 'drawingsRef', 'floors', 'scope', 'exclusions', 'durationWeeks']) {
      expect(payload.project, `newly-visible: ${k}`).toHaveProperty(k);
    }
  });

  it('a key added to a denylist is then withheld (mechanism, not just today)', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    // buildAgentPayload closes over the module constant, so exercise omit
    // directly with a non-empty denylist to prove the withhold path.
    const withheld = omit(state.conditions, ['notes', 'parking']);
    expect(withheld).not.toHaveProperty('notes');
    expect(withheld).not.toHaveProperty('parking');
    expect(withheld).toHaveProperty('wastePct');
  });

  it('intelligence is the same object, passed through whole', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    expect(payload.intelligence).toBe(state.intelligence);
  });

  it('history is passed through untouched', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    expect(payload.history).toBe(bidHistory);
  });

  it('costs stays the computed rounded summary, shape unchanged', () => {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    const payload = buildAgentPayload(state, summary, markupResult, bidHistory);
    expect(payload.costs).toEqual({
      directCost: 123457,
      overhead: 10,
      contingency: 21,
      profit: 31,
      totalMarkup: 62,
      finalBidPrice: 185519,
      effectiveMargin: 28.4,
    });
  });
});
