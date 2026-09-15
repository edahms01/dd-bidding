// ─────────────────────────────────────────────────────────────────────
// rateTemplates.js — Rate template persistence layer (Tier 5, Part 1)
// Thin fetch() wrapper around netlify/functions/rate-templates.js +
// Netlify Blobs, mirroring js/history.js's exact pattern — a shared
// company resource lives server-side, not in localStorage.
//
// Migration Phase 5, Bucket 1, Step B: ported from js/rate-templates.js
// (a classic <script>-tag global) to a real ES module. No window bridge
// needed — confirmed by grep, zero classic-script callers ever existed
// (the old js/ui.js rate-template UI chain and js/forms.js's
// applyRateTemplate() were already deleted in the
// dead-classic-rate-template-removal cleanup, 2026-09-10).
// src/pages/RatesPage.jsx is the sole caller, converted to a real
// import in this same step.
// ─────────────────────────────────────────────────────────────────────

const RATE_TEMPLATES_ENDPOINT = '/.netlify/functions/rate-templates';

// cache: 'no-store' on every call, paired with the function's own
// Cache-Control: no-store response header, same defense-in-depth
// reasoning as js/history.js's bid-storage calls.

export async function getAllRateTemplates() {
  const res = await fetch(RATE_TEMPLATES_ENDPOINT, { cache: 'no-store' });
  if (!res.ok) throw new Error('getAllRateTemplates failed: ' + res.status);
  return res.json();
}

export async function saveRateTemplate(name, rates, rateEscalation) {
  const res = await fetch(RATE_TEMPLATES_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    cache:   'no-store',
    body:    JSON.stringify({ name, rates, rateEscalation })
  });
  if (!res.ok) throw new Error('saveRateTemplate failed: ' + res.status);
  return res.json();
}

export async function deleteRateTemplate(id) {
  const res = await fetch(RATE_TEMPLATES_ENDPOINT + '?id=' + encodeURIComponent(id), { method: 'DELETE', cache: 'no-store' });
  if (!res.ok) throw new Error('deleteRateTemplate failed: ' + res.status);
}
