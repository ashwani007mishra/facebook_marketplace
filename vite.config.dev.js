import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Ensures built HTML uses relative asset paths (required for Chrome extension popup). */
function relativeBasePlugin() {
  return {
    name: "relative-base",
    transformIndexHtml(html) {
      return html.replace(/(src|href)="\/assets\//g, '$1="./assets/');
    },
  };
}

/** Development build: output to popup/, load extension from project root. */
export default defineConfig({
  root: resolve(__dirname, "src"),
  plugins: [react(), relativeBasePlugin()],
  build: {
    outDir: resolve(__dirname, "popup"),
    emptyOutDir: true,
    watch: {
      // Ensure file changes trigger rebuild (helps on Windows)
      usePolling: true,
      interval: 300,
    },
    rollupOptions: {
      input: resolve(__dirname, "src", "popup.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
    base: "./",
  },
});
