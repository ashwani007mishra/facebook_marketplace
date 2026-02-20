# Folder Structure & Code Responsibility Map

Explanation of the repo layout and what each major directory and file is responsible for.

---

## Repository Root

```
FB_MarketPlace/
├── ARCHITECTURE.md      # System architecture and data flow
├── API_DOCS.md          # Messaging, storage, and data shapes
├── CODEBASE_MAP.md      # This file
├── CODING_GUIDELINES.md # Conventions and patterns
├── DECISIONS.md         # Design decisions and rationale
├── PROJECT_OVERVIEW.md  # Day-1 onboarding overview
├── SETUP.md             # Setup and run instructions
├── STATUS.md            # Completed / in progress / pending
├── CURSOR_CONTEXT.md    # AI/Cursor context and rules
└── extension/           # The Chrome extension (load this folder in chrome://extensions)
```

---

## Extension Root: `extension/`

| File / Dir       | Responsibility |
|------------------|----------------|
| **manifest.json** | Chrome MV3 manifest: name, version, permissions (`storage`, `tabs`, `scripting`), `host_permissions`, `action` (popup), `content_scripts` (single entry: `content/content.js` on marketplace URLs), `web_accessible_resources` (all content/utils JS so they can be loaded as modules). **Entry point for the extension.** |
| **popup/**        | Popup UI and logic. |
| **content/**      | Scripts injected into Facebook Marketplace pages. |
| **utils/**        | Shared logic for Boolean query parsing and evaluation (used only by content script). |

There are **no environment variable files** (`.env` etc.). The extension does not use build-time or runtime env vars; configuration is `manifest.json` + `chrome.storage.local` + in-memory state.

---

## Popup: `extension/popup/`

| File          | Responsibility |
|---------------|----------------|
| **popup.html** | Markup for the popup: title “Marketplace Filter”, Boolean Search textarea, Auto-scroll pages number input, Start button, status div. Loads `popup.css` and `popup.js` (module). **Entry point for the popup.** |
| **popup.css**  | Styles for the popup layout and components. |
| **popup.js**   | **Entry point (script).** DOMContentLoaded: load settings from `chrome.storage.local` into form; on Start click: validate, save settings, get active tab, check Marketplace URL, send `FBMP_START` (with retry via `scripting.executeScript` if needed), show status or error. Defines STORAGE_KEYS, `$()`, `setStatus`, `loadSettings`, `saveSettings`, `getActiveTab`, `isMarketplaceUrl`, `ensureContentScript`, `sendStartMessage`, `parsePages`. |

**Entry point:** `popup.html` → `popup.js` (module).

---

## Content Scripts: `extension/content/`

| File               | Responsibility |
|--------------------|----------------|
| **content.js**     | **Single content script entry** (declared in manifest). Runs in the page context. IIFE: guard `__fbmpFilterInitialized`, dynamic import of domHandler, filterEngine, observer, scrollManager. Holds config, epoch, runAbort; defines `findVisualCardContainer`, `applyVisibility`, `evaluateListing`, `scanAndFilter`, `refilterAll`, `getListingCount`, `triggerMarketplaceSearch`, `startRun`; registers MutationObserver; on load, checks sessionStorage for pending run and resumes if applicable; registers `chrome.runtime.onMessage` for `FBMP_PING` and `FBMP_START`. **Entry point for content logic.** |
| **domHandler.js**  | **Core business logic (DOM).** Export: `extractListings(root)`. Finds `a[href*="/marketplace/item/"]`, gets card root via `findCardRoot(anchor)`, extracts title via `extractTitleFromCard(cardEl, anchor)`. Uses heuristics (hasImg, text length, single item link, title candidates, scoreTitleCandidate). Avoids class-based selectors; uses ITEM_HREF_RE, role, etc. |
| **filterEngine.js** | **Core business logic (filtering).** Export: `compileQuery(query)`. Tokenizes and parses query (via tokenizer + parser), builds matcher via `createEvaluator(ast)`. Returns `{ matchesTitle(title), meta }`. Fail-open on parse errors (match everything). Uses `normalizeLikeTitle`, `toWords`, `isSimpleStrictQuery`. |
| **observer.js**    | **Infrastructure.** Export: `ListingsObserver` class. MutationObserver on body (childList, subtree), debounced flush; collects added node roots and calls `onChange(roots)`. Methods: `start`, `stop`, `flushNow`. |
| **scrollManager.js** | **Infrastructure.** Export: `autoScroll(opts)`. Loop: scroll to bottom, sleep, wait for listing count increase (or timeout), call `onAfterEach`. Uses AbortSignal for cancellation. |

**Entry point:** Manifest injects `content/content.js`; it then imports the other four modules via `chrome.runtime.getURL(...)`.

---

## Shared Utilities: `extension/utils/`

| File            | Responsibility |
|-----------------|----------------|
| **tokenizer.js** | Export: `tokenize(input)`, `TokenType`. Tokenizes Boolean query string into TERM, PHRASE, OR, NOT, LPAREN, RPAREN. Handles quotes, escapes, whitespace. |
| **parser.js**    | Export: `parse(tokens)`. Builds AST: AND/OR/NOT/TERM/PHRASE. Used by filterEngine. |
| **evaluator.js** | Export: `createEvaluator(ast)`, `normalizedTitleWords`, `buildTitleIndex`. Compiles AST into a function `(title) => boolean`. Uses normalized text and word lists; supports wildcards via wildcard.js. |
| **wildcard.js**  | Export: `compileWildcard(pattern)`. Returns `(word) => boolean` for prefix/glob matching (`*`). Used by evaluator for TERM nodes containing `*`. |

These are **only used by the content script** (filterEngine imports them). The popup does not use utils.

---

## Configuration Files

| File             | Purpose |
|------------------|--------|
| **manifest.json** | Only config file. Defines permissions, host patterns, popup path, content script, and web_accessible_resources. No separate dev/staging/prod manifests. |

**Environment variables:** None. No `.env` or equivalent.

---

## Entry Points Summary

| Entry point           | Trigger | File(s) |
|-----------------------|--------|--------|
| Extension load        | User installs / reloads extension | manifest.json |
| Popup open            | User clicks extension icon | popup/popup.html → popup.js |
| Content script run    | Page load on matching marketplace URL, or popup’s scripting.executeScript | content/content.js |
| User action           | Click “Start” in popup | popup.js → sendMessage → content.js startRun |

---

## Data Flow Through the Codebase

1. **Popup:** User input → `popup.js` → `chrome.storage.local` (persist) → `chrome.tabs.sendMessage(FBMP_START, { query, pages })`.
2. **Content:** Message → `content.js` `startRun` → `triggerMarketplaceSearch` (optional navigation + sessionStorage) or direct → `filterEngine.compileQuery` → `domHandler.extractListings` + `applyVisibility` → `observer` + `scrollManager.autoScroll`.

No other entry points (e.g. no background script, no options page).
