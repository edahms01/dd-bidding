import { describe, it, expect } from 'vitest';
import { stampNewTemplate, removeTemplate } from '../../netlify/functions/lib/rate-templates-core.js';

describe('stampNewTemplate', () => {
  it('assigns an id and createdAt without dropping name/rates', () => {
    const rates  = { framing: 4.5, hanging: 2.1, burdenPct: 32 };
    const record = stampNewTemplate('Standard commercial', rates);

    expect(record.name).toBe('Standard commercial');
    expect(record.rates).toEqual(rates);
    expect(record.id).toMatch(/^rt_\d+_[a-z0-9]+$/);
    expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('produces different ids across calls', () => {
    const a = stampNewTemplate('A', {});
    const b = stampNewTemplate('B', {});
    expect(a.id).not.toBe(b.id);
  });

  it('carries a passed rateEscalation through to the returned record (Tier 5, Part 2)', () => {
    const rateEscalation = { stud: { '2-1/2"': 5 }, board: { 'Type-X': 5 }, tape: null, insul: null, fasten: null };
    const record = stampNewTemplate('Steel up 5%', {}, rateEscalation);
    expect(record.rateEscalation).toEqual(rateEscalation);
  });

  it('defaults rateEscalation to null when the third argument is omitted, not an error', () => {
    const record = stampNewTemplate('Standard commercial', {});
    expect(record.rateEscalation).toBeNull();
  });
});

describe('removeTemplate', () => {
  it('filters out the matching record', () => {
    const templates = [{ id: 'a' }, { id: 'b' }];
    expect(removeTemplate(templates, 'a')).toEqual([{ id: 'b' }]);
  });

  it('returns the array unchanged when id has no match', () => {
    const templates = [{ id: 'a' }];
    expect(removeTemplate(templates, 'nope')).toEqual(templates);
  });

  it('does not mutate the input array', () => {
    const templates = [{ id: 'a' }, { id: 'b' }];
    removeTemplate(templates, 'a');
    expect(templates).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});
