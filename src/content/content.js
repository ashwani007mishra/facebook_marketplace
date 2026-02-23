// Content script entrypoint (MV3).
// This file is intentionally a small orchestrator and loads ES modules via dynamic import
// to stay compatible even when the browser treats manifest-declared content scripts as
// classic scripts.

(async () => {
  if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.getURL !== "function") {
    console.warn("[FBMP] Chrome extension API not available; content script cannot run in this context.");
    return;
  }
  console.log("[FBMP] Marketplace Filter content script loaded on", location.href);
  if (window.__fbmpFilterInitialized) return;
  window.__fbmpFilterInitialized = true;

  const [{ extractListings }, { compileQuery }, { ListingsObserver }, { autoScroll }] =
    await Promise.all([
      import(chrome.runtime.getURL("src/content/domHandler.js")),
      import(chrome.runtime.getURL("src/content/filterEngine.js")),
      import(chrome.runtime.getURL("src/content/observer.js")),
      import(chrome.runtime.getURL("src/content/scrollManager.js"))
    ]);

  /** @type {{ query: string, pages: number }} */
  let config = { query: "", pages: 10 };

  /** @type {(title: string) => boolean} */
  let matchesTitle = () => true;

  let epoch = 0;
  /** @type {AbortController|null} */
  let runAbort = null;

  // Cache: avoid repeated work and flicker.
  const evaluatedEpochAttr = "data-fbmp-epoch";
  const evaluatedResultAttr = "data-fbmp-match";

  /**
   * Given the internal card root we attach metadata to, find the outer visual
   * container that should actually be hidden so we don't leave empty boxes
   * in the grid.
   *
   * Heuristics:
   * - Prefer the nearest ancestor with inline max-width/min-width (the
   *   Marketplace column wrapper you highlighted).
   * - Otherwise, walk up while the parent only has this single element as
   *   a child, which usually corresponds to structural wrappers for the card.
   */
  function findVisualCardContainer(cardEl) {
    if (!(cardEl instanceof HTMLElement)) return cardEl;

    // First, look for the "column" container with explicit width constraints.
    const widthWrapper = cardEl.closest('div[style*="max-width"][style*="min-width"]');
    if (widthWrapper instanceof HTMLElement) {
      return widthWrapper;
    }

    // Fallback: walk up single-child wrappers.
    let el = cardEl;
    for (let depth = 0; depth < 6; depth++) {
      const parent = el.parentElement;
      if (!parent || parent === document.body) break;
      if (parent.childElementCount !== 1) break;
      el = parent;
    }
    return el;
  }

  function applyVisibility(cardEl, shouldShow) {
    const target = findVisualCardContainer(cardEl);
    const prev = target.getAttribute(evaluatedResultAttr);
    const next = shouldShow ? "1" : "0";
    if (prev === next) return;

    target.setAttribute(evaluatedResultAttr, next);
    // Also mirror the attribute on the inner card element for debugging and
    // easier inspection when looking at just the anchor/card root.
    if (target !== cardEl) {
      cardEl.setAttribute(evaluatedResultAttr, next);
    }

    target.style.display = shouldShow ? "" : "none";
  }

  function evaluateListing(listing) {
    const { cardEl, title } = listing;
    // Empty titles: treat as non-match for non-empty query, but keep visible if query is empty.
    const ok = config.query.trim() ? matchesTitle(title || "") : true;
    cardEl.setAttribute(evaluatedEpochAttr, String(epoch));
    applyVisibility(cardEl, ok);
    return ok;
  }

  function scanAndFilter(root) {
    const listings = extractListings(root);
    for (const l of listings) {
      const already = l.cardEl.getAttribute(evaluatedEpochAttr) === String(epoch);
      if (already) continue;
      evaluateListing(l);
    }
    return listings.length;
  }

  function refilterAll() {
    const listings = extractListings(document);
    for (const l of listings) evaluateListing(l);
    return listings.length;
  }

  const observer = new ListingsObserver({
    debounceMs: 200,
    onChange: (roots) => {
      for (const r of roots) scanAndFilter(r);
    }
  });

  function getListingCount() {
    // Fast count used for scroll progression; avoids full title extraction.
    return document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  }

  const PENDING_KEY = "__fbmp_pendingRun";

  function isMarketplaceSearchPage() {
    try {
      const url = new URL(location.href);
      return /^\/marketplace(\/[^/]+)?\/search/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isOnMarketplacePage() {
    try {
      return (location.pathname || "").startsWith("/marketplace");
    } catch {
      return false;
    }
  }

  function clearFilterAndStopObserving() {
    observer.stop();
    config = { query: "", pages: 10 };
    matchesTitle = () => true;
    refilterAll();
  }

  function normalizeQueryForCompare(q) {
    try {
      return decodeURIComponent(String(q ?? "")).trim();
    } catch {
      return String(q ?? "").trim();
    }
  }

  function getCurrentUrlSearchQuery() {
    try {
      const url = new URL(location.href);
      const q = url.searchParams.get("query");
      return normalizeQueryForCompare(q);
    } catch {
      return "";
    }
  }

  function buildMarketplaceSearchUrl(query) {
    const url = new URL(location.href);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("marketplace");
    let base = "/marketplace";
    if (idx !== -1 && parts.length > idx + 1 && parts[idx + 1] !== "search") {
      base += "/" + parts[idx + 1];
    }
    url.pathname = base + "/search";
    url.search = "";
    url.searchParams.set("query", String(query ?? ""));
    return url.toString();
  }

  /**
   * Ensure the current tab is on a Marketplace search URL with the query.
   * - On search pages: never sync input (avoids API storm). If URL already has same query, return.
   *   If URL has no query or different query, navigate so the URL gets ?query=...
   * - On non-search pages: store pending config and navigate to the search URL.
   */
  async function triggerMarketplaceSearch(query, { allowNavigate = true } = {}) { 
    const queryTrimmed = String(query ?? "").trim();
    const onSearchPage = isMarketplaceSearchPage();

    if (onSearchPage) {
      const currentUrlQuery = getCurrentUrlSearchQuery();
      console.log("[FBMP] currentUrlQuery:", currentUrlQuery);
      const newQueryNorm = normalizeQueryForCompare(queryTrimmed);
      if (currentUrlQuery === newQueryNorm) {
        return;
      }
      if (allowNavigate) {
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(config));
        } catch (e) {
          console.warn("[FBMP] Failed to persist pending run:", e);
        }
        location.href = buildMarketplaceSearchUrl(queryTrimmed);
      }
      return;
    }

    if (!allowNavigate) return;

    try {
      console.log("[FBMP] setting pending run:", config);
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("[FBMP] Failed to persist pending run:", e);
    }
    location.href = buildMarketplaceSearchUrl(queryTrimmed);
  }

  async function startRun(nextConfig, options = {}) {
    const { allowNavigate = true } = options;
    // Cancel any in-flight run (query changes while running).
    runAbort?.abort();
    runAbort = new AbortController();
    epoch++;

    config = {
      query: String(nextConfig?.query ?? "").trim(),
      pages: Math.max(0, Math.min(50, Number(nextConfig?.pages ?? 10)))
    };
    console.log("[FBMP] startRun config:", { query: config.query, pages: config.pages }, "allowNavigate:", options.allowNavigate);

    if (config.query) {
      await triggerMarketplaceSearch(config.query, { allowNavigate });
    }

    const compiled = compileQuery(config.query);
    matchesTitle = compiled.matchesTitle;

    // Start observing (React DOM churn).
    observer.start(document.body);

    // Immediate filter of current DOM.
    refilterAll();

    // Scroll N pages, filtering as new results arrive.
    if (config.pages > 0) {
      try {
        await autoScroll({
          pages: config.pages,
          getListingCount,
          signal: runAbort.signal,
          onAfterEach: () => {
            // After scroll, do a quick pass (observer may have queued, but this ensures no gaps).
            observer.flushNow();
            scanAndFilter(document);
          }
        });
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.warn("[FBMP] autoScroll failed:", e);
        }
      }
    }

    // After the run completes, bring the user back to the first visible results
    // so there isn't a big gap from previously hidden cards.
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // noop
    }
  }

  // If we navigated to a search URL with a pending run, resume automatically.
  try {
    if (isMarketplaceSearchPage()) {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_KEY);
        if (pending && typeof pending === "object") {
          startRun(pending, { allowNavigate: false });
        }
      }
    }
  } catch (e) {
    console.warn("[FBMP] Failed to resume pending run:", e);
  }

  console.log("[FBMP] ON LOAD pathname:", location.pathname, "search:", location.search, "isSearchPage:", isMarketplaceSearchPage(), "urlQuery:", getCurrentUrlSearchQuery(), "config.query:", config.query);

  // React SPA: detect URL changes without full reload. When user navigates to
  // non-search Marketplace (or leaves Marketplace), stop filtering and show all to avoid flicker.
  let lastKnownUrl = location.pathname + location.search;
  const URL_POLL_MS = 1000;

  function onUrlChanged() {
    if (isMarketplaceSearchPage()) return; // still on search page, keep current filter
    clearFilterAndStopObserving();
  }

  const urlCheckInterval = setInterval(() => {
    const current = location.pathname + location.search;
    if (current === lastKnownUrl) return;
    lastKnownUrl = current;
    onUrlChanged();
  }, URL_POLL_MS);

  window.addEventListener("popstate", () => {
    lastKnownUrl = location.pathname + location.search;
    onUrlChanged();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;

    if (msg.type === "FBMP_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "FBMP_START") {
      sendResponse({ ok: true });
      startRun(msg.payload, { allowNavigate: true }).catch((e) => {
        console.warn("[FBMP] start failed:", e);
      });
      return false;
    }
  });
})();

