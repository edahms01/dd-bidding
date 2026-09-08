import { describe, it, expect } from 'vitest';
import {
  omit,
  buildAgentPayload,
  AGENT_PROJECT_DENYLIST,
  AGENT_CONDITIONS_DENYLIST,
  AGENT_ASSEMBLY_DENYLIST,
  AGENT_WALL_DENYLIST,
  AGENT_CEILING_DENYLIST,
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

describe('buildAgentPayload — assemblies / walls / ceilings passthrough (2026-09-08)', () => {
  function argsWithRows(overrides = {}) {
    const { state, summary, markupResult, bidHistory } = fakeArgs();
    return {
      state: {
        ...state,
        assemblies: [
          {
            id: 'W1', category: 'Wall', studSize: '3-5/8"', layers: 2,
            boardType: 'Type-X', fireRating: '1-hr', acoustic: 'Yes',
            finishLevel: 4, exteriorWall: 'No', notes: 'extra fire-taping',
            wastePctOverride: 12, _key: 7, _num: 1,
          },
        ],
        walls: [
          { location: 'L1', typeId: 'W1', height: 14, lf: 320, grossSF: 4480, openings: 380, netSF: 4100, _key: 9 },
        ],
        ceilings: [
          { location: 'L1', typeId: 'C1', height: 14, grossSF: 3800, soffitLF: 60, openings: 220, netSF: 3580, _key: 11 },
        ],
        ...overrides,
      },
      summary, markupResult, bidHistory,
    };
  }

  it('every real row field reaches the payload verbatim', () => {
    const { state, summary, markupResult, bidHistory } = argsWithRows();
    const p = buildAgentPayload(state, summary, markupResult, bidHistory);
    expect(p.assemblies[0]).toEqual({
      id: 'W1', category: 'Wall', studSize: '3-5/8"', layers: 2,
      boardType: 'Type-X', fireRating: '1-hr', acoustic: 'Yes',
      finishLevel: 4, exteriorWall: 'No', notes: 'extra fire-taping',
      wastePctOverride: 12,
    });
    expect(p.walls[0]).toEqual({
      location: 'L1', typeId: 'W1', height: 14, lf: 320, grossSF: 4480, openings: 380, netSF: 4100,
    });
    expect(p.ceilings[0]).toEqual({
      location: 'L1', typeId: 'C1', height: 14, grossSF: 3800, soffitLF: 60, openings: 220, netSF: 3580,
    });
  });

  it('internal bookkeeping keys (_key / _num) are stripped', () => {
    const { state, summary, markupResult, bidHistory } = argsWithRows();
    const p = buildAgentPayload(state, summary, markupResult, bidHistory);
    expect(AGENT_ASSEMBLY_DENYLIST).toEqual(['_key', '_num']);
    expect(AGENT_WALL_DENYLIST).toEqual(['_key']);
    expect(AGENT_CEILING_DENYLIST).toEqual(['_key']);
    for (const row of [...p.assemblies, ...p.walls, ...p.ceilings]) {
      expect(row).not.toHaveProperty('_key');
      expect(row).not.toHaveProperty('_num');
    }
  });

  it('empty arrays and missing slices do not throw', () => {
    const { summary, markupResult, bidHistory } = fakeArgs();
    for (const state of [
      { project: {}, conditions: {}, intelligence: {}, assemblies: [], walls: [], ceilings: [] },
      { project: {}, conditions: {}, intelligence: {} }, // slices absent entirely
    ]) {
      const p = buildAgentPayload(state, summary, markupResult, bidHistory);
      expect(p.assemblies).toEqual([]);
      expect(p.walls).toEqual([]);
      expect(p.ceilings).toEqual([]);
    }
  });

  it('spacing is gone from the row shape entirely', () => {
    const { state, summary, markupResult, bidHistory } = argsWithRows({
      assemblies: [{ id: 'W1', category: 'Wall', spacing: '16"', layers: 1, _key: 1, _num: 1 }],
    });
    const p = buildAgentPayload(state, summary, markupResult, bidHistory);
    // omit() only strips the denylist — a stale `spacing` on an old
    // in-memory row would pass straight through. The real guarantee is
    // that collectFormData()/blankAssemblyRow() no longer produce it;
    // this asserts the denylist is NOT relied on to hide it.
    expect(AGENT_ASSEMBLY_DENYLIST).not.toContain('spacing');
  });
});
