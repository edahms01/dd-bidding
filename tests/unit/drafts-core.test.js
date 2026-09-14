import { describe, it, expect } from 'vitest';
import {
  STORE_NAME, isValidDraftId, readDraft, writeDraft, deleteDraftRecord, readAllDrafts
} from '../../netlify/functions/lib/drafts-core.js';

// Same fakeStore() shape as bids-core.test.js / bid-agent-jobs.test.js —
// a Map-backed stand-in for a Netlify Blobs store.
function fakeStore() {
  const m = new Map();
  return {
    _m: m,
    get: async (k, opts) => {
      if (!m.has(k)) return null;
      return (opts && opts.type === 'json') ? m.get(k) : JSON.stringify(m.get(k));
    },
    setJSON: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k) => { m.delete(k); },
    list: async () => ({ blobs: Array.from(m.keys()).map((key) => ({ key, etag: 'fake' })), directories: [] })
  };
}

describe('drafts-core', () => {
  it('names the store', () => {
    expect(STORE_NAME).toBe('drafts');
  });

  it('isValidDraftId accepts client-generated ids and rejects junk', () => {
    expect(isValidDraftId('draft_1789370578138_ab3f9')).toBe(true);
    expect(isValidDraftId('')).toBe(false);
    expect(isValidDraftId(null)).toBe(false);
    expect(isValidDraftId(undefined)).toBe(false);
    expect(isValidDraftId(42)).toBe(false);
    expect(isValidDraftId('has spaces')).toBe(false);
    expect(isValidDraftId('x'.repeat(200))).toBe(false);
  });
});

describe('readDraft / writeDraft / deleteDraftRecord', () => {
  it('writeDraft then readDraft round-trips the record', async () => {
    const store  = fakeStore();
    const record = { id: 'draft_1', project: { name: 'Harborview' }, lastModifiedAt: '2026-09-14T00:00:00.000Z' };
    await writeDraft(store, 'draft_1', record);
    expect(await readDraft(store, 'draft_1')).toEqual(record);
  });

  it('readDraft returns null for an absent key (client treats as not-found)', async () => {
    expect(await readDraft(fakeStore(), 'nope')).toBeNull();
  });

  it('writeDraft overwrites an existing record wholesale (upsert semantics)', async () => {
    const store = fakeStore();
    await writeDraft(store, 'draft_1', { id: 'draft_1', project: { name: 'A' } });
    await writeDraft(store, 'draft_1', { id: 'draft_1', project: { name: 'B' } });
    expect(await readDraft(store, 'draft_1')).toEqual({ id: 'draft_1', project: { name: 'B' } });
  });

  it('deleteDraftRecord removes the record', async () => {
    const store = fakeStore();
    await writeDraft(store, 'draft_1', { id: 'draft_1' });
    await deleteDraftRecord(store, 'draft_1');
    expect(await readDraft(store, 'draft_1')).toBeNull();
  });

  it('deleteDraftRecord on a missing key is a harmless no-op', async () => {
    const store = fakeStore();
    await expect(deleteDraftRecord(store, 'nope')).resolves.toBeUndefined();
  });
});

describe('readAllDrafts', () => {
  it('returns an empty map for an empty store', async () => {
    expect(await readAllDrafts(fakeStore())).toEqual({});
  });

  it('returns every draft keyed by id — the exact shape the old getAllDrafts() returned from localStorage', async () => {
    const store = fakeStore();
    await writeDraft(store, 'draft_1', { id: 'draft_1', project: { name: 'A' } });
    await writeDraft(store, 'draft_2', { id: 'draft_2', project: { name: 'B' } });

    expect(await readAllDrafts(store)).toEqual({
      draft_1: { id: 'draft_1', project: { name: 'A' } },
      draft_2: { id: 'draft_2', project: { name: 'B' } }
    });
  });
});
