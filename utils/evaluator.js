import { compileWildcard } from "./wildcard.js";

function normalizeText(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function wordsFromNormalizedText(normalized) {
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

/**
 * Builds a lightweight index for a title.
 * @param {string} title
 */
export function buildTitleIndex(title) {
  const normalized = normalizeText(title);
  return {
    raw: String(title ?? ""),
    normalized,
    words: wordsFromNormalizedText(normalized)
  };
}

function createTermMatcher(rawTerm) {
  const term = String(rawTerm ?? "").toLowerCase();
  if (term.includes("*")) {
    const match = compileWildcard(term);
    return (idx) => idx.words.some((w) => match(w));
  }
  return (idx) => idx.words.includes(term);
}

function createPhraseMatcher(rawPhrase) {
  const phrase = normalizeText(rawPhrase);
  if (!phrase) return () => true;
  return (idx) => idx.normalized.includes(phrase);
}

/**
 * @param {any} ast
 * @returns {(title: string) => boolean}
 */
export function createEvaluator(ast) {
  if (!ast) return () => true;

  // Compile the AST into nested matcher functions once (performance).
  const compile = (node) => {
    if (!node) return () => true;

    switch (node.type) {
      case "AND": {
        const a = compile(node.left);
        const b = compile(node.right);
        return (idx) => a(idx) && b(idx);
      }
      case "OR": {
        const a = compile(node.left);
        const b = compile(node.right);
        return (idx) => a(idx) || b(idx);
      }
      case "NOT": {
        const inner = compile(node.expr);
        return (idx) => !inner(idx);
      }
      case "TERM": {
        const matchTerm = createTermMatcher(node.value);
        return (idx) => matchTerm(idx);
      }
      case "PHRASE": {
        const matchPhrase = createPhraseMatcher(node.value);
        return (idx) => matchPhrase(idx);
      }
      default:
        // Unknown node types are treated as non-matching (safe).
        return () => false;
    }
  };

  const match = compile(ast);

  return (title) => {
    const idx = buildTitleIndex(title);
    if (!idx.normalized) return false; // empty titles never match non-empty queries
    return match(idx);
  };
}

/**
 * Utility for strict-mode word equality (multiset equality).
 * @param {string} title
 * @returns {string[]}
 */
export function normalizedTitleWords(title) {
  return buildTitleIndex(title).words;
}

