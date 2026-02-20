# Cursor / AI Context — FB Marketplace Boolean Filter

Paste or use this in a new Cursor session to give full project context. Keeps the AI productive and aligned with the codebase.

---

## Project purpose

- **What it is:** A Chrome extension (Manifest V3) for **Facebook Marketplace** that lets users run a **Boolean search** from a popup and **filter** the Marketplace search results by title.
- **User flow:** User enters a query in the popup (e.g. `restoration hardware sofa`), clicks Start → extension navigates to the Marketplace search URL (or stays on it) → content script filters listings (AND/OR/NOT, phrases, wildcards), hides non-matching cards by hiding their **parent column wrapper** (to avoid white gaps), optionally auto-scrolls to load more, then scrolls to top.
- **No backend:** Everything runs in the browser (popup + content script). No server, no DB, no auth. Persistence: `chrome.storage.local` (popup settings), `sessionStorage` (pending run across one navigation).

---

## Tech stack

- **Runtime:** Chrome (or Chromium) with MV3.
- **Popup:** Vanilla HTML + CSS + JS (ES module). No React/Vue.
- **Content script:** One entry file `content/content.js` (classic script) that dynamic-imports ES modules from `content/*.js` and `utils/*.js`. All content logic lives in those modules.
- **Build:** None. Plain JS; no bundler, no Node required. Load “Load unpacked” with the `extension` folder.
- **Tests:** None in repo.

---

## Key files and roles

- **extension/manifest.json** — Permissions, host patterns, popup, content script, web_accessible_resources.
- **extension/popup/** — popup.html, popup.css, popup.js: form, storage, sendMessage(FBMP_START), retry with scripting.executeScript.
- **extension/content/content.js** — Orchestrator: message listener, triggerMarketplaceSearch (URL nav + sessionStorage), startRun (compileQuery, refilterAll, autoScroll, scrollTo(0)), findVisualCardContainer, applyVisibility, observer.
- **extension/content/domHandler.js** — extractListings, findCardRoot, extractTitleFromCard (no class-based selectors; use href, role, heuristics).
- **extension/content/filterEngine.js** — compileQuery: tokenize → parse → createEvaluator; fail-open on errors.
- **extension/content/observer.js** — ListingsObserver (MutationObserver, debounce, onChange(roots)).
- **extension/content/scrollManager.js** — autoScroll(pages, getListingCount, signal, onAfterEach).
- **extension/utils/** — tokenizer, parser, evaluator, wildcard: Boolean query → matcher.

---

## Coding conventions

- **Naming:** camelCase for functions/variables; UPPER_SNAKE for constants (e.g. PENDING_KEY, STORAGE_KEYS). Prefix internal logs with `[FBMP]`.
- **Errors:** Prefer console.warn for recoverable issues; fail-open for query parse (match everything). Popup shows user-facing status; include error details in status when useful.
- **DOM:** Don’t rely on Facebook class names for identity (they’re dynamic). Use stable selectors: `a[href*="/marketplace/item/"]`, `input[aria-label="Search Marketplace"]`, `div[style*="max-width"][style*="min-width"]` for visual container when appropriate.
- **Async:** content.js uses async/await and return true for onMessage when sendResponse is async. Popup uses async/await and try/catch for sendStartMessage.

---

## Architectural rules

1. **No backend or external APIs:** Do not add a server, database, or HTTP calls to Facebook. Extension only uses Chrome APIs and the page DOM.
2. **Visibility = hide the container:** When hiding a non-matching listing, hide the **visual container** (ancestor with max-width/min-width or single-child chain), not only the inner card node, so the grid reflows.
3. **Search = URL navigation:** To “run” a Marketplace search we set `location.href` to `/marketplace/<location>/search?query=...` and pass pending config via sessionStorage. Do not rely on simulating autosuggest click.
4. **Single run at a time:** startRun aborts any in-flight run (AbortController) and uses one epoch. No queuing of multiple runs.
5. **Content script entry:** Only `content/content.js` is in the manifest; other content code is loaded via dynamic import. All those modules must stay in web_accessible_resources.

---

## What the AI should NOT do

- **Do not** add a backend, database, or server.
- **Do not** add authentication or token handling (user logs in via Facebook in the browser).
- **Do not** use Facebook class names (e.g. `x9f619`) for selectors; they change. Use attributes, href, role, aria-*, or style heuristics.
- **Do not** try to “click” the autosuggest to run search; use URL navigation + sessionStorage.
- **Do not** hide only the inner card element when filtering; hide the column/container so layout doesn’t leave gaps.
- **Do not** remove or change the [FBMP] log prefix when adding logs; it helps filter in DevTools.
- **Do not** add dependencies (npm packages) without explicit need and user agreement; the project is zero-dependency today.

---

## Preferred libraries & patterns

- **No framework** in the popup; keep it vanilla. If we ever add a build step, prefer minimal tooling (e.g. esbuild) and no React/Vue unless the product scope grows.
- **Chrome APIs:** Use chrome.storage.local, chrome.tabs, chrome.scripting, chrome.runtime.getURL / onMessage as already used; avoid deprecated APIs.
- **Query language:** Keep the custom tokenizer/parser/evaluator pipeline unless we explicitly decide to replace it; document any grammar or behavior change.

---

## Docs to reference

- **PROJECT_OVERVIEW.md** — Problem, users, features, stack, status, risks.
- **ARCHITECTURE.md** — Data flow, diagram, no backend/DB/auth/cron.
- **CODEBASE_MAP.md** — Folder structure, entry points, responsibility per file.
- **DECISIONS.md** — Why URL nav, why hide container, why sessionStorage, etc.
- **STATUS.md** — Completed, partial, pending, known bugs.
- **SETUP.md** — How to load and run the extension.
- **API_DOCS.md** — Messaging (FBMP_*), storage keys, internal data shapes.
- **CODING_GUIDELINES.md** — Conventions and patterns in more detail.

Use these when answering questions or suggesting changes so the AI stays aligned with the project’s design and constraints.
