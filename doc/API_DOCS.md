# API Contracts & Data Models

Documentation of messaging contracts, storage keys, and core data shapes. This project has **no HTTP backend APIs**; “APIs” here mean Chrome extension messaging, storage, and internal function contracts.

---

## 1. Chrome Extension Messaging (Popup ↔ Content Script)

### Outbound: Popup → Content script

**Method:** `chrome.tabs.sendMessage(tabId, message, callback)`

**Messages:**

#### FBMP_START (start a filter run)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"FBMP_START"` |
| `payload` | object | See below |

**payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Boolean search query (e.g. `"restoration hardware sofa"`). |
| `pages` | number | Yes | Auto-scroll page count (0–50). 0 = filter current results only. |

**Example:**

```json
{
  "type": "FBMP_START",
  "payload": {
    "query": "restoration hardware sofa",
    "pages": 10
  }
}
```

#### FBMP_PING (connectivity check)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"FBMP_PING"` |

No payload. Used to verify the content script is listening.

---

### Inbound: Content script → Popup (response)

**Response** is passed to the `sendMessage` callback (or lastError if message failed).

**Success:**

```json
{
  "ok": true
}
```

**Failure (content script ran but startRun failed):**

```json
{
  "ok": false,
  "error": "string message"
}
```

**Chrome error (no listener, tab closed, etc.):** No response object; `chrome.runtime.lastError` is set (e.g. “Could not establish connection. Receiving end does not exist.”). Popup treats this as failure and may retry after `scripting.executeScript`.

---

## 2. Chrome Storage (Persistent)

**API:** `chrome.storage.local`

**Keys (popup settings):**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fbmp_query` | string | `""` | Last Boolean search query. |
| `fbmp_pages` | number | `10` | Last “Auto-scroll pages” value (0–50). |

**Read (popup):** `chrome.storage.local.get({ [STORAGE_KEYS.query]: "", [STORAGE_KEYS.pages]: 10 })`  
**Write (popup):** `chrome.storage.local.set({ query, pages })` on Start click.

No other keys are used. No TTL or schema version.

---

## 3. Session Storage (Pending Run)

**API:** `sessionStorage` (tab-scoped)

**Key:** `__fbmp_pendingRun`

**Value:** JSON string of the **config** object at the time of navigation:

```json
{
  "query": "string",
  "pages": 10
}
```

**Written by:** Content script in `triggerMarketplaceSearch` before setting `location.href`.  
**Read by:** Content script on the **new** page load (search results). After reading, the key is removed.  
**Lifetime:** Until the new page’s content script runs or the tab is closed.

---

## 4. Internal Data Shapes (Content Script)

### Config (in-memory)

```ts
{
  query: string;   // trimmed
  pages: number;  // 0–50
}
```

Held in `content.js` as `config`; also what is stored in sessionStorage as the pending run.

### Listing (domHandler)

Returned by `extractListings(root)`:

```ts
{
  cardEl: HTMLElement;   // card root from findCardRoot(anchor)
  anchorEl: HTMLAnchorElement;
  id: string | null;     // item ID from href
  title: string;         // extracted title for matching
}
```

### Compiled query (filterEngine)

Returned by `compileQuery(query)`:

```ts
{
  matchesTitle: (title: string) => boolean;
  meta: { strictMode: boolean };
}
```

### Message payload (FBMP_START)

Same as config: `{ query: string, pages: number }`.

---

## 5. DOM Attributes (Content Script)

| Attribute | Element | Values | Purpose |
|-----------|---------|--------|---------|
| `data-fbmp-epoch` | Card root (and optionally visual container) | number string (e.g. `"1"`) | Which run last evaluated this card; skip re-eval if same epoch. |
| `data-fbmp-match` | Visual container (and optionally card root) | `"0"` or `"1"` | 0 = hidden (display: none), 1 = visible. |

Visibility is applied to the **visual container** (see ARCHITECTURE / CODEBASE_MAP). The content script does not expose these as a formal “API”; they are implementation details for filtering and debugging.

---

## 6. No Auth APIs

The extension does not call any authentication APIs. The user must be logged into Facebook in the browser. We do not read or send cookies, tokens, or credentials.

---

## 7. No External HTTP APIs

The extension does not call Facebook’s Graph API or any other HTTP API. It only:

- Navigates to Marketplace URLs (`location.href`).
- Reads and mutates the DOM of the loaded page.

So there are no request/response schemas for external services to document here.

---

## Summary

| Contract | Direction | Format |
|----------|------------|--------|
| FBMP_START | Popup → Content | `{ type, payload: { query, pages } }` → `{ ok [, error] }` |
| FBMP_PING | Popup → Content | `{ type: "FBMP_PING" }` → `{ ok: true }` |
| chrome.storage.local | Popup read/write | Keys: `fbmp_query`, `fbmp_pages` |
| sessionStorage | Content (same tab, across nav) | Key: `__fbmp_pendingRun`, value: JSON `{ query, pages }` |
| Listing / config / compileQuery | Internal only | See “Internal Data Shapes” above. |
