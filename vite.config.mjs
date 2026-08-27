import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
// parse that HTML as JavaScript. Fix: explicitly copy the directories
// containing classic-script sources into the build output. This is an
// addition to vite.config.mjs only — index.html and the js/ directory
// layout are untouched.
//
// LIFECYCLE NOTE — this plugin must be deleted in A2, not kept around.
// Once js/*.js become real module imports, Vite bundles them for real;
// a plugin still copying the raw source files would ship untransformed
// duplicates alongside the bundled output — silent, and easy to miss in
// a local check. Tracked as an explicit A2 checklist item.
const COPY_DIRS = ['js', 'data'];

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

export default defineConfig({
  build: {
    outDir: 'dist'
  },
  plugins: [
    react(),
    {
      name: 'copy-classic-script-sources',
      closeBundle() {
        for (const dir of COPY_DIRS) {
          cpSync(dir, `dist/${dir}`, { recursive: true });
        }

        // Build-time assertion: fail loudly if the copy silently drops a
        // file, rather than shipping a dist/ that 404s at runtime. This
        // is a generic directory-listing diff, not a hardcoded file
        // list, so it stays correct as files are added/removed without
        // needing manual upkeep here.
        const missing = [];
        for (const dir of COPY_DIRS) {
          for (const src of listFilesRecursive(dir)) {
            const expected = join('dist', src);
            try {
              statSync(expected);
            } catch {
              missing.push(expected);
            }
          }
        }
        if (missing.length > 0) {
          throw new Error(
            `copy-classic-script-sources: build output is missing ${missing.length} expected file(s):\n` +
            missing.map(f => `  - ${f}`).join('\n')
          );
        }
      }
    }
  ]
});
