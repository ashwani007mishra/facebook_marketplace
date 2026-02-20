import { useState, useEffect } from "react";

const STORAGE_KEYS = {
  query: "fbmp_query",
  pages: "fbmp_pages",
  recentSearches: "fbmp_recent_searches",
};
const MAX_RECENT_SEARCHES = 10;

function parsePages(value) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(50, n));
}

function isMarketplaceUrl(url) {
  try {
    const u = new URL(String(url ?? ""));
    if (u.protocol !== "https:") return false;
    if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return false;
    return u.pathname.startsWith("/marketplace");
  } catch {
    return false;
  }
}

const MARKETPLACE_URL = "https://www.facebook.com/marketplace/";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] ?? null;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [import.meta.env.VITE_CONTENT_SCRIPT || "content/content.js"],
  });
}

async function sendStartMessage(payload) {
  const tab = await getActiveTab();
  const tabId = tab?.id ?? null;
  if (!tabId) throw new Error("No active tab found.");
  if (!isMarketplaceUrl(tab?.url)) {
    throw new Error("Not on a Facebook Marketplace tab.");
  }

  const attemptSend = () =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "FBMP_START", payload }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(response);
      });
    });

  try {
    return await attemptSend();
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/receiving end does not exist|could not establish connection/i.test(msg)) {
      await ensureContentScript(tabId);
      return await attemptSend();
    }
    throw e;
  }
}

function updateRecentSearches(newQuery) {
  const q = String(newQuery ?? "").trim();
  if (!q) return;
  chrome.storage.local.get({ [STORAGE_KEYS.recentSearches]: [] }, (data) => {
    let list = Array.isArray(data[STORAGE_KEYS.recentSearches]) ? data[STORAGE_KEYS.recentSearches] : [];
    list = [q, ...list.filter((s) => s !== q)].slice(0, MAX_RECENT_SEARCHES);
    chrome.storage.local.set({ [STORAGE_KEYS.recentSearches]: list });
  });
}

export default function App() {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState(10);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isOnMarketplace, setIsOnMarketplace] = useState(false);
  const [tabCheckDone, setTabCheckDone] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    (async () => {
      const data = await chrome.storage.local.get({
        [STORAGE_KEYS.query]: "",
        [STORAGE_KEYS.pages]: 10,
        [STORAGE_KEYS.recentSearches]: [],
      });
      setQuery(String(data[STORAGE_KEYS.query] ?? ""));
      setPages(Number(data[STORAGE_KEYS.pages]) ?? 10);
      setRecentSearches(Array.isArray(data[STORAGE_KEYS.recentSearches]) ? data[STORAGE_KEYS.recentSearches] : []);
      setLoaded(true);

      const tab = await getActiveTab();
      setIsOnMarketplace(isMarketplaceUrl(tab?.url));
      setTabCheckDone(true);
    })();
  }, []);

  useEffect(() => {
    const listener = (changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEYS.recentSearches]) return;
      const next = changes[STORAGE_KEYS.recentSearches].newValue;
      setRecentSearches(Array.isArray(next) ? next : []);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleOpenMarketplace = () => {
    chrome.tabs.create({ url: MARKETPLACE_URL });
  };

  const runSearch = async (queryValue, pagesValue) => {
    const queryTrimmed = String(queryValue ?? query).trim();
    const pagesNum = Number.isFinite(pagesValue) ? pagesValue : parsePages(String(pages));
    setStatus("Starting…");
    await chrome.storage.local.set({
      [STORAGE_KEYS.query]: queryTrimmed,
      [STORAGE_KEYS.pages]: pagesNum,
    });
    try {
      const resp = await sendStartMessage({ query: queryTrimmed, pages: pagesNum });
      if (queryTrimmed) updateRecentSearches(queryTrimmed);
      setStatus(resp?.ok ? "Running. Check the page." : "Sent. Check the page.");
    } catch (e) {
      const msg = String(e?.message ?? e);
      setStatus(
        "Could not reach the Marketplace page. " +
          "Open a Facebook Marketplace search tab and try again. " +
          `(Details: ${msg})`
      );
      console.warn("Popup message failed:", e);
    }
  };

  const handleStart = async () => {
    await runSearch(query, pages);
  };

  const handleRecentClick = (searchText) => {
    const q = String(searchText ?? "").trim();
    if (!q) return;
    setQuery(q);
    runSearch(q, pages);
  };

  if (!loaded || !tabCheckDone) {
    return (
      <main className="container">
        <div className="prompt-message">Checking…</div>
      </main>
    );
  }

  if (!isOnMarketplace) {
    return (
      <main className="container">
        <header className="header">
          <div className="title">Marketplace Filter</div>
          <div className="subtitle">Boolean search + auto-scroll</div>
        </header>
        <div className="prompt">
          <p className="prompt-message">
            Open Facebook Marketplace to use the filter.
          </p>
          <p className="prompt-subtext">
            You can search and filter listings once you’re there.
          </p>
          <button className="button" type="button" onClick={handleOpenMarketplace}>
            Open Marketplace
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <div className="title">Marketplace Filter</div>
        <div className="subtitle">Boolean search + auto-scroll</div>
      </header>

      <section className="section">
        <label className="label" htmlFor="query">
          Boolean Search
        </label>
        <textarea
          id="query"
          className="textarea"
          rows={3}
          placeholder='e.g. "restoration hardware"|crate sofa -velvet'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="hint">
          Spaces = AND, <code>|</code> = OR, <code>-</code> = NOT, quotes for phrase,{" "}
          <code>*</code> for wildcard.
        </div>
      </section>

      <section className="section row">
        <div className="col">
          <label className="label" htmlFor="pages">
            Auto-scroll pages
          </label>
          <input
            id="pages"
            className="input"
            type="number"
            min={0}
            max={50}
            step={1}
            value={pages}
            onChange={(e) => {
              const v = e.target.value;
              setPages(v === "" ? 0 : parsePages(v));
            }}
          />
          <div className="hint">0 = just filter current results.</div>
        </div>
      </section>

      {recentSearches.length > 0 && (
        <section className="section">
          <div className="label">Recent searches</div>
          <div className="tag-list">
            {recentSearches.map((text) => (
              <button
                key={text}
                type="button"
                className="tag"
                onClick={() => handleRecentClick(text)}
              >
                {text}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <button className="button" type="button" onClick={handleStart}>
          Start
        </button>
        <div className="status" aria-live="polite">
          {status}
        </div>
      </section>
    </main>
  );
}
