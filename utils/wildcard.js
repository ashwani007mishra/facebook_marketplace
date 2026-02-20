function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compiles a wildcard pattern into a fast matcher.
 * Supported:
 * - Trailing '*' (prefix match): rest* => startsWith("rest")
 * - Any '*' (glob match) for resilience to "multiple wildcards"
 *
 * Matching is done against a single normalized word/token.
 *
 * @param {string} rawPattern
 * @returns {(word: string) => boolean}
 */
export function compileWildcard(rawPattern) {
  const pattern = String(rawPattern ?? "").toLowerCase();
  if (pattern === "*") return () => true;
  if (!pattern.includes("*")) return (w) => w === pattern;

  // Fast path: single trailing '*'
  const firstIdx = pattern.indexOf("*");
  const lastIdx = pattern.lastIndexOf("*");
  if (firstIdx === pattern.length - 1 && firstIdx === lastIdx) {
    const prefix = pattern.slice(0, -1);
    return (w) => w.startsWith(prefix);
  }

  // Glob path: turn '*' into '.*' and anchor.
  const parts = pattern.split("*").map(escapeRegExp);
  const re = new RegExp("^" + parts.join(".*") + "$", "i");
  return (w) => re.test(w);
}

