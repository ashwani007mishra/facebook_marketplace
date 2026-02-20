/**
 * DOM extraction for Facebook Marketplace listings.
 *
 * IMPORTANT:
 * - Facebook uses dynamic class names; we avoid class-based selectors.
 * - Marketplace listing links are stable via href containing `/marketplace/item/`.
 *
 * NOTE:
 * You said you'll provide the Marketplace DOM snippet later. When you do,
 * we can tighten `findCardRoot()` and `extractTitleFromCard()` further.
 */

const ITEM_HREF_RE = /\/marketplace\/item\/(\d+)/;

function getHref(anchor) {
  try {
    return anchor.getAttribute("href") || "";
  } catch {
    return "";
  }
}

function extractIdFromHref(href) {
  const m = String(href).match(ITEM_HREF_RE);
  return m?.[1] ?? null;
}

function hasSingleItemLink(el) {
  // Helps pick a per-card container rather than a big list container.
  const links = el.querySelectorAll?.('a[href*="/marketplace/item/"]');
  return (links?.length ?? 0) === 1;
}

function findCardRoot(anchor) {
  // Prefer a small ancestor that contains exactly one marketplace item link.
  let el = anchor;
  let best = null;

  for (let depth = 0; depth < 12 && el; depth++) {
    if (el instanceof HTMLElement) {
      const textLen = (el.innerText || "").trim().length;
      const hasImg = !!el.querySelector?.("img");

      if (hasImg && textLen > 0 && textLen < 500) {
        best = best ?? el;
        if (hasSingleItemLink(el)) return el;
      }
    }
    el = el.parentElement;
  }

  return best ?? anchor;
}

function normalizeText(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function looksLikePrice(text) {
  const t = text.trim();
  if (!t) return false;
  return (
    /^(?:₹|\$|€|£)\s?\d/.test(t) ||
    /^\d{1,3}(?:[,\.\s]\d{3})*(?:\.\d+)?\s?(?:₹|\$|€|£)\b/.test(t) ||
    /^(?:free|$0)\b/i.test(t)
  );
}

function looksLikeMeta(text) {
  // Location/time/age strings often contain separators like "·" or "•"
  const t = text.trim();
  if (!t) return true;
  if (t.includes("·") || t.includes("•")) return true;
  if (/^\d+\s*(?:minutes?|hours?|days?|weeks?)\b/i.test(t)) return true;
  return false;
}

function scoreTitleCandidate(text) {
  const t = text.trim();
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const digits = (t.match(/\d/g) || []).length;
  const words = t.split(/\s+/).filter(Boolean).length;

  // Prefer more letters and a few words; penalize very numeric strings.
  return letters * 2 + words * 3 - digits * 2 - Math.max(0, t.length - 80);
}

function extractTitleFromCard(cardEl, anchorEl) {
  // Try the anchor text first (often contains title + maybe price/meta).
  const anchorText = normalizeText(anchorEl?.innerText || "");

  /** @type {string[]} */
  const candidates = [];
  if (anchorText && anchorText.length <= 120 && !looksLikePrice(anchorText) && !looksLikeMeta(anchorText)) {
    candidates.push(anchorText);
  }

  // Collect semantic text nodes inside the card. Limit to avoid heavy scans.
  const nodes = cardEl.querySelectorAll?.("span[dir='auto'], div[dir='auto'], span, div");
  const max = Math.min(nodes?.length ?? 0, 80);
  for (let i = 0; i < max; i++) {
    const el = nodes[i];
    const text = normalizeText(el?.innerText || "");
    if (!text) continue;
    if (text.length < 3 || text.length > 120) continue;
    if (looksLikePrice(text)) continue;
    if (looksLikeMeta(text)) continue;
    candidates.push(text);
  }

  if (candidates.length === 0) return "";

  // Pick the highest-scoring candidate.
  let best = candidates[0];
  let bestScore = scoreTitleCandidate(best);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreTitleCandidate(candidates[i]);
    if (s > bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }

  return best;
}

/** Text that marks the "Results from outside your search" section we do not filter. */
const OUTSIDE_SEARCH_LABEL = "Results from outside your search";

/**
 * Find the section root that contains "Results from outside your search".
 * We do not filter or modify listings inside this section.
 * @returns {HTMLElement|null}
 */
function getOutsideSearchSectionRoot() {
  if (!document.body) return null;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || "").trim();
    if (text.includes(OUTSIDE_SEARCH_LABEL) || text.includes("outside your search")) {
      return node instanceof HTMLElement ? node : node.parentElement;
    }
  }
  return null;
}

/**
 * Extract listing cards from a subtree.
 * Listings inside "Results from outside your search" are excluded and left untouched.
 *
 * @param {ParentNode} root
 * @returns {{ cardEl: HTMLElement, anchorEl: HTMLAnchorElement, id: string|null, title: string }[]}
 */
export function extractListings(root = document) {
  const anchors = root.querySelectorAll?.(
    'a[role="link"][href*="/marketplace/item/"], a[href*="/marketplace/item/"]'
  );
  if (!anchors || anchors.length === 0) return [];

  const outsideRoot = getOutsideSearchSectionRoot();

  /** @type {{ cardEl: HTMLElement, anchorEl: HTMLAnchorElement, id: string|null, title: string }[]} */
  const out = [];
  const seenCard = new WeakSet();

  for (const a of anchors) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    if (outsideRoot && outsideRoot.contains(a)) continue;

    const href = getHref(a);
    const id = extractIdFromHref(href);
    const cardEl = findCardRoot(a);
    if (!(cardEl instanceof HTMLElement)) continue;
    if (seenCard.has(cardEl)) continue;
    seenCard.add(cardEl);

    const title = extractTitleFromCard(cardEl, a);
    out.push({ cardEl, anchorEl: a, id, title });
  }

  return out;
}

