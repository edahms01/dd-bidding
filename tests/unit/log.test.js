import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, notifyTerminalFailure } from '../../netlify/functions/lib/log.js';

// Minimal in-memory stand-in for a Netlify Blobs store, same shape as
// bid-agent-jobs.test.js's fakeStore().
function fakeStore() {
  const m = new Map();
  return {
    _m: m,
    setJSON: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }
  };
}

describe('log', () => {
  let spy;
  beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  describe('logError', () => {
    it('prints "[fn] k=v ... error=<message>" with context before the message', () => {
      logError('bids', { method: 'PATCH', bid_id: 'abc123' }, new Error('No bid found for bid_id abc123'));
      expect(spy).toHaveBeenCalledWith('[bids] method=PATCH bid_id=abc123 error=No bid found for bid_id abc123');
    });

    it('omits the context segment entirely when context is empty', () => {
      logError('dev-clear-bids', {}, new Error('boom'));
      expect(spy).toHaveBeenCalledWith('[dev-clear-bids] error=boom');
    });

    it('drops undefined-valued context keys rather than printing "k=undefined"', () => {
      logError('rate-templates', { method: 'DELETE', id: undefined }, new Error('boom'));
      expect(spy).toHaveBeenCalledWith('[rate-templates] method=DELETE error=boom');
    });

    it('accepts a plain string in place of an Error object', () => {
      logError('bid-agent-background', { jobId: 'job-abc' }, 'missing/invalid jobId');
      expect(spy).toHaveBeenCalledWith('[bid-agent-background] jobId=job-abc error=missing/invalid jobId');
    });

    it('falls back to "unknown error" for a nullish err', () => {
      logError('x', {}, undefined);
      expect(spy).toHaveBeenCalledWith('[x] error=unknown error');
    });
  });

  describe('notifyTerminalFailure', () => {
    it('logs with an ALERT=true tag and writes a record to the given store', async () => {
      const store = fakeStore();
      await notifyTerminalFailure(store, 'bids', { method: 'POST' }, new Error('store unavailable'));

      expect(spy).toHaveBeenCalledWith('[bids] method=POST ALERT=true error=store unavailable');
      expect(store._m.size).toBe(1);
      const [key, record] = [...store._m.entries()][0];
      expect(key).toMatch(/^\d+_bids$/);
      expect(record).toMatchObject({
        fn: 'bids',
        context: { method: 'POST' },
        error: 'store unavailable'
      });
      expect(typeof record.ts).toBe('number');
    });

    it('does not throw when the store write itself fails — logs a second line and returns', async () => {
      const badStore = { setJSON: async () => { throw new Error('blobs down'); } };
      await expect(
        notifyTerminalFailure(badStore, 'bids', { method: 'PATCH', bid_id: 'x1' }, new Error('boom'))
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[bids] method=PATCH bid_id=x1 ALERT=true error=boom');
      expect(spy).toHaveBeenCalledWith('[log] failed to write errors record for bids: blobs down');
    });
  });
});
