/**
 * Watches src/ and utils/ and runs the dev build on any change.
 * Run with: npm run dev
 */

import { spawn } from "child_process";
import { watch } from "chokidar";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const WATCH_DIRS = [
  resolve(ROOT, "src"),
  resolve(ROOT, "utils"),
];

const BUILD_CMD = "npx";
const BUILD_ARGS = [
  "vite", "build",
  "--config", "vite.config.dev.js",
  "--mode", "development",
];

let buildTimeout = null;
const DEBOUNCE_MS = 400;

function runBuild() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(BUILD_CMD, BUILD_ARGS, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => (code === 0 ? resolvePromise() : rejectPromise(new Error(`exit ${code}`))));
  });
}

function scheduleBuild() {
  if (buildTimeout) clearTimeout(buildTimeout);
  buildTimeout = setTimeout(async () => {
    buildTimeout = null;
    console.log("\n[dev-watch] Change detected, building...");
    try {
      await runBuild();
      console.log("[dev-watch] Build done. Reload the extension if needed.\n");
    } catch (e) {
      console.error("[dev-watch] Build failed:", e?.message || e);
    }
  }, DEBOUNCE_MS);
}

async function main() {
  console.log("[dev-watch] Watching for changes (src/, utils/). Initial build...");
  await runBuild();
  console.log("[dev-watch] Build done. Saving any file will trigger a new build.\n");

  const watcher = watch(WATCH_DIRS, {
    ignored: /(^|[/\\])(node_modules|\.git)[/\\]/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on("add", (p) => { console.log("[dev-watch]", p.replace(ROOT, "")); scheduleBuild(); })
    .on("change", (p) => { console.log("[dev-watch]", p.replace(ROOT, "")); scheduleBuild(); })
    .on("unlink", (p) => { console.log("[dev-watch]", p.replace(ROOT, "")); scheduleBuild(); })
    .on("error", (e) => console.error("[dev-watch] Error:", e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
