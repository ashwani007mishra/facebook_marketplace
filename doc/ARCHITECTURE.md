# System Architecture & Data Flow

**FB Marketplace Boolean Filter** — Complete system architecture and data flow.

---

## Overview: Client-Only Extension

This project has **no backend server, no database, and no external APIs under our control**. It is a **Chrome extension (Manifest V3)** that runs entirely in the browser. All “system” components are:

- **Frontend (popup)** — Extension popup UI.
- **Content script** — Injected into Facebook Marketplace pages.
- **Chrome extension APIs** — Storage, tabs, scripting, messaging.
- **Facebook’s page** — External; we read and mutate the DOM and navigate via URL.

So: **Frontend (popup) ↔ Chrome APIs ↔ Content script (in FB page)**. No DB, no auth server, no cron, no webhooks.

---

## Architecture Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER (Chrome)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐         chrome.tabs.sendMessage                     │
│  │   EXTENSION POPUP    │ ───────────────────────────────────────────────►   │
│  │   (popup.html/js)    │         FBMP_START / FBMP_PING                     │
│  │                      │ ◄───────────────────────────────────────────────   │
│  │  - Boolean query     │         { ok, error? }                            │
│  │  - Auto-scroll pages│                                                     │
│  │  - Start button     │                                                     │
│  └──────────┬───────────┘                                                     │
│             │                                                                 │
│             │ chrome.storage.local.get/set                                    │
│             ▼                                                                 │
│  ┌──────────────────────┐                                                     │
│  │  Chrome Storage API  │   Keys: fbmp_query, fbmp_pages                     │
│  │  (persisted settings)│                                                     │
│  └──────────────────────┘                                                     │
│                                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB: https://www.facebook.com/marketplace/.../search?query=...             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │              FACEBOOK MARKETPLACE PAGE (React DOM)                   │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │  CONTENT SCRIPT (content.js + imported modules)                  │ │    │
│  │  │  - Listens for FBMP_START / FBMP_PING                            │ │    │
│  │  │  - triggerMarketplaceSearch() → location.href or sync input      │ │    │
│  │  │  - startRun(): compileQuery → refilterAll → autoScroll → scroll  │ │    │
│  │  │  - MutationObserver → scanAndFilter on new nodes                 │ │    │
│  │  │  - applyVisibility() on card container (display: none)            │ │    │
│  │  └────────────────────────────┬───────────────────────────────────┘ │    │
│  │                                 │                                      │    │
│  │  sessionStorage                 │  Reads/mutates                       │    │
│  │  __fbmp_pendingRun               │  - Listing anchors & card roots     │    │
│  │  (pending config across nav)     │  - Search input (optional sync)     │    │
│  │                                 ▼                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐   │    │
│  │  │  FB DOM: listing cards, search box, column wrappers             │   │    │
│  │  └────────────────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

EXTERNAL (we do not control):
  - Facebook/Meta servers: serve Marketplace UI and data. We only navigate (URL)
    and interact with the DOM; no direct API calls to FB.
```

---

## Data Flow (Detail)

### 1. User clicks “Start” in popup

1. **Popup** reads `#query` and `#pages`, saves to `chrome.storage.local` (keys `fbmp_query`, `fbmp_pages`).
2. **Popup** gets active tab via `chrome.tabs.query({ active: true, currentWindow: true })`.
3. **Popup** checks `tab.url` is a Marketplace URL (path starts with `/marketplace`).
4. **Popup** sends `{ type: "FBMP_START", payload: { query, pages } }` with `chrome.tabs.sendMessage(tabId, ...)`.
5. If that fails with “Receiving end does not exist”, popup calls `chrome.scripting.executeScript({ target: { tabId }, files: ["content/content.js"] })` and retries the message once.

### 2. Content script receives FBMP_START

1. **Content script** (if not already running) was injected by manifest or by `scripting.executeScript`. It sets `window.__fbmpFilterInitialized = true` and loads ES modules (domHandler, filterEngine, observer, scrollManager).
2. **Message listener** receives `FBMP_START`, calls `startRun(payload, { allowNavigate: true })`.
3. **startRun** updates in-memory `config` (query, pages), then:
   - If `config.query` is set: calls **triggerMarketplaceSearch(query, { allowNavigate: true })**.

### 3. triggerMarketplaceSearch (navigation path)

1. Optionally syncs the visible Marketplace search input (value + input/change events).  
2. If **not** already on a Marketplace **search** URL (path like `/marketplace/.../search`):
   - Writes `config` to **sessionStorage** under key `__fbmp_pendingRun`.
   - Builds URL: `location.origin + /marketplace/<location>/search?query=<encoded>` (location from current pathname).
   - Sets **location.href** to that URL → **full page navigation** (content script context is torn down).

### 4. New page load (search results page)

1. **New content script** runs (manifest injects into marketplace URLs).
2. **Before** registering the message listener, it checks: if URL is a Marketplace search page **and** `sessionStorage.getItem("__fbmp_pendingRun")` is set:
   - Parses JSON, removes key from sessionStorage.
   - Calls **startRun(pending, { allowNavigate: false })** so we do not navigate again.
3. **startRun** (this time with `allowNavigate: false`): skips `triggerMarketplaceSearch` navigation; compiles query, starts observer, **refilterAll()**, then **autoScroll** (if pages > 0), then **scrollTo(0)**.

### 5. Filtering and DOM

1. **extractListings(document)** finds all `a[href*="/marketplace/item/"]`, gets card root per anchor (domHandler), extracts title text.
2. **compileQuery(config.query)** (filterEngine) tokenizes and parses the Boolean query, returns `matchesTitle(title)`.
3. For each listing, **evaluateListing** sets `data-fbmp-epoch` and calls **applyVisibility(cardEl, matchesTitle(title))**.
4. **applyVisibility** resolves the **visual container** (ancestor with `max-width`/`min-width` or single-child chain), sets `data-fbmp-match` and **display: none** (or clears it) on that container.
5. **MutationObserver** (observer.js) sees new nodes → debounce → **scanAndFilter(roots)** so new listings get filtered.

### 6. Auto-scroll

1. **scrollManager.autoScroll** scrolls to bottom, waits, checks listing count increased (or timeout), calls **onAfterEach** which runs **observer.flushNow()** and **scanAndFilter(document)**.
2. After N pages, **startRun** ends with **window.scrollTo({ top: 0, behavior: "smooth" })**.

---

## Frontend → Backend → DB → External

| Layer            | In this project |
|-----------------|------------------|
| **Frontend**    | Popup (HTML/CSS/JS) + Content script (JS modules) in the FB page. |
| **Backend**     | **None.** No server. |
| **DB**          | **None.** Only `chrome.storage.local` (key-value) and `sessionStorage` (pending run). |
| **External**    | **Facebook’s site only.** We don’t call FB APIs; we navigate and interact with the DOM. |

---

## Authentication Flow

**Not applicable.** The extension does not implement login. The user must already be logged into Facebook in the same browser. The extension runs in the context of the logged-in tab; it does not see or store credentials.

---

## Role / Permission Model

**No roles.** Single user type: whoever has the extension installed and is on a Marketplace tab. Chrome’s own permission model applies:

- **storage** — persist popup settings.
- **tabs** — get active tab, send messages.
- **scripting** — inject content script on failure to connect.
- **host_permissions** — access to `https://www.facebook.com/marketplace/*`, etc.

There is no app-level RBAC or permission matrix.

---

## Background Jobs, Cron, Webhooks

- **No background service worker** — The manifest has no `background.service_worker`. Nothing runs when the popup is closed.
- **No cron** — No scheduled tasks.
- **No webhooks** — No outbound HTTP callbacks or inbound endpoints.

The only “background-like” behavior is the **MutationObserver** inside the content script, which runs only while the Marketplace tab is open and the script is loaded.

---

## API Boundaries

| Boundary | Description |
|----------|-------------|
| **Popup ↔ Content script** | Chrome messaging: `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`. Contract: `FBMP_START` with `{ query, pages }`, response `{ ok: true }` or `{ ok: false, error }`; `FBMP_PING` → `{ ok: true }`. |
| **Content script ↔ FB page** | No formal API. We read DOM (anchors, card roots, titles, search input) and mutate DOM (display, attributes). We navigate via `location.href`. |
| **Content script ↔ Chrome** | `chrome.runtime.getURL()` for module URLs; `chrome.scripting.executeScript` is used from popup, not from content script. |
| **Extension ↔ Facebook servers** | None. We do not call any Facebook/Meta HTTP APIs. |

---

## Summary

- **Architecture:** Single Chrome extension; popup UI + content script in Marketplace tab; no backend, no DB, no auth, no cron, no webhooks.
- **Data flow:** User → Popup → Chrome messaging → Content script → DOM read/write and optional navigation; persistence only via Chrome storage and sessionStorage.
- **External:** Only Facebook’s rendered page; we use URL and DOM only.
