import { describe, it, expect } from 'vitest';
import {
  STORE_NAME, isValidJobId, pendingRecord, doneRecord, errorRecord, readJob, writeJob
} from '../../netlify/functions/lib/bid-agent-jobs.js';

// Minimal in-memory stand-in for a Netlify Blobs store.
function fakeStore() {
  const m = new Map();
  return {
    _m: m,
    get: async (k, opts) => {
      if (!m.has(k)) return null;
      return (opts && opts.type === 'json') ? m.get(k) : JSON.stringify(m.get(k));
    },
    setJSON: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }
  };
}

describe('bid-agent-jobs', () => {
  it('names the store', () => {
    expect(STORE_NAME).toBe('bid-agent-jobs');
  });

  it('isValidJobId accepts client ids and rejects junk', () => {
    expect(isValidJobId('job-' + '0'.repeat(12))).toBe(true);
    expect(isValidJobId('job-3f2a9c1b-1111-2222-3333-444455556666')).toBe(true);
    expect(isValidJobId('short')).toBe(false);
    expect(isValidJobId('has spaces and stuff!!')).toBe(false);
    expect(isValidJobId('')).toBe(false);
    expect(isValidJobId(null)).toBe(false);
    expect(isValidJobId(42)).toBe(false);
    expect(isValidJobId('x'.repeat(200))).toBe(false);
  });

  it('record shapes', () => {
    expect(pendingRecord().status).toBe('pending');
    const d = doneRecord({ options: [] });
    expect(d.status).toBe('done');
    expect(d.recommendation).toEqual({ options: [] });
    const e = errorRecord('boom');
    expect(e.status).toBe('error');
    expect(e.error).toBe('boom');
    expect(errorRecord().error).toBe('unknown error');
    expect(typeof pendingRecord().ts).toBe('number');
  });

  it('writeJob then readJob round-trips the record', async () => {
    const store = fakeStore();
    await writeJob(store, 'job-abcdefghij', pendingRecord());
    expect((await readJob(store, 'job-abcdefghij')).status).toBe('pending');

    await writeJob(store, 'job-abcdefghij', doneRecord({ ok: 1 }));
    const rec = await readJob(store, 'job-abcdefghij');
    expect(rec.status).toBe('done');
    expect(rec.recommendation).toEqual({ ok: 1 });
  });

  it('readJob returns null for an absent key (client treats it as pending)', async () => {
    expect(await readJob(fakeStore(), 'job-neverwritten')).toBeNull();
  });
});
