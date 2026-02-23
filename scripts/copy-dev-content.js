/**
 * Copies content scripts and utils into popup/ for dev.
 * Run after Vite dev build so the extension (loaded from root) uses built content from popup/.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POPUP = path.join(ROOT, "popup");
const SRC_CONTENT = path.join(ROOT, "src", "content");
const UTILS = path.join(ROOT, "utils");

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyContentScripts() {
  mkdirp(path.join(POPUP, "content"));
  const files = fs.readdirSync(SRC_CONTENT).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    const src = path.join(SRC_CONTENT, f);
    const dest = path.join(POPUP, "content", f);
    if (f === "content.js") {
      const content = fs.readFileSync(src, "utf8").replace(/src\/content\//g, "popup/content/");
      fs.writeFileSync(dest, content, "utf8");
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyUtils() {
  mkdirp(path.join(POPUP, "utils"));
  const files = fs.readdirSync(UTILS).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    fs.copyFileSync(path.join(UTILS, f), path.join(POPUP, "utils", f));
  }
}

copyContentScripts();
copyUtils();
console.log("[copy-dev-content] Content and utils copied to popup/.");
