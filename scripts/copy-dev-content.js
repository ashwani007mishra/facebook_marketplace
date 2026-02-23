/**
 * Copies content scripts and utils into dist/ and writes dist manifest for dev.
 * Run after Vite dev build. Load the extension from the dist/ folder in Chrome.
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

function copyContentScripts() {
  mkdirp(path.join(DIST, "content"));
  const files = fs.readdirSync(SRC_CONTENT).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    const src = path.join(SRC_CONTENT, f);
    const dest = path.join(DIST, "content", f);
    if (f === "content.js") {
      const content = fs.readFileSync(src, "utf8").replace(/src\/content\//g, "content/");
      fs.writeFileSync(dest, content, "utf8");
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
  mkdirp(DIST);
  fs.writeFileSync(
    path.join(DIST, "manifest.json"),
    JSON.stringify(DIST_MANIFEST, null, 2),
    "utf8"
  );
}

/** Run after every dev build (dev-watch calls this so it runs on each rebuild, not only on first import). */
export function run() {
  writeManifest();
  try {
    copyContentScripts();
    copyUtils();
    console.log("[copy-dev-content] Content and utils copied to dist/. Load the 'dist' folder in Chrome.");
  } catch (e) {
    console.error("[copy-dev-content] Copy error:", e?.message || e);
    console.log("[copy-dev-content] Manifest written to dist/. Load the 'dist' folder in Chrome.");
  }
}
