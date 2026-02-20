# Current Development State (Snapshot)

What is completed, partially implemented, pending, and known issues.

---

## Completed Features

| Feature | Description |
|--------|--------------|
| **Popup UI** | Boolean Search textarea, Auto-scroll pages (0–50), Start button, status message. Persists query and pages to chrome.storage.local. |
| **Chrome messaging** | Popup sends FBMP_START with { query, pages }; content script responds with { ok } or { ok, error }. FBMP_PING for connectivity check. Retry via scripting.executeScript when “Receiving end does not exist”. |
| **URL-based search** | Build `/marketplace/<location>/search?query=...` from current URL; navigate when not already on search page; persist pending run in sessionStorage; on load, resume run with allowNavigate: false. |
| **Boolean query** | Tokenizer, parser, evaluator, wildcard. Spaces = AND, \| = OR, - = NOT, quotes = phrase, * = wildcard. compileQuery returns matchesTitle(title). Fail-open on parse errors. |
| **Listing extraction** | domHandler: find anchors, findCardRoot, extractTitleFromCard. Works on current FB Marketplace DOM (no class-based selectors for card identity). |
| **Filtering** | refilterAll / scanAndFilter; applyVisibility hides **visual container** (max-width/min-width ancestor or single-child chain) so grid reflows without white gaps. |
| **MutationObserver** | ListingsObserver debounces and passes added roots to scanAndFilter so new listings get filtered. |
| **Auto-scroll** | scrollManager.autoScroll: scroll to bottom, wait for listing count increase or timeout, onAfterEach flush + scanAndFilter. Optional scroll pages (0 = current only). |
| **Scroll to top** | After run completes, window.scrollTo({ top: 0, behavior: "smooth" }). |
| **web_accessible_resources** | All content/utils JS listed so content script can dynamic-import modules. |
| **Documentation** | PROJECT_OVERVIEW, ARCHITECTURE, CODEBASE_MAP, DECISIONS, STATUS, SETUP, API_DOCS, CURSOR_CONTEXT, CODING_GUIDELINES. |

---

## Partially Implemented / Optional Behavior

| Item | State |
|------|--------|
| **Search input sync** | triggerMarketplaceSearch optionally syncs the visible Marketplace search input (value + input/change). Used only when we don’t navigate; effect is best-effort and not required for the main flow. |
| **Strict mode (exact words only)** | filterEngine still has isSimpleStrictQuery and a strictMode meta flag, but the matcher no longer enforces “title words = query words exactly”; we use the same AND semantics for simple and complex queries. So “strict” is currently not user-visible. |
| **Location** | Location for the search URL is derived from the current pathname (e.g. /marketplace/dallas → dallas). There is no popup field or API to set location; user must set it in Facebook’s UI first. |

---

## Pending / Not Implemented

| Item | Notes |
|------|--------|
| **Automated tests** | No unit tests (tokenizer, parser, evaluator, filterEngine), no integration tests (content script, popup), no E2E. |
| **Strict mode UI** | No checkbox or option for “match only these exact words” in the popup. |
| **Location picker** | No way in the extension to choose city/radius; relies on current page URL. |
| **Cancel button** | No explicit “Cancel run” in popup; run can be superseded by a new Start. |
| **History / saved queries** | No list of past queries or saved presets. |
| **Error reporting** | No Sentry or similar; only console.warn and popup status text. |
| **Build / minification** | No bundler or minification; all plain JS. |
| **Chrome Web Store** | Not published; only “Load unpacked” usage. |
| **Options page** | No dedicated options UI; settings are only in the popup. |

---

## TODOs / Commented Code

- No formal TODO comments in the codebase at the time of this snapshot.
- domHandler.js still has a note: “You said you'll provide the Marketplace DOM snippet later. When you do, we can tighten findCardRoot() and extractTitleFromCard() further.” So there is an implicit TODO to refine selectors if DOM snippets are provided.

---

## Known Bugs / Missing Edge Cases

| Issue | Severity | Notes |
|-------|----------|--------|
| **Sponsored / non-item listings** | Low | Only nodes with `a[href*="/marketplace/item/"]` are treated as listings. Sponsored or other ad cards are not hidden, so layout can still show gaps or mixed content. |
| **New tab / sessionStorage** | Low | If the user opens the search URL in a new tab, sessionStorage from the previous tab is not available there, so the pending run won’t resume in the new tab. |
| **Tabs opened before reload** | Medium | If the extension was reloaded while a Marketplace tab was already open, that tab may not have the content script until the user refreshes. We mitigate with scripting.executeScript retry from the popup. |
| **Multiple tabs** | Low | Each tab has its own content script and epoch. Starting a run in tab A and then in tab B doesn’t cancel A; no cross-tab coordination. |
| **Facebook DOM changes** | Medium | Card detection and visual container detection depend on current DOM (e.g. max-width/min-width wrapper, single-item link). FB markup changes can break extraction or layout fix. |
| **Empty or very long titles** | Low | extractTitleFromCard has length and scoring heuristics; edge cases (no text, only price) may yield empty title and thus non-match for any non-empty query. |

---

## Summary

- **Completed:** Full user flow (popup → search URL → filter + auto-scroll → scroll to top), Boolean query, DOM hiding with parent container, observer, and docs.
- **Partial:** Search input sync, strict mode (internal only), location from URL only.
- **Pending:** Tests, strict mode UI, location picker, cancel, history, build, store publish.
- **Known issues:** Sponsored content, sessionStorage/tab scope, script injection timing, multi-tab, DOM volatility, title edge cases.
