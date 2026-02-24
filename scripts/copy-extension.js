/**
 * Copies extension assets into dist/ and writes a dist-ready manifest.
 * Run after `vite build` (which outputs popup to dist/).
 * Uses root manifest.json as single source of truth; see scripts/copy-to-dist.js.
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { run } from "./copy-to-dist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Vite outputs popup.html at dist root; ensure it's there so manifest can use "popup.html"
const vitePopupHtml = path.join(DIST, "popup.html");
if (!fs.existsSync(vitePopupHtml)) {
  console.warn("scripts/copy-extension.js: dist/popup.html not found. Run 'npm run build' first.");
}

run();
console.log("Extension files copied to dist/. Load the 'dist' folder in Chrome.");
