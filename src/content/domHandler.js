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

  // Combine all candidates so the filter sees full text (e.g. "repair" in "Water Heater Repair and Installation").
  const combined = [...new Set(candidates)].join(" ");
  const maxLen = 400;
  return combined.length <= maxLen ? combined : combined.slice(0, maxLen);
}

/**
 * Extract listing cards from a subtree.
 * All listings (including "Results from outside your search") are included so the boolean filter applies everywhere.
 *
 * @param {ParentNode} root
 * @returns {{ cardEl: HTMLElement, anchorEl: HTMLAnchorElement, id: string|null, title: string }[]}
 */
export function extractListings(root = document) {
  const anchors = root.querySelectorAll?.(
    'a[role="link"][href*="/marketplace/item/"], a[href*="/marketplace/item/"]'
  );
  if (!anchors || anchors.length === 0) return [];

  /** @type {{ cardEl: HTMLElement, anchorEl: HTMLAnchorElement, id: string|null, title: string }[]} */
  const out = [];
  const seenCard = new WeakSet();

  for (const a of anchors) {
    if (!(a instanceof HTMLAnchorElement)) continue;

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

