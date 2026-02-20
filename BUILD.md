# Building the extension (React popup)

The popup is a React app built with Vite. The content script and utils are unchanged (no build).

## Prerequisites

- Node.js 18+
- npm

## Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the popup**
   ```bash
   npm run build
   ```
   This writes `popup/popup.html` and `popup/assets/*.js` (overwrites the `popup/` folder).

3. **Load in Chrome**
   - Open `chrome://extensions` → Developer mode → **Load unpacked**
   - Select the **project root folder** (the one that contains `manifest.json`, `popup/`, `content/`, `utils/`).

## Development

- **Watch mode** (rebuild on change): `npm run dev`
- After changing popup code, run build (or use `npm run dev`) then click the extension icon again or reload the extension.

## Structure

- **Source:** `popup-src/` — React entry `popup.html` + `main.jsx`, `App.jsx`, `popup.css`
- **Output:** `popup/` — Built files consumed by the manifest (`default_popup: "popup/popup.html"`)
- **Unchanged:** `content/`, `utils/`, `manifest.json` — no build step
