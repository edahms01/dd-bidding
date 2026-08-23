import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  debounce,
  buildExportPayload,
  validateImportPayload,
  migrateSchema
} from '../../js/autosave.js';

// A representative collectFormData()-shaped object (js/state.js:168).
function sampleState(overrides = {}) {
  return {
    project: { name: 'Test Project', gc: 'Acme GC', bidDate: '2026-08-23' },
    conditions: { maxHt: 12, confidence: 'md' },
    rates: { framing: 1.5, hanging: 0.9 },
    assemblies: [{ id: 'W1', category: 'Wall' }],
    walls: [{ location: 'Floor 1', grossSF: 500 }],
    ceilings: [{ location: 'Lobby', grossSF: 200 }],
    intelligence: { crewAvailability: 'high' },
    markupInputs: { overheadPct: 10, profitPct: 8 },
    ...overrides
  };
}

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires exactly once after multiple calls inside the window', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 700);
    debounced(); debounced(); debounced();
    vi.advanceTimersByTime(699);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not fire before the window elapses', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 700);
    debounced();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires again after a subsequent quiet period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 700);
    debounced();
    vi.advanceTimersByTime(700);
    expect(fn).toHaveBeenCalledTimes(1);
    debounced();
    vi.advanceTimersByTime(700);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('buildExportPayload', () => {
  const requiredKeys = ['project', 'conditions', 'rates', 'assemblies', 'walls', 'ceilings', 'intelligence', 'markupInputs', 'schemaVersion'];

  it('includes schemaVersion and every expected section key', () => {
    const payload = buildExportPayload(sampleState());
    requiredKeys.forEach(key => expect(payload).toHaveProperty(key));
    expect(payload.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('includes every section key when walls/ceilings/assemblies are empty', () => {
    const payload = buildExportPayload(sampleState({ assemblies: [], walls: [], ceilings: [] }));
    requiredKeys.forEach(key => expect(payload).toHaveProperty(key));
    expect(payload.assemblies).toEqual([]);
    expect(payload.walls).toEqual([]);
    expect(payload.ceilings).toEqual([]);
  });
});

describe('validateImportPayload', () => {
  it('rejects invalid JSON', () => {
    const result = validateImportPayload('{not valid json');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects valid JSON missing schemaVersion', () => {
    const result = validateImportPayload(JSON.stringify({ project: {} }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/schemaVersion/);
  });

  it('rejects valid JSON missing project', () => {
    const result = validateImportPayload(JSON.stringify({ schemaVersion: 1 }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/project/);
  });

  it('accepts a well-formed payload', () => {
    const payload = buildExportPayload(sampleState());
    const result = validateImportPayload(JSON.stringify(payload));
    expect(result.valid).toBe(true);
    expect(result.data.project.name).toBe('Test Project');
  });
});

describe('migrateSchema', () => {
  it('passes through unchanged at the current schema version', () => {
    const data = { schemaVersion: CURRENT_SCHEMA_VERSION, project: { name: 'X' } };
    expect(migrateSchema(data)).toEqual(data);
  });

  it('stamps the current version when schemaVersion is missing', () => {
    const data = { project: { name: 'Legacy' } };
    const migrated = migrateSchema(data);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.project).toEqual(data.project);
  });

  it('stamps the current version when schemaVersion is older', () => {
    const data = { schemaVersion: 0, project: { name: 'Old' } };
    const migrated = migrateSchema(data);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
