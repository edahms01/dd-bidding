// ─────────────────────────────────────────────────────────────────────
// router.js — Phase C 2.2. Hash-based URL routing, no dependency.
//
// The URL hash is a *projection* of state.ui (activeSection +
// activeTab), synced in both directions from AppShell:
//
//   state -> URL   a useEffect on [activeSection, activeTab] pushes the
//                  canonical hash (replaceState on the very first run so
//                  "app booted" isn't its own history entry; pushState
//                  afterwards so every navigation the user triggers is a
//                  real Back target).
//   URL -> state   a `hashchange` listener parses location.hash and
//                  dispatches GOTO_TAB / GOTO_SECTION to match.
//
// The two don't fight: pushState/replaceState never fire `hashchange`,
// and a hashchange-driven dispatch leaves location.hash already equal to
// the canonical hash, so the state->URL effect's `hash !== desired`
// guard makes it a no-op — that guard is what prevents the classic
// bounce-between-two-history-entries failure. Verified by clicking
// through steps and hammering Back/Forward (tests/e2e/url-routing.spec.js),
// not by reasoning alone.
//
// Slugs in this phase are the internal tab keys verbatim. Phase C Step 2
// (the reorder + renames) introduces the public slugs the decision
// record names (#/site-conditions, #/cost-summary, #/market-read,
// #/bid-strategy) plus the `market` step; Step 4 adds #/bids and
// #/bids/<id>, Step 5 #/bid-decision. Keeping the slug<->key mapping in
// this one table is what makes those later changes a table edit rather
// than a hunt.
// ─────────────────────────────────────────────────────────────────────

export const HASH_PREFIX = '#/';

// { slug, section, tab } — `tab` only meaningful when section === 'workflow'.
// Order here is for readability only; lookup is by slug or by section+tab.
export const ROUTES = [
  { slug: 'project',    section: 'workflow', tab: 'project' },
  { slug: 'conditions', section: 'workflow', tab: 'conditions' },
  { slug: 'rates',      section: 'workflow', tab: 'rates' },
  { slug: 'assemblies', section: 'workflow', tab: 'assemblies' },
  { slug: 'walls',      section: 'workflow', tab: 'walls' },
  { slug: 'ceilings',   section: 'workflow', tab: 'ceilings' },
  { slug: 'output',     section: 'workflow', tab: 'output' },
  { slug: 'agent',      section: 'workflow', tab: 'agent' },
  { slug: 'history',    section: 'history',  tab: null },
  { slug: 'dashboard',  section: 'dashboard', tab: null }
];

// "#/walls" | "#walls" | "#/walls/" | "walls"  ->  { section, tab } | null
export function parseHash(hash) {
  if (!hash) return null;
  const seg = String(hash).replace(/^#/, '').replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
  if (!seg) return null;
  const route = ROUTES.find((r) => r.slug === seg);
  return route ? { section: route.section, tab: route.tab } : null;
}

// (activeSection, activeTab) -> canonical slug string (no leading "#/").
// Section wins: on History/Dashboard the workflow tab is irrelevant.
export function routeToHash(section, tab) {
  if (section !== 'workflow') {
    const s = ROUTES.find((r) => r.section === section);
    return s ? s.slug : 'project';
  }
  const t = ROUTES.find((r) => r.section === 'workflow' && r.tab === tab);
  return t ? t.slug : 'project';
}

// Full "#/walls" form for comparing against location.hash / assigning.
export function canonicalHash(section, tab) {
  return HASH_PREFIX + routeToHash(section, tab);
}
