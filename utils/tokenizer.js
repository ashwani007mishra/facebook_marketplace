/**
 * Tokenizer for the supported Boolean syntax:
 * - Spaces: implicit AND
 * - Quotes: phrase
 * - | : OR
 * - - : NOT (prefix operator)
 * - ( ) : grouping (supported for scalability)
 *
 * We intentionally do not emit an AND token; AND is implicit in the parser.
 */

export const TokenType = Object.freeze({
  TERM: "TERM",
  PHRASE: "PHRASE",
  OR: "OR",
  NOT: "NOT",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN"
});

/**
 * @typedef {{type: string, value?: string, pos: number}} Token
 */

/**
 * @param {string} input
 * @returns {Token[]}
 */
export function tokenize(input) {
  const s = String(input ?? "");
  /** @type {Token[]} */
  const tokens = [];

  let i = 0;
  const len = s.length;

  const isWs = (ch) => ch === " " || ch === "\n" || ch === "\t" || ch === "\r";

  while (i < len) {
    const ch = s[i];

    if (isWs(ch)) {
      i++;
      continue;
    }

    if (ch === "|") {
      tokens.push({ type: TokenType.OR, pos: i });
      i++;
      continue;
    }

    if (ch === "-") {
      // NOT is only meaningful as a prefix operator.
      tokens.push({ type: TokenType.NOT, pos: i });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: TokenType.LPAREN, pos: i });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: TokenType.RPAREN, pos: i });
      i++;
      continue;
    }

    if (ch === '"') {
      const start = i;
      i++; // consume opening quote
      let phrase = "";
      let closed = false;

      while (i < len) {
        const c = s[i];
        if (c === "\\") {
          // basic escaping: \" and \\ inside phrases
          const next = s[i + 1];
          if (next === '"' || next === "\\") {
            phrase += next;
            i += 2;
            continue;
          }
          // keep unknown escapes as-is
          phrase += c;
          i++;
          continue;
        }
        if (c === '"') {
          closed = true;
          i++; // consume closing quote
          break;
        }
        phrase += c;
        i++;
      }

      if (!closed) {
        throw new Error(`Unterminated quote at position ${start}`);
      }

      const normalized = phrase.trim().replace(/\s+/g, " ");
      if (normalized.length > 0) {
        tokens.push({ type: TokenType.PHRASE, value: normalized, pos: start });
      }
      continue;
    }

    // TERM: read until whitespace or operator chars.
    const start = i;
    let term = "";
    while (i < len) {
      const c = s[i];
      if (isWs(c) || c === "|" || c === "(" || c === ")") break;
      // '-' is treated as NOT only at token start; inside a token it's literal (e.g. "mid-century")
      if (c === "-" && term.length === 0) break;
      term += c;
      i++;
    }

    if (term.length > 0) {
      tokens.push({ type: TokenType.TERM, value: term, pos: start });
      continue;
    }

    // If we reached here, it's a leading '-' (NOT) that we didn't consume in the TERM loop.
    if (s[i] === "-") continue;

    // Safety to avoid infinite loops.
    i++;
  }

  return tokens;
}

