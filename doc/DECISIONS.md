# Key Design Decisions & WHY They Were Taken

Important design decisions in this project and the rationale behind them (including tradeoffs).

---

## 1. No backend / server

**Decision:** The product is a Chrome extension only. No Node server, no cloud functions, no API backend.

**Why:** The problem is entirely in-browser: drive Facebook’s own search and filter the DOM. A server would add hosting, auth, and latency without solving a user need. Keeping everything in the extension simplifies deployment (load unpacked / Chrome Web Store) and avoids CORS or API keys.

**Tradeoff:** We cannot persist “runs” or analytics across devices; we rely on Chrome storage and sessionStorage. Acceptable for a personal productivity tool.

---

## 2. Vanilla JS in popup (no React/Vue)

**Decision:** Popup is plain HTML + CSS + JS (ES module). No React, Vue, or Svelte.

**Why:** The popup is tiny (one form, one button, one status line). A framework would add bundle size and build tooling for little benefit. Vanilla JS keeps the repo build-free and easy to onboard.

**Tradeoff:** If the popup grows (e.g. history, presets), we might revisit. For now, YAGNI.

---

## 3. Content script as classic script that dynamic-imports ES modules

**Decision:** Manifest declares one script: `content/content.js` (classic). That file uses `import(chrome.runtime.getURL("content/domHandler.js"))` etc. to load ES modules.

**Why:** MV3 content scripts are often executed as classic scripts depending on context. Using a small classic bootstrap that dynamic-imports modules avoids “script doesn’t support ES modules” issues while keeping the rest of the code in proper modules (clear boundaries, tree-shakeable if we ever add a build).

**Tradeoff:** All those modules must be listed in `web_accessible_resources` so the script can fetch them. We accepted that and documented it.

---

## 4. Navigate to search URL instead of simulating autosuggest click

**Decision:** When the user is not already on a Marketplace search results page, we build the search URL (`/marketplace/<location>/search?query=...`), write pending config to sessionStorage, and set `location.href` to that URL. We do **not** try to type in the search box and programmatically click the first autosuggest option.

**Why:** Facebook’s autosuggest is React-driven and often not reliably triggerable from our script (timing, focus, synthetic events). Multiple attempts (clicking listbox options, ArrowDown+Enter, matching span text) were flaky. Direct navigation is deterministic and matches what the user sees when they manually run a search.

**Tradeoff:** We depend on the current URL path to derive “location” (e.g. Dallas). If Facebook changes URL structure, we must update `buildMarketplaceSearchUrl`. We accepted this over fragile DOM automation.

---

## 5. Pending run via sessionStorage (not chrome.storage)

**Decision:** The “pending run” (query + pages to run after navigation) is stored in `sessionStorage` under `__fbmp_pendingRun` before navigating. On the new page, the content script reads it and runs filter + auto-scroll, then deletes the key.

**Why:** sessionStorage is scoped to the tab and survives full-page navigation within that tab. chrome.storage is extension-wide and would require matching “which tab we just navigated” to the run that requested it. sessionStorage is simpler and correct for “this tab just landed on search results; run the pending config here.”

**Tradeoff:** If the user opens the search in a new tab or sessionStorage is cleared, the pending run is lost. We document this as a known limitation.

---

## 6. Hiding the visual container (parent column) instead of only the card node

**Decision:** When a listing doesn’t match, we set `display: none` on the **visual container** — the ancestor with inline `max-width`/`min-width` (the column wrapper), or the top of a single-child wrapper chain — not just the inner card div we attach `data-fbmp-*` to.

**Why:** Hiding only the inner node left the outer column div in layout, causing large white gaps. Facebook’s grid lays out by those column wrappers; hiding them makes the grid reflow and removes the gaps.

**Tradeoff:** We rely on a heuristic (style attribute or single-child chain). If Facebook restyles and removes those attributes or changes structure, we may need to adjust `findVisualCardContainer`.

---

## 7. Fail-open on query parse errors

**Decision:** If tokenize or parse throws, `compileQuery` returns a matcher that matches every title (`() => true`) and logs a warning. We do not fail closed (hide everything) or show a modal.

**Why:** A typo or unsupported character in the query shouldn’t empty the entire results set. Better to show all results and log for the dev than to confuse the user with no results.

**Tradeoff:** Advanced users might prefer a strict mode or an explicit “invalid query” state in the UI. Not implemented yet.

---

## 8. No background service worker

**Decision:** The manifest does not declare a `background.service_worker`. The extension has no long-lived background script.

**Why:** We don’t need to run code when the popup is closed or when no Marketplace tab is open. All logic is either in the popup (when open) or in the content script (when a Marketplace tab is active). Omitting the worker simplifies the extension and avoids MV3 service worker lifecycle quirks.

**Tradeoff:** We can’t do things like “run filter every 5 minutes” or react to tab updates in the background. Not a current requirement.

---

## 9. Retry messaging with scripting.executeScript on “Receiving end does not exist”

**Decision:** When the popup’s `sendMessage` fails with a “receiving end does not exist”–style error, we call `chrome.scripting.executeScript` to inject `content/content.js` into the active tab and then retry the message once.

**Why:** The content script is only injected on page load for matching URLs. If the user had the tab open before installing/reloading the extension, or in edge cases, the listener might not exist. Injecting and retrying improves success rate without requiring the user to manually refresh.

**Tradeoff:** Double injection is safe (content script has `__fbmpFilterInitialized` guard). We don’t retry on other errors (e.g. “Not on a Marketplace tab”).

---

## 10. Boolean query language (custom tokenizer/parser)

**Decision:** We implemented a small query language (AND/OR/NOT, phrases, wildcards) with our own tokenizer and recursive-descent parser instead of using a generic search library or regex-only matching.

**Why:** We needed clear semantics (spaces = AND, `|` = OR, etc.) and a single evaluation path for title matching. A minimal custom pipeline keeps dependencies at zero and keeps behavior predictable and debuggable.

**Tradeoff:** New features (e.g. field:value, fuzzy match) require changing our parser and evaluator, not just config.

---

## 11. Scroll to top after auto-scroll run

**Decision:** When the “run” finishes (including after N pages of auto-scroll), we call `window.scrollTo({ top: 0, behavior: "smooth" })`.

**Why:** After scrolling down to load more, the viewport is at the bottom and the user would see a big gap above (where hidden items were). Scrolling to top shows the first visible results in sequence.

**Tradeoff:** Some users might prefer to stay at the bottom; we could make this optional later.

---

## 12. Single run at a time (epoch + AbortController)

**Decision:** `startRun` aborts any in-flight run (runAbort.abort()), increments epoch, and runs one filter + scroll cycle. We don’t queue multiple runs or support “cancel” in the UI.

**Why:** Keeps state simple: one config, one matcher, one observer. Avoiding overlapping runs prevents duplicate work and confusing DOM state.

**Tradeoff:** Rapid Start clicks or multiple tabs can still lead to overlapping behavior; we don’t coordinate across tabs.
