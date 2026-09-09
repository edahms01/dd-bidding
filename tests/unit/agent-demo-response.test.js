import { describe, it, expect } from 'vitest';
import { _demoResponse } from '../../js/agent.js';

// The demo response is a fully fixed literal now — the old client-side
// scoring table that derived winLikelihood from state.intelligence is
// gone (the live model reports its own per-option `factors`). These pins
// keep the demo from visibly changing for anyone already familiar with
// it, and enforce the new `factors` shape.

const DIRECTIONS = ['positive', 'negative', 'neutral'];

describe('_demoResponse — fixed win-likelihood literals + factors', () => {
  const r = _demoResponse({ intelligence: {} }, {}, {}, []);
  const byType = Object.fromEntries(r.options.map((o) => [o.type, o]));

  it('returns the three options with the literal winLikelihood the old dynamic function produced for the seed', () => {
    // Verified by running the pre-deletion scoring function against
    // data/seed.json's intelligence: gcRelationship strong (+1),
    // gcPriceSensitivity balanced (0), competitionLevel moderate (0),
    // dirigoEdge strong (+1) → competitive base 2 = Very High, recommended
    // base 0 = High, ambitious base -2 = Medium.
    expect(byType.competitive.winLikelihood).toBe('Very High');
    expect(byType.recommended.winLikelihood).toBe('High');
    expect(byType.ambitious.winLikelihood).toBe('Medium');
  });

  it('does not read state.intelligence — the literal is the same regardless of input', () => {
    const other = _demoResponse(
      { intelligence: { gcRelationship: 'difficult', competitionLevel: 'heavy', dirigoEdge: 'weak' } },
      {}, {}, []
    );
    expect(other.options.map((o) => o.winLikelihood)).toEqual(['Very High', 'High', 'Medium']);
  });

  it('gives every option a non-empty factors array of the new shape (2-5 items)', () => {
    for (const o of r.options) {
      expect(Array.isArray(o.factors)).toBe(true);
      expect(o.factors.length).toBeGreaterThanOrEqual(2);
      expect(o.factors.length).toBeLessThanOrEqual(5);
      for (const f of o.factors) {
        expect(typeof f.label).toBe('string');
        expect(f.label.length).toBeGreaterThan(0);
        expect(DIRECTIONS).toContain(f.direction);
        expect(typeof f.note).toBe('string');
        expect(f.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('mixes directions where the option prose implies a trade-off', () => {
    // ambitious ("at the cost of win probability") is not uniformly positive
    const dirs = byType.ambitious.factors.map((f) => f.direction);
    expect(dirs).toContain('negative');
  });
});
