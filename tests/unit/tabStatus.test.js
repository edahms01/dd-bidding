import { describe, it, expect } from 'vitest';
import {
  tabStatus, fieldFilled, allLeavesFilled, normalize
} from '../../src/state/stepStatus.js';

// Manual tab-confirmation model — pure helpers behind stepStatus().
// The store/DOM-dependent bits (ownedSliceJSON wiring, the Send-to-Agent
// gate, reactive revert) are covered by the Playwright specs.

describe('tabStatus', () => {
  const SNAP = '{"name":"x"}';

  it("'complete' only when confirmed AND the snapshot matches the live slice", () => {
    expect(tabStatus(SNAP, { confirmed: true, snapshot: SNAP }, true)).toBe('complete');
    expect(tabStatus(SNAP, { confirmed: true, snapshot: SNAP }, false)).toBe('complete');
  });

  it("'partial' when eligible but not confirmed, or confirmed-then-edited", () => {
    expect(tabStatus(SNAP, { confirmed: false, snapshot: null }, true)).toBe('partial');
    expect(tabStatus(SNAP, { confirmed: true, snapshot: '{"name":"old"}' }, true)).toBe('partial');
  });

  it("'empty' when not eligible and not currently matching", () => {
    expect(tabStatus(SNAP, { confirmed: false, snapshot: null }, false)).toBe('empty');
    expect(tabStatus(SNAP, { confirmed: true, snapshot: '{"name":"old"}' }, false)).toBe('empty');
  });

  it('tolerates a missing confirmation entry', () => {
    expect(tabStatus(SNAP, undefined, true)).toBe('partial');
    expect(tabStatus(SNAP, undefined, false)).toBe('empty');
  });
});

describe('fieldFilled — "not blank", not "truthy"', () => {
  it('blank: undefined, empty string, whitespace, empty array', () => {
    expect(fieldFilled(undefined)).toBe(false);
    expect(fieldFilled('')).toBe(false);
    expect(fieldFilled('   ')).toBe(false);
    expect(fieldFilled([])).toBe(false);
  });

  it('filled: 0, "0", false, null (explicit n/a), non-empty string/array', () => {
    expect(fieldFilled(0)).toBe(true);
    expect(fieldFilled('0')).toBe(true);
    expect(fieldFilled(false)).toBe(true);
    expect(fieldFilled(null)).toBe(true);
    expect(fieldFilled('x')).toBe(true);
    expect(fieldFilled(['a'])).toBe(true);
  });
});

describe('allLeavesFilled — recurses nested objects', () => {
  it('false when any leaf (incl. a nested one) is blank', () => {
    expect(allLeavesFilled({ a: '1', b: '' })).toBe(false);
    expect(allLeavesFilled({ a: '1', finish: { 1: '5', 2: '' } })).toBe(false);
  });

  it('true when every leaf is filled, 0 included', () => {
    expect(allLeavesFilled({ a: '1', b: 0, finish: { 1: '5', 2: 0 } })).toBe(true);
  });
});

describe('normalize — stable across the save/reload string<->number drift', () => {
  it('key order and string vs number do not matter', () => {
    expect(JSON.stringify(normalize({ b: 1, a: '1' })))
      .toBe(JSON.stringify(normalize({ a: 1, b: '1' })));
  });

  it('coerces leaves but keeps structure', () => {
    expect(normalize({ x: 12, y: { z: 0 }, arr: [3, '3'] }))
      .toEqual({ arr: ['3', '3'], x: '12', y: { z: '0' } });
  });

  it('undefined and null both normalize to null', () => {
    expect(normalize(undefined)).toBe(null);
    expect(normalize(null)).toBe(null);
  });
});
