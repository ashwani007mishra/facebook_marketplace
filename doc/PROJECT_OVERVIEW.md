# FB Marketplace Boolean Filter — Project Overview

**Onboarding doc for senior developers (Day 1).**

---

## What problem this project solves

Facebook Marketplace’s native search is keyword-based and does not support Boolean logic or precise title matching. Users who want to narrow results (e.g. “restoration hardware sofa” with all three words, or complex queries like `"sectional" | "sofa" -velvet`) have to:

- Manually type in the Marketplace search box and rely on autosuggest.
- Scroll through many irrelevant listings.
- See layout gaps where non-matching items would sit if they were simply hidden in-place.

This Chrome extension:

1. **Runs a real Marketplace search** — Takes the user’s query from a popup, navigates to the correct Marketplace search URL (e.g. `/marketplace/<location>/search?query=...`), so results are the same as if the user had searched on Facebook.
2. **Filters results by a Boolean query** — Applies AND / OR / NOT, phrases, and wildcards against listing titles so only matching items stay visible.
3. **Removes layout gaps** — Hides the **parent column wrapper** of non-matching cards (not just the inner card), so the grid reflows and there is no long white space where hidden items used to be.
4. **Auto-scrolls and re-filters** — Can scroll N “pages” to load more results, then filter the full set and scroll back to the top so the user sees a dense, in-sequence list of matches.

So the problem solved is: **precise, Boolean-filtered Marketplace search with correct layout and minimal manual steps.**

---

## Target users & roles

- **Primary:** People who regularly search Facebook Marketplace (e.g. furniture, vehicles, collectibles) and want to:
  - Use one query in the extension and have it drive the real Marketplace search.
  - See only listings whose titles match a Boolean expression.
  - Avoid scrolling through irrelevant results and empty gaps.
- **Implicit “role”:** The user is expected to use Facebook in a browser (Chrome or Chromium-based) and to have already set their Marketplace location (e.g. Dallas) in Facebook’s UI; the extension reuses that location when building the search URL.

There are no separate “admin” or “backend” roles; this is a client-only extension.

---

## Core features

| Feature | Description |
|--------|-------------|
| **Popup UI** | Single extension popup: “Boolean Search” textarea, “Auto-scroll pages” (0–50), “Start”. Settings (query, pages) persisted in `chrome.storage.local`. |
| **Boolean query language** | Spaces = AND, `\|` = OR, `-` = NOT, double quotes = phrase, `*` = wildcard. Tokenizer + parser + evaluator compile a query into a title matcher. |
| **Search flow** | On Start: if not already on a Marketplace search page, extension builds `/marketplace/<location>/search?query=...`, stores pending config in `sessionStorage`, and navigates. On the new page load, content script reads pending config and runs filter + auto-scroll without navigating again. |
| **Listing detection** | Content script finds listing cards via `a[href*="/marketplace/item/"]`, derives a card root via `domHandler.findCardRoot`, and extracts a title from the card for matching. |
| **Filtering** | Each listing title is run through the compiled matcher. Non-matches are hidden by setting `display: none` on the **visual container** (the ancestor with `max-width`/`min-width` in style, or a single-child wrapper chain). |
| **Auto-scroll** | After filtering current DOM, can scroll to bottom in steps, wait for new listings, then re-scan and filter. At the end, scrolls back to top. |
| **React-friendly DOM** | MutationObserver watches for new nodes, debounced; new roots are scanned so dynamically loaded listings get filtered. |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Browser only; Chrome (or Chromium) with Manifest V3. |
| **Extension surface** | Single `action` with popup; no background/service worker. |
| **Frontend (popup)** | HTML + CSS + vanilla JS (ES module). No framework. |
| **Content script** | One entry: `content/content.js` (classic script that dynamic-imports ES modules). All content logic is in ES modules (see below). |
| **“Backend”** | None. No server, no API. Persistence: `chrome.storage.local` (popup settings), `sessionStorage` (pending run across navigation). |
| **Infra** | Unpacked extension loaded from repo; no CI/build step in repo (plain JS). |

**Key modules:**

- **Popup:** `popup/popup.html`, `popup.css`, `popup.js` — loads settings, sends `FBMP_START` to active tab, shows status/errors.
- **Content:** `content/content.js` — orchestrator: message listener, `triggerMarketplaceSearch`, `startRun`, visibility + epoch logic, observer, auto-scroll.
- **Content modules:** `domHandler.js` (card extraction, title extraction), `filterEngine.js` (compile query → matcher), `observer.js` (MutationObserver), `scrollManager.js` (auto-scroll loop).
- **Utils:** `tokenizer.js`, `parser.js`, `evaluator.js`, `wildcard.js` — Boolean query parsing and evaluation.

**Permissions:** `storage`, `tabs`, `scripting`; `host_permissions` and `content_scripts.matches` for `https://www.facebook.com/marketplace/*`, `https://*.facebook.com/marketplace/*`, `https://facebook.com/marketplace/*`. `web_accessible_resources` lists all content/utils JS so the content script can load them as modules.

---

## Current development status

- **Functional:** User flow works: popup → Start → navigate to Marketplace search URL (with current location) → on load, pending run resumes → filter + optional auto-scroll → scroll to top. Matching and layout (hiding parent column) behave as intended.
- **No automated tests** in the repo; no test runner or E2E setup.
- **No formal release pipeline** — manual reload of unpacked extension; version is `1.0.0` in manifest.
- **Console logging:** Content script logs `[FBMP] Marketplace Filter content script loaded on <url>` and various `[FBMP]` warnings on failure paths; popup logs on message failure. No analytics or error reporting service.

---

## Known risks & tech debt

1. **Facebook DOM volatility**  
   - Card detection and title extraction rely on DOM structure (e.g. `a[href*="/marketplace/item/"]`, `findCardRoot` heuristics, `extractTitleFromCard` scanning spans/divs).  
   - **Risk:** FB/Meta markup or class changes can break card detection or title extraction.  
   - **Mitigation today:** Avoid class-based selectors where possible; use stable attributes (e.g. `href`, `role`, `aria-label`). `findVisualCardContainer` uses inline `style` (max-width/min-width) and single-child walk; that can change if FB restyles.

2. **URL/location coupling**  
   - Search URL is built from current path (`/marketplace/<location>/search`). Location is never read from the “Dallas, Texas · Within 40 mi”-style control; it’s whatever the current page URL implies.  
   - **Risk:** If FB changes URL scheme or adds new routes, navigation or “pending run” resume could break or point to wrong page.

3. **sessionStorage for pending run**  
   - Pending config is stored in `sessionStorage` before `location.href` change.  
   - **Risk:** If the user opens the search in a new tab or sessionStorage is cleared, the pending run is lost (user would see search results but no automatic filter run).

4. **Content script injection**  
   - Extension uses both manifest-declared content script and, on failure, `chrome.scripting.executeScript` to inject the same script.  
   - **Risk:** Tabs opened before extension install/reload may not have the script; user must refresh. Popup shows a generic “Could not reach the Marketplace page” on messaging failure.

5. **No tests**  
   - No unit tests for tokenizer/parser/evaluator/filterEngine, no integration tests for content script or popup.  
   - **Risk:** Regressions (e.g. in query semantics or DOM heuristics) are only caught manually.

6. **Sponsored / non-standard listings**  
   - Only items with `/marketplace/item/` links are treated as listings. Sponsored or other ad-style cards are not hidden by the filter.  
   - **Risk:** Layout can still show gaps or mixed content if FB adds new listing DOM patterns.

7. **Single run at a time**  
   - `startRun` aborts any in-flight run and uses a single `epoch` and `runAbort`.  
   - **Risk:** Rapid Start clicks or multiple tabs could behave in non-obvious ways; not currently designed for concurrent runs.

---

## Repo layout (high level)

```
FB_MarketPlace/
├── PROJECT_OVERVIEW.md          # This file
└── extension/
    ├── manifest.json
    ├── popup/
    │   ├── popup.html
    │   ├── popup.css
    │   └── popup.js
    ├── content/
    │   ├── content.js           # Entry; imports below
    │   ├── domHandler.js
    │   ├── filterEngine.js
    │   ├── observer.js
    │   └── scrollManager.js
    └── utils/
        ├── tokenizer.js
        ├── parser.js
        ├── evaluator.js
        └── wildcard.js
```

---

## Quick start (for devs)

1. Open Chrome → `chrome://extensions` → enable “Developer mode” → “Load unpacked” → select the `extension` folder.
2. Go to Facebook Marketplace (e.g. `https://www.facebook.com/marketplace/`) and set location if needed.
3. Open the extension popup, enter a Boolean query (e.g. `restoration hardware sofa`), set “Auto-scroll pages” (e.g. 2), click **Start**.
4. Page should navigate to `/marketplace/<location>/search?query=...`, then filter and optionally scroll; scroll back to top when done.
5. To debug: Page console for `[FBMP]` logs and content script errors; popup right-click → Inspect for popup script and messaging errors.

---

*Last updated to reflect codebase and behavior as of project overview creation.*
