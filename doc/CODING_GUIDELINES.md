# Coding Standards & Patterns Used

Conventions, patterns, and practices used in this codebase.

---

## Naming conventions

| Kind | Convention | Examples |
|------|------------|----------|
| **Variables / parameters** | camelCase | `config`, `nextConfig`, `cardEl`, `shouldShow` |
| **Functions** | camelCase | `applyVisibility`, `refilterAll`, `findVisualCardContainer` |
| **Constants** | UPPER_SNAKE (when module-level or shared) | `PENDING_KEY`, `STORAGE_KEYS`, `evaluatedEpochAttr` |
| **Private / internal** | camelCase; no # private fields (we use IIFE/closure) | `startRun`, `triggerMarketplaceSearch` |
| **DOM IDs** | lowercase, hyphen if needed | `query`, `pages`, `start`, `status` |
| **Data attributes** | prefix `data-fbmp-` | `data-fbmp-epoch`, `data-fbmp-match` |
| **Storage keys** | prefix `fbmp_` for Chrome storage | `fbmp_query`, `fbmp_pages` |
| **Session key** | double-underscore prefix for “internal” | `__fbmp_pendingRun` |
| **Message types** | UPPER_SNAKE, prefix `FBMP_` | `FBMP_START`, `FBMP_PING` |

---

## State management

- **Popup:** No global framework state. Form state lives in the DOM; persisted state in `chrome.storage.local`. Load on DOMContentLoaded; save on Start click.
- **Content script:** Single IIFE. State is in closure: `config`, `matchesTitle`, `epoch`, `runAbort`, and the observer instance. No Redux, no reactive store. One “run” at a time; new Start aborts previous and increments epoch.
- **Cross-navigation state:** Only the pending run is passed via `sessionStorage` (JSON `{ query, pages }`). No other cross-page state.

---

## Error handling

- **Query parse (tokenize/parse):** On throw, `compileQuery` returns a matcher that matches everything and logs with `console.warn("[FBMP] ...", e)`. Fail-open so a bad query doesn’t hide all results.
- **Popup messaging:** try/catch around `sendStartMessage`. On failure, set status text (including error message) and `console.warn("Popup message failed:", e)`. No uncaught throws to the user.
- **Content script:** startRun errors are passed to sendResponse({ ok: false, error }). Other errors (e.g. in triggerMarketplaceSearch, applyVisibility) are caught and logged with `[FBMP]`; we don’t let them tear down the message listener.
- **No global onerror or unhandledrejection** handlers. No Sentry or external reporting.

---

## Logging style

- **Prefix:** All extension-originated logs use the prefix `[FBMP]` so they can be filtered in DevTools (e.g. “FBMP” in the console filter).
- **Level:** Use `console.warn` for recoverable or unexpected conditions (e.g. “Query tokenization failed”, “Failed to sync Marketplace search box”, “Receiving end does not exist” then retry). Use `console.log` only for the single “content script loaded” line at startup.
- **Content:** Include short context (e.g. the error object or message). Avoid logging large objects or DOM nodes.
- **No log levels or log lib:** No DEBUG/INFO/WARN abstraction; just console.warn and one console.log.

---

## Testing approach

- **Current:** No automated tests in the repo. No test runner (Jest, Vitest, etc.), no E2E (Playwright, Cypress).
- **Manual:** Developers run the extension via “Load unpacked”, open Marketplace, and test flows in the browser.
- **If tests are added later:** Prefer unit tests for tokenizer, parser, evaluator, and filterEngine (pure logic). Content script and popup are harder to test without a browser; consider integration tests with a test page or stub DOM. Keep the project zero-dependency unless tests are explicitly added.

---

## File and module structure

- **One main responsibility per file.** content.js orchestrates; domHandler does DOM extraction; filterEngine does query compilation; observer and scrollManager do observation and scrolling; utils do query parsing and evaluation.
- **Exports:** Only what’s needed. domHandler exports `extractListings`; filterEngine exports `compileQuery`; observer exports `ListingsObserver`; scrollManager exports `autoScroll`; evaluator exports `createEvaluator` and `normalizedTitleWords`; tokenizer exports `tokenize` and `TokenType`; parser exports `parse`; wildcard exports `compileWildcard`.
- **Imports:** ES module `import` in content modules; dynamic `import(chrome.runtime.getURL(...))` only in content.js (because the entry is a classic script).

---

## DOM and selectors

- **Avoid Facebook class names** for identifying elements; they are minified/volatile. Prefer:
  - `a[href*="/marketplace/item/"]`
  - `input[aria-label="Search Marketplace"]`, `input[placeholder="Search Marketplace"]`
  - `div[style*="max-width"][style*="min-width"]` for the visual column wrapper
  - `ul[role="listbox"]`, `li[role="option"]` if we ever need listbox again
- **Traversal:** Use `parentElement`, `closest`, `querySelector`/`querySelectorAll` as needed. Prefer a bounded depth (e.g. 6 or 12) when walking up to avoid runaway loops.
- **Mutating the page:** Only set `style.display` and `setAttribute` for our data attributes. Don’t remove or move FB’s nodes; only hide our chosen container.

---

## Async and messaging

- **chrome.runtime.onMessage:** For async response we call `sendResponse` inside a `.then()` and **return true** from the listener to keep the message channel open.
- **Popup:** All messaging is async (await sendStartMessage). Use try/catch and update the status div; no fire-and-forget for Start.
- **AbortController:** Used for autoScroll (runAbort.signal). On new Start we abort the previous run so we don’t have two scroll loops.

---

## Comments and JSDoc

- **Comments:** Used for non-obvious logic (e.g. why we hide the container, why we use sessionStorage, why we navigate instead of clicking autosuggest). Avoid stating the obvious.
- **JSDoc:** Used for public exports and important internal functions (e.g. `@param`, `@returns`, `@typedef`). Types are expressed as JSDoc where helpful (e.g. `/** @type {{ query: string, pages: number }} */`). No TypeScript; we rely on JSDoc and discipline.

---

## Dependencies and build

- **No npm dependencies.** The extension is plain JS and HTML/CSS. No package.json in the repo (or it’s minimal if present for tooling only).
- **No minification or bundling** for the extension itself. If a build step is added later, keep the source readable and document the build in SETUP.md.

---

## Summary

| Area | Practice |
|------|----------|
| Naming | camelCase (vars/funcs), UPPER_SNAKE (constants), data-fbmp-*, fbmp_*, FBMP_* |
| State | Closure in content script; storage.local + DOM in popup; sessionStorage for pending run only |
| Errors | Fail-open for query; catch and warn; sendResponse({ ok: false, error }) for startRun |
| Logging | [FBMP] prefix; console.warn for failures; one console.log at content load |
| Tests | None currently; prefer unit tests for query/utils if added |
| DOM | No FB class names; use attributes/href/role; hide container, not just card |
| Async | return true + sendResponse in .then for onMessage; AbortController for scroll |
