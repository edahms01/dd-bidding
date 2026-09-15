import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../../src/state/debounce.js';

// Split out of tests/unit/autosave.test.js (Migration Phase 5, Bucket 1,
// Step A) — debounce() stayed behind in js/debounce.js as its own small
// classic script through Bucket 1, rather than porting to src/state/
// alongside the rest of autosave.js, because forms.js/ui.js (its only
// two callers) were still classic scripts themselves. Ported for real in
// Bucket 2, Step 1, once both became real ES modules that could import
// it directly. See src/state/debounce.js's header comment for why.

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
