import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../js/ui.js';

// js/ui.js is otherwise pure DOM/display code (see its file header) —
// escapeHtml() is the one function in it with no DOM dependency, which
// is why it's directly importable here under Vitest's plain 'node'
// environment (no jsdom). The file's one top-level DOM side effect
// (document.addEventListener('keydown', ...)) is guarded specifically
// so this import doesn't throw before reaching the export.
describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes a mix of markup and text, in document order, without double-escaping', () => {
    expect(escapeHtml('<b>Bold & "quoted"</b>'))
      .toBe('&lt;b&gt;Bold &amp; &quot;quoted&quot;&lt;/b&gt;');
  });

  it('leaves normal text with no special characters unchanged', () => {
    expect(escapeHtml('Harborview Plaza')).toBe('Harborview Plaza');
    expect(escapeHtml('Turner Construction')).toBe('Turner Construction');
  });

  it('returns an empty string for an empty or falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
