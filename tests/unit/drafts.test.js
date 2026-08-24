import { describe, it, expect } from 'vitest';
import {
  buildDraftRecord,
  migrateLegacyBidToDrafts,
  cloneDraftForDuplicate,
  removeDraftAndClearActiveIfNeeded,
  getOpenDraftCount
} from '../../js/drafts.js';

function sampleState(overrides = {}) {
  return {
    project: { name: 'Test Project' },
    conditions: {}, rates: {}, assemblies: [], walls: [], ceilings: [],
    intelligence: {}, markupInputs: {},
    ...overrides
  };
}

describe('buildDraftRecord', () => {
  it('wraps a collectFormData()-shaped state with id/timestamps and the Phase 1 export shape', () => {
    const record = buildDraftRecord(sampleState(), 'd1', 't0', 't1');
    expect(record.id).toBe('d1');
    expect(record.createdAt).toBe('t0');
    expect(record.lastModifiedAt).toBe('t1');
    expect(record.schemaVersion).toBeDefined();
    expect(record.project.name).toBe('Test Project');
  });
});

describe('migrateLegacyBidToDrafts', () => {
  it('wraps an existing legacy bid into a draft on first run', () => {
    const result = migrateLegacyBidToDrafts({
      currentBidState: sampleState({ project: { name: 'Legacy Bid' } }),
      draftsAlreadyExist: false,
      id: 'd1',
      now: 't0'
    });
    expect(result).not.toBeNull();
    expect(result.activeDraftId).toBe('d1');
    expect(result.drafts.d1.project.name).toBe('Legacy Bid');
  });

  it('returns an empty drafts map when there is nothing to migrate (fresh install)', () => {
    const result = migrateLegacyBidToDrafts({
      currentBidState: null,
      draftsAlreadyExist: false,
      id: 'd1',
      now: 't0'
    });
    expect(result).toEqual({ drafts: {}, activeDraftId: null });
  });

  it('runs exactly once — a second call with drafts already existing is a no-op, not a double-wrap', () => {
    const first = migrateLegacyBidToDrafts({
      currentBidState: sampleState(),
      draftsAlreadyExist: false,
      id: 'd1',
      now: 't0'
    });
    expect(first).not.toBeNull();

    const second = migrateLegacyBidToDrafts({
      currentBidState: sampleState(), // same legacy value still present
      draftsAlreadyExist: true,       // but drafts now exist
      id: 'd2',
      now: 't1'
    });
    expect(second).toBeNull();
  });
});

describe('cloneDraftForDuplicate', () => {
  it('produces a copy independent of the source — mutating one does not affect the other', () => {
    const source = buildDraftRecord(sampleState({ walls: [{ location: 'Floor 1' }] }), 'd1', 't0', 't0');
    const copy   = cloneDraftForDuplicate(source, 'd2', 't1');

    expect(copy.id).toBe('d2');
    expect(copy.createdAt).toBe('t1');
    expect(copy.lastModifiedAt).toBe('t1');
    expect(copy.project).toEqual(source.project);

    copy.project.name = 'Mutated';
    copy.walls[0].location = 'Mutated';
    expect(source.project.name).toBe('Test Project');
    expect(source.walls[0].location).toBe('Floor 1');
  });

  it('handles a draft with zero rows in assemblies/walls/ceilings', () => {
    const source = buildDraftRecord(sampleState(), 'd1', 't0', 't0');
    const copy   = cloneDraftForDuplicate(source, 'd2', 't1');
    expect(copy.assemblies).toEqual([]);
    expect(copy.walls).toEqual([]);
    expect(copy.ceilings).toEqual([]);
  });
});

describe('removeDraftAndClearActiveIfNeeded', () => {
  it('clears activeDraftId when the removed draft was the active one', () => {
    const drafts = { d1: {}, d2: {} };
    const result = removeDraftAndClearActiveIfNeeded(drafts, 'd1', 'd1');
    expect(result.activeDraftId).toBeNull();
    expect(result.drafts).toEqual({ d2: {} });
  });

  it('leaves activeDraftId untouched when the removed draft was not the active one', () => {
    const drafts = { d1: {}, d2: {} };
    const result = removeDraftAndClearActiveIfNeeded(drafts, 'd1', 'd2');
    expect(result.activeDraftId).toBe('d2');
    expect(result.drafts).toEqual({ d2: {} });
  });

  it('does not mutate the input map', () => {
    const drafts = { d1: {}, d2: {} };
    removeDraftAndClearActiveIfNeeded(drafts, 'd1', 'd1');
    expect(drafts).toEqual({ d1: {}, d2: {} });
  });
});

describe('getOpenDraftCount', () => {
  it('returns 0 for an empty drafts map', () => {
    expect(getOpenDraftCount({}, null)).toBe(0);
  });

  it('returns 0 when the only draft is the active one', () => {
    expect(getOpenDraftCount({ d1: {} }, 'd1')).toBe(0);
  });

  it('excludes the active draft from the count of several', () => {
    const drafts = { d1: {}, d2: {}, d3: {} };
    expect(getOpenDraftCount(drafts, 'd1')).toBe(2);
  });

  it('counts every draft when none of them is the active one', () => {
    const drafts = { d1: {}, d2: {} };
    expect(getOpenDraftCount(drafts, 'not-a-real-id')).toBe(2);
  });
});
