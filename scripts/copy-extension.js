/**
 * Copies extension assets into dist/ and writes a dist-ready manifest.
 * Run after `vite build` (which outputs popup to dist/).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SRC_CONTENT = path.join(ROOT, "src", "content");
const UTILS = path.join(ROOT, "utils");

const DIST_MANIFEST = {
  manifest_version: 3,
  name: "FB Marketplace Boolean Filter",
  version: "1.0.0",
  description: "Filters Facebook Marketplace search results using advanced Boolean search syntax with auto-scroll.",
  permissions: ["storage", "tabs", "scripting"],
  host_permissions: [
    "https://www.facebook.com/marketplace/*",
    "https://*.facebook.com/marketplace/*",
    "https://facebook.com/marketplace/*",
  ],
  action: {
    default_title: "Marketplace Filter",
    default_popup: "popup.html",
  },
  content_scripts: [
    {
      matches: [
        "https://www.facebook.com/marketplace/*",
        "https://*.facebook.com/marketplace/*",
        "https://facebook.com/marketplace/*",
      ],
      js: ["content/content.js"],
      run_at: "document_idle",
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        "content/domHandler.js",
        "content/filterEngine.js",
        "content/observer.js",
        "content/scrollManager.js",
        "utils/tokenizer.js",
        "utils/parser.js",
        "utils/evaluator.js",
        "utils/wildcard.js",
      ],
      matches: [
        "https://www.facebook.com/*",
        "https://*.facebook.com/*",
        "https://facebook.com/*",
      ],
    },
  ],
};

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, transform) {
  let content = fs.readFileSync(src, "utf8");
  if (transform) content = transform(content);
  fs.writeFileSync(dest, content, "utf8");
}

function copyContentScripts() {
  mkdirp(path.join(DIST, "content"));
  const files = fs.readdirSync(SRC_CONTENT).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    const src = path.join(SRC_CONTENT, f);
    const dest = path.join(DIST, "content", f);
    if (f === "content.js") {
      copyFile(src, dest, (s) => s.replace(/src\/content\//g, "content/"));
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyUtils() {
  mkdirp(path.join(DIST, "utils"));
  const files = fs.readdirSync(UTILS).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    fs.copyFileSync(path.join(UTILS, f), path.join(DIST, "utils", f));
  }
}

function writeManifest() {
  fs.writeFileSync(
    path.join(DIST, "manifest.json"),
    JSON.stringify(DIST_MANIFEST, null, 2),
    "utf8"
  );
}

// Vite outputs popup.html at dist root; ensure it's named so manifest can use "popup.html"
const vitePopupHtml = path.join(DIST, "popup.html");
if (!fs.existsSync(vitePopupHtml)) {
  console.warn("scripts/copy-extension.js: dist/popup.html not found. Run 'npm run build' first.");
}

copyContentScripts();
copyUtils();
writeManifest();
console.log("Extension files copied to dist/. Load the 'dist' folder in Chrome.");
