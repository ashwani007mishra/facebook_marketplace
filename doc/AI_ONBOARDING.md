# AI Assistant Onboarding — FB Marketplace Boolean Filter

**Single-doc summary for an AI joining mid-project.** Read this first; use the other docs for depth.

---

## 1. What This Is (One Sentence)

A **Chrome extension (MV3)** that lets users type a **Boolean search query** in a popup, **navigate** to Facebook Marketplace search results, **filter** those results by title (AND/OR/NOT, phrases, wildcards), and **hide non-matching listings** by hiding their **parent column wrapper** so the grid reflows without white gaps—with optional **auto-scroll** to load more, then scroll to top.

---

## 2. Problem & Solution

- **Problem:** Facebook Marketplace has no Boolean search; users see irrelevant results and (if they could filter client-side) would see big layout gaps when items are hidden.
- **Solution:** Popup → user query + “Start” → content script either navigates to `/marketplace/<location>/search?query=...` (storing pending config in sessionStorage) or stays on the page → on load (or immediately), content script compiles the query, finds all listing cards, evaluates each title, and sets `display: none` on the **visual container** (column wrapper), not just the inner card. MutationObserver keeps filtering new DOM; optional auto-scroll loads more then scrolls to top.

**No backend, no database, no auth.** Persistence: `chrome.storage.local` (popup settings), `sessionStorage` (pending run across one navigation).

---

## 3. Tech Stack

| Layer | What |
|-------|------|
| Runtime | Chrome (or Chromium) with Manifest V3 |
| Popup | Vanilla HTML + CSS + JS (ES module); no framework |
| Content script | One entry: `content/content.js` (classic script) that **dynamic-imports** ES modules from `content/*.js` and `utils/*.js` |
| Build | None. Plain JS. Load the `extension` folder via “Load unpacked” |
| Tests | None in repo |

All content modules must be listed in **web_accessible_resources** in the manifest so the content script can fetch them.

---

## 4. User Flow (High Level)

1. User opens Marketplace in Chrome (logged into Facebook), sets location in FB’s UI if needed.
2. User opens extension popup, enters Boolean query (e.g. `restoration hardware sofa`), sets “Auto-scroll pages” (0–50), clicks **Start**.
3. Popup saves query/pages to `chrome.storage.local`, gets active tab, checks URL is Marketplace, sends **FBMP_START** with `{ query, pages }`. If “Receiving end does not exist”, popup injects `content/content.js` via `chrome.scripting.executeScript` and retries.
4. Content script: **startRun(payload)**. If we’re not on a search URL, **triggerMarketplaceSearch**: write config to sessionStorage, set `location.href` to search URL → page navigates (script context dies).
5. New page load: content script runs again, sees sessionStorage `__fbmp_pendingRun`, parses it, removes it, calls **startRun(pending, { allowNavigate: false })**.
6. **startRun** (no nav): **compileQuery** → **refilterAll** → optionally **autoScroll** (scroll, wait for new listings, onAfterEach flush + scanAndFilter) → **scrollTo(0)**.
7. **extractListings** finds `a[href*="/marketplace/item/"]`, gets card root and title; **applyVisibility(cardEl, match)** hides the **visual container** (ancestor with max-width/min-width or single-child chain).

---

## 5. Repo Layout & File Roles

```
extension/
  manifest.json     # Permissions, popup, content_scripts, web_accessible_resources
  popup/
    popup.html      # Form: Boolean Search, Auto-scroll pages, Start, status
    popup.css       # Styles
    popup.js        # Load/save storage, sendMessage(FBMP_START), retry with scripting
  content/
    content.js      # ENTRY. Message listener, triggerMarketplaceSearch, startRun,
                    # findVisualCardContainer, applyVisibility, observer, epoch
    domHandler.js   # extractListings, findCardRoot, extractTitleFromCard (no FB classes)
    filterEngine.js # compileQuery: tokenize → parse → createEvaluator; fail-open
    observer.js    # ListingsObserver (MutationObserver, debounce, onChange(roots))
    scrollManager.js# autoScroll(pages, getListingCount, signal, onAfterEach)
  utils/
    tokenizer.js   # tokenize(), TokenType
    parser.js      # parse(tokens) → AST
    evaluator.js   # createEvaluator(ast), buildTitleIndex
    wildcard.js    # compileWildcard(pattern) for *
```

**Entry points:** manifest (extension), popup.html → popup.js (popup), content/content.js (injected into Marketplace tabs).

---

## 6. Data & “APIs”

- **Messaging (Popup → Content):**  
  - **FBMP_START:** `{ type: "FBMP_START", payload: { query: string, pages: number } }` → response `{ ok: true }` or `{ ok: false, error: string }`.  
  - **FBMP_PING:** `{ type: "FBMP_PING" }` → `{ ok: true }`.
- **Chrome storage (popup):** `chrome.storage.local` keys `fbmp_query`, `fbmp_pages`. Read on load, write on Start.
- **Session storage (content, same tab):** Key `__fbmp_pendingRun`, value JSON `{ query, pages }`. Written before navigation, read on new page and deleted.
- **DOM attributes:** `data-fbmp-epoch`, `data-fbmp-match` ("0" | "1") on the **visual container** (and optionally card root). Used for skip-re-eval and visibility.

No HTTP APIs. No auth. User must be logged into Facebook in the browser.

---

## 7. Key Design Decisions (Why)

- **URL navigation instead of clicking autosuggest:** FB’s autosuggest is unreliable to trigger programmatically; building the search URL and navigating is deterministic.
- **sessionStorage for pending run:** Survives same-tab navigation; simpler than matching “which tab” with chrome.storage.
- **Hide visual container, not just card:** Hiding only the inner node leaves the column div in layout → white gaps. We hide the ancestor with `max-width`/`min-width` (or single-child chain) so the grid reflows.
- **Fail-open on query parse errors:** Return “match everything” + console.warn so a typo doesn’t hide all results.
- **No service worker:** We don’t need background logic; popup + content script only.
- **Retry sendMessage with scripting.executeScript:** If the content script wasn’t injected (e.g. tab opened before reload), inject and retry once instead of requiring a manual refresh.
- **Single run at a time:** startRun aborts previous run (AbortController), increments epoch; no queue.

---

## 8. Conventions & Rules

- **Naming:** camelCase (vars/funcs), UPPER_SNAKE (constants). Data attributes `data-fbmp-*`; storage keys `fbmp_*`; message types `FBMP_*`. Logs: prefix **`[FBMP]`**.
- **DOM:** Do **not** use Facebook’s class names for selectors (they’re volatile). Use `a[href*="/marketplace/item/"]`, `input[aria-label="Search Marketplace"]`, `div[style*="max-width"][style*="min-width"]`, etc.
- **Errors:** Fail-open for query; catch and `console.warn("[FBMP] ...", e)`; popup shows status with error text when useful. For startRun failure, sendResponse({ ok: false, error }).
- **Async:** In onMessage, when response is async, **return true** and call sendResponse in .then/.catch.

**Architectural rules:** (1) No backend/DB/HTTP to FB. (2) Always hide the visual container for non-matches. (3) Search = URL navigation + sessionStorage. (4) One run at a time; content entry is content.js only; modules in web_accessible_resources.

---

## 9. What NOT to Do

- Do **not** add a backend, database, or auth.
- Do **not** use FB class names (e.g. `x9f619`) for selectors.
- Do **not** try to “click” autosuggest to run search.
- Do **not** hide only the inner card when filtering; hide the column/container.
- Do **not** remove or change the `[FBMP]` log prefix.
- Do **not** add npm dependencies without explicit need and agreement (project is zero-dependency).

---

## 10. Current State & Risks

- **Done:** Full flow (popup → search URL → filter → optional auto-scroll → scroll to top), Boolean query, DOM extraction, visual-container hiding, observer, docs.
- **Partial:** Search input sync (best-effort when not navigating), “strict mode” flag (internal only), location from URL only (no popup location picker).
- **Not done:** Tests, strict-mode UI, location picker, cancel button, history/presets, build, Chrome Web Store publish.
- **Risks:** FB DOM changes can break card/container detection; sessionStorage is tab-scoped (new tab = no pending run); tabs opened before extension reload may need refresh (we mitigate with scripting retry); sponsored/non-item listings aren’t filtered; multi-tab runs are independent.

---

## 11. How to Run & Debug

- **Load:** Chrome → `chrome://extensions` → Developer mode → Load unpacked → select **extension** folder.
- **Use:** Be on a Marketplace tab (e.g. `https://www.facebook.com/marketplace/`), open popup, enter query, set pages, click Start.
- **Debug:** Page console → filter by `[FBMP]`. Popup → right-click → Inspect for messaging errors. After code changes, reload the extension and refresh the Marketplace tab.

---

## 12. Where to Go for More

| Topic | Doc |
|-------|-----|
| Problem, users, features, risks | PROJECT_OVERVIEW.md |
| Data flow, diagram, no backend/auth | ARCHITECTURE.md |
| Folder structure, entry points, per-file responsibility | CODEBASE_MAP.md |
| Design decisions and tradeoffs | DECISIONS.md |
| Completed / partial / pending / bugs | STATUS.md |
| Setup steps, env, troubleshooting | SETUP.md |
| Messaging, storage, internal shapes | API_DOCS.md |
| Conventions and patterns in detail | CODING_GUIDELINES.md |
| Cursor-specific context and “do not” list | CURSOR_CONTEXT.md |

Use this document to get context quickly; refer to the others when you need depth or exact contracts.
