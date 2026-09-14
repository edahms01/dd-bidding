// ─────────────────────────────────────────────────────────────────────
// useDraftsList.js — Migration Phase 2 Step 2B.
//
// Shared "list of drafts, with a loading/ready/error tri-state" hook —
// mirrors BidsPage.jsx's existing bidsStatus pattern (the precedent this
// migration was told to follow) for the newly-async drafts store. One
// network fetch per mount (window.getAllDrafts(), js/forms.js); every
// subsequent create/duplicate/delete/switch/autosave anywhere in the app
// updates the shared in-memory cache (_draftsCache) and fires
// 'dirigo:drafts-changed', which every mounted instance of this hook
// picks up from the cache directly — no extra round-trip per surface.
//
// Used by AppShell.jsx's nav list + OpenBidMenu, BidsPage.jsx, and
// HomePage.jsx — one definition instead of reimplemented per surface.
//
// Optional `refetchKey`: a network re-fetch (not just a re-read of the
// already-warm cache) runs whenever this value changes, in addition to
// on mount. AppShell's always-visible nav list passes nothing (fetch
// once at mount; the shared cache/event keeps it current after that —
// no added loading state, per the plan, since the fetch is fast enough
// not to need one). OpenBidMenu passes its own `open` state, so opening
// the dropdown re-fetches, matching the old refresh-on-open behavior.
// BidsPage/HomePage pass their `active` prop, matching their pre-
// existing "reload on every becomes-active transition" behavior (e.g.
// a draft created/renamed/corrupted elsewhere shows current data on
// return to that page — same contract their old effects already had).
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

export function useDraftsList(refetchKey) {
  const [drafts, setDrafts] = useState(() => Object.values(window.__getDraftsCacheSync?.() || {}));
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await window.getAllDrafts();
        if (!cancelled) { setDrafts(Object.values(map)); setStatus('ready'); }
      } catch (e) {
        if (!cancelled) setStatus('error');
      }
    })();

    function onChange() {
      setDrafts(Object.values(window.__getDraftsCacheSync?.() || {}));
    }
    window.addEventListener('dirigo:drafts-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('dirigo:drafts-changed', onChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchKey]);

  return { drafts, status };
}
