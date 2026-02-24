/**
 * Shared logic for building dist: read root manifest.json (single source of truth),
 * apply dist path overrides, copy content/utils/icons, write dist/manifest.json.
 * Used by copy-extension.js (production) and copy-dev-content.js (dev watch).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SRC_CONTENT = path.join(ROOT, "src", "content");
const UTILS = path.join(ROOT, "utils");
const ICONS = path.join(ROOT, "icons");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");

/** Path mapping for dist: Vite outputs popup at dist root, content/utils have no "popup/" prefix. */
function toDistPath(p) {
  if (typeof p !== "string") return p;
  if (p.startsWith("popup/content/")) return p.replace("popup/content/", "content/");
  if (p.startsWith("popup/utils/")) return p.replace("popup/utils/", "utils/");
  if (p === "popup/popup.html") return "popup.html";
  return p;
}

/** Load and parse root manifest.json. */
function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

/** Build manifest for dist with path overrides applied. */
export function buildDistManifest() {
  const manifest = loadManifest();
  const out = { ...manifest };

  if (out.action && out.action.default_popup) {
    out.action = { ...out.action, default_popup: toDistPath(out.action.default_popup) };
  }

  if (Array.isArray(out.content_scripts)) {
    out.content_scripts = out.content_scripts.map((cs) => ({
      ...cs,
      js: Array.isArray(cs.js) ? cs.js.map(toDistPath) : cs.js,
    }));
  }

  if (Array.isArray(out.web_accessible_resources)) {
    out.web_accessible_resources = out.web_accessible_resources.map((wa) => ({
      ...wa,
      resources: Array.isArray(wa.resources) ? wa.resources.map(toDistPath) : wa.resources,
    }));
  }

  return out;
}

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, transform) {
  let content = fs.readFileSync(src, "utf8");
  if (transform) content = transform(content);
  fs.writeFileSync(dest, content, "utf8");
}

export function copyContentScripts() {
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

export function copyUtils() {
  mkdirp(path.join(DIST, "utils"));
  const files = fs.readdirSync(UTILS).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    fs.copyFileSync(path.join(UTILS, f), path.join(DIST, "utils", f));
  }
}

export function copyIcons() {
  if (!fs.existsSync(ICONS)) return;
  mkdirp(path.join(DIST, "icons"));
  mkdirp(path.join(DIST, "icons", "@icons"));
  const logo = path.join(ICONS, "@icons", "logo.png");
  const icon128 = path.join(ICONS, "icon128.png");
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(DIST, "icons", "@icons", "logo.png"));
  if (fs.existsSync(icon128)) fs.copyFileSync(icon128, path.join(DIST, "icons", "icon128.png"));
}

export function writeManifest() {
  mkdirp(DIST);
  const manifest = buildDistManifest();
  fs.writeFileSync(path.join(DIST, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

/** Run all copy steps and write dist manifest. Call this from copy-extension.js or copy-dev-content.js. */
export function run() {
  writeManifest();
  copyContentScripts();
  copyUtils();
  copyIcons();
}
