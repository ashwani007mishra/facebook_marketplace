# Setup & Run Instructions (Zero Assumptions)

Complete setup instructions assuming no prior context.

---

## What You Need

- **OS:** Any supported by Chrome (Windows, macOS, Linux).
- **Browser:** Google Chrome or a Chromium-based browser (e.g. Edge) that supports Manifest V3 extensions.
- **Chrome version:** Modern (e.g. 100+). MV3 is required.
- **Facebook account:** You must be able to log into Facebook and open Marketplace in the same browser (extension does not handle login).
- **No Node/npm required:** The project is plain HTML/CSS/JS; no build step.

---

## Required Tools & Versions

| Tool | Version / notes |
|------|------------------|
| Chrome (or Chromium) | Recent stable; must support Manifest V3 and `chrome.scripting`. |
| Code editor | Optional; any editor or IDE to view/edit files. |
| Git | Optional; only if you clone the repo. |

No Node.js, npm, yarn, or pnpm are required. No `.env` or environment variables.

---

## Local Setup Steps

### 1. Get the code

- **Option A:** Clone the repo (if you use Git):
  ```bash
  git clone <repo-url>
  cd FB_MarketPlace
  ```
- **Option B:** Download or copy the project folder so you have an `extension` directory with `manifest.json` inside it.

### 2. Confirm folder structure

You must have:

```
<some-folder>/
  extension/
    manifest.json
    popup/
      popup.html
      popup.css
      popup.js
    content/
      content.js
      domHandler.js
      filterEngine.js
      observer.js
      scrollManager.js
    utils/
      tokenizer.js
      parser.js
      evaluator.js
      wildcard.js
```

The folder you will “load” in Chrome is **`extension`** (the one that contains `manifest.json`).

### 3. Load the extension in Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn **Developer mode** on (toggle in the top-right).
4. Click **Load unpacked**.
5. Select the **`extension`** folder (the directory that contains `manifest.json`).
6. The extension should appear in the list (e.g. “FB Marketplace Boolean Filter”). Ensure it is enabled (toggle on).

### 4. Pin the extension (optional)

Click the puzzle icon in the Chrome toolbar and pin “FB Marketplace Boolean Filter” so you can open the popup quickly.

### 5. Use the extension

1. Log into Facebook in the same browser.
2. Go to Marketplace (e.g. `https://www.facebook.com/marketplace/`).
3. Set your location if needed (e.g. Dallas) using Facebook’s own location control.
4. Click the extension icon to open the popup.
5. Enter a Boolean search (e.g. `restoration hardware sofa`), set “Auto-scroll pages” (e.g. `2` or `0` for current results only), click **Start**.
6. The tab will navigate to the search results URL (if needed), then filter and optionally auto-scroll; when done, the page scrolls to the top.

---

## Environment Variables

**None.** The extension does not use `.env` or any environment variables. Configuration is:

- **manifest.json** — Permissions, host patterns, paths.
- **chrome.storage.local** — Popup settings (`fbmp_query`, `fbmp_pages`), set when you click Start.
- **sessionStorage** — Pending run (`__fbmp_pendingRun`) only during the navigate-then-resume flow.

---

## Dev / Staging / Prod Differences

- **Single “environment”:** There is no separate dev/staging/prod build or config. You always load the same `extension` folder.
- **Unpacked vs Store:** Right now the project is used only as an **unpacked** extension. If you later publish to the Chrome Web Store, you would use the same folder (or a built artifact if you introduce a build step); there are no different env or config files for that in the repo today.

---

## Common Setup Issues

| Problem | What to do |
|--------|------------|
| **“Load unpacked” is disabled** | Turn on **Developer mode** at `chrome://extensions`. |
| **Extension doesn’t appear** | Ensure you selected the folder that **contains** `manifest.json` (i.e. `extension`), not the repo root. |
| **“Could not reach the Marketplace page”** | You must be on a tab whose URL is under `https://www.facebook.com/marketplace/` (or `https://facebook.com/marketplace/`). Open Marketplace first, then open the popup and click Start. If it still fails, refresh the Marketplace tab and try again. |
| **“Receiving end does not exist”** | The content script wasn’t in the tab. Refresh the Marketplace page and try again. The popup will also try to inject the script once and retry the message. |
| **No results / everything hidden** | Check your Boolean query. If it’s too strict or has a typo, the matcher may hide all. Use a simpler query (e.g. one word) or clear and run with empty query to see all. |
| **Big white gaps** | If you still see gaps, Facebook’s DOM may have changed; the “visual container” we hide might be different. Check ARCHITECTURE and CODEBASE_MAP for `findVisualCardContainer`. |
| **Script errors after code change** | After editing any file in `extension/`, go to `chrome://extensions` and click the **Reload** button for this extension. Then refresh the Marketplace tab. |
| **Popup shows wrong status** | Right-click the popup → **Inspect** to open DevTools for the popup and check the console. For the page, use the normal page DevTools and filter by `[FBMP]`. |

---

## Verifying Setup

1. **Extension loaded:** At `chrome://extensions`, “FB Marketplace Boolean Filter” is listed and enabled.
2. **Popup opens:** Click the extension icon; you see “Marketplace Filter”, Boolean Search textarea, Auto-scroll pages, Start.
3. **Message reaches page:** On a Marketplace tab, click Start with a query; status shows “Running. Check the page.” and the tab navigates to search (if needed) and filters.
4. **Filtering works:** Listings that don’t match the query disappear and the grid has no large white gaps (column wrapper hidden).

If any step fails, use the “Common setup issues” table and the console messages (`[FBMP]` in page, popup Inspect for messaging errors).
