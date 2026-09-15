import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

// Preflight check: stand up Vite against the current vanilla app with its
// classic (non-module) <script src="js/..."> tags completely unchanged, to
// verify Vite can build/serve this app before any export-conversion work
// starts. See docs/phase-a-implementation-plan.md, PREFLIGHT section.
//
// Finding (Preflight step 1): `vite build` refuses to bundle classic
// (non type="module") <script src> tags and — critically — does NOT copy
// the files they reference into dist/ either. `vite preview`'s SPA
// fallback then serves index.html's *content* for those missing paths
// with a 200 status, which looks like success until a browser tries to
// parse that HTML as JavaScript. Fix: explicitly copy the classic-script
// sources into the build output.
//
// LIFECYCLE NOTE — A2 found this plugin was still needed (js/*.js stayed
// classic <script> tags, module conversion deferred — see CLAUDE.md's A2
// close-out). Migration Phase 5, Bucket 2 finally converted every
// js/*.js and data/seed.js to real module imports (Steps 1 and 2), so
// there is no classic-script source left to raw-copy at all — the
// former COPY_DIRS-based directory copy (['js', 'data'], then just
// ['data'] after Step 1) is gone. What's left is a genuinely different
// thing: data/seed.json is not a classic script, never was — it's plain
// data, fetched at runtime (data/seed.js's `fetch('./data/seed.json')`),
// which Vite has no reason to bundle and would otherwise drop from
// dist/ entirely, the exact same "build looks clean, 404s at runtime"
// failure mode this plugin has always existed to catch. Copying the
// single file directly (not a directory) also sidesteps the class of
// bug Step 2 surfaced: data/seed.js became a real bundled import that
// COPY_DIRS's directory-wide copy kept raw-duplicating into dist/data/
// alongside the real bundle, silently, until caught by inspecting dist/
// directly — copying only the one genuine data file can't repeat that.
const COPY_FILES = ['data/seed.json'];

export default defineConfig({
  build: {
    outDir: 'dist'
  },
  plugins: [
    react(),
    {
      name: 'copy-runtime-data-files',
      closeBundle() {
        const missing = [];
        for (const src of COPY_FILES) {
          const dest = `dist/${src}`;
          mkdirSync(dirname(dest), { recursive: true });
          cpSync(src, dest);
          try {
            statSync(dest);
          } catch {
            missing.push(dest);
          }
        }
        if (missing.length > 0) {
          throw new Error(
            `copy-runtime-data-files: build output is missing ${missing.length} expected file(s):\n` +
            missing.map(f => `  - ${f}`).join('\n')
          );
        }
      }
    }
  ]
});
