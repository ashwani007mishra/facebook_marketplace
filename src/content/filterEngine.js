import { tokenize, TokenType } from "../../utils/tokenizer.js";
import { parse } from "../../utils/parser.js";
import { createEvaluator } from "../../utils/evaluator.js";

function normalizeLikeTitle(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function toWords(input) {
  const n = normalizeLikeTitle(input);
  return n ? n.split(" ").filter(Boolean) : [];
}

function isSimpleStrictQuery(tokens) {
  // Strict-mode only for simple "space-separated AND words" queries:
  // - only TERM tokens
  // - no wildcards
  // - no operators/parentheses/phrases
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    if (t.type !== TokenType.TERM) return false;
    if (String(t.value ?? "").includes("*")) return false;
  }
  return true;
}

/**
 * Compiles a query into a fast matcher.
 * - Empty/whitespace query => match everything.
 * - Parse errors => match everything (fail-open to avoid hiding user content unexpectedly).
 *
 * @param {string} query
 * @returns {{ matchesTitle: (title: string) => boolean, meta: { strictMode: boolean } }}
 */
export function compileQuery(query) {
  const raw = String(query ?? "").trim();
  if (!raw) return { matchesTitle: () => true, meta: { strictMode: false } };

  let tokens;
  try {
    tokens = tokenize(raw);
  } catch (e) {
    console.warn("[FBMP] Query tokenization failed; leaving results unfiltered.", e);
    return { matchesTitle: () => true, meta: { strictMode: false } };
  }

  const strictMode = isSimpleStrictQuery(tokens);

  let ast;
  try {
    ast = parse(tokens);
  } catch (e) {
    console.warn("[FBMP] Query parse failed; leaving results unfiltered.", e);
    return { matchesTitle: () => true, meta: { strictMode: false } };
  }

  const evalBoolean = createEvaluator(ast);

  // For now we treat strict/simple and complex queries the same: the matcher
  // enforces Boolean semantics (spaces = AND, | = OR, - = NOT, quotes, etc.).
  // A simple query like "restoration hardware sofa" will match any title that
  // contains all three words, in any order, case-insensitive, but can have
  // additional words as well.
  return { matchesTitle: (title) => evalBoolean(title), meta: { strictMode } };
}

