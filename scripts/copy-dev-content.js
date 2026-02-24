/**
 * Copies content scripts and utils into dist/ and writes dist manifest for dev.
 * Run after Vite dev build. Load the extension from the dist/ folder in Chrome.
 * Uses root manifest.json as single source of truth; see scripts/copy-to-dist.js.
 */

import { run as runCopyToDist } from "./copy-to-dist.js";

/** Run after every dev build (dev-watch calls this so it runs on each rebuild, not only on first import). */
export function run() {
  try {
    runCopyToDist();
    console.log("[copy-dev-content] Content and utils copied to dist/. Load the 'dist' folder in Chrome.");
  } catch (e) {
    console.error("[copy-dev-content] Copy error:", e?.message || e);
    console.log("[copy-dev-content] Manifest written to dist/. Load the 'dist' folder in Chrome.");
  }
}
