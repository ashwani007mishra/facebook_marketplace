import { TokenType } from "./tokenizer.js";

/**
 * AST node shapes:
 * - { type: 'TERM', value: string }
 * - { type: 'PHRASE', value: string }
 * - { type: 'NOT', expr: Node }
 * - { type: 'AND', left: Node, right: Node }
 * - { type: 'OR', left: Node, right: Node }
 *
 * Parentheses are supported for future scalability.
 */

/**
 * @typedef {any} Node
 */

function startsUnary(token) {
  if (!token) return false;
  return (
    token.type === TokenType.TERM ||
    token.type === TokenType.PHRASE ||
    token.type === TokenType.NOT ||
    token.type === TokenType.LPAREN
  );
}

class Parser {
  /**
   * @param {import('./tokenizer.js').Token[]} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek() {
    return this.tokens[this.i] ?? null;
  }

  consume() {
    const t = this.tokens[this.i] ?? null;
    this.i++;
    return t;
  }

  match(type) {
    const t = this.peek();
    if (t?.type === type) {
      this.i++;
      return true;
    }
    return false;
  }

  expect(type, message) {
    const t = this.peek();
    if (!t || t.type !== type) {
      const at = t?.pos ?? "end";
      throw new Error(message ?? `Expected ${type} at ${at}`);
    }
    this.i++;
    return t;
  }

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let node = this.parseAnd();
    while (this.match(TokenType.OR)) {
      const rhs = this.parseAnd();
      node = { type: "OR", left: node, right: rhs };
    }
    return node;
  }

  parseAnd() {
    let node = this.parseUnary();
    while (startsUnary(this.peek())) {
      const rhs = this.parseUnary();
      node = { type: "AND", left: node, right: rhs };
    }
    return node;
  }

  parseUnary() {
    if (this.match(TokenType.NOT)) {
      const expr = this.parseUnary();
      return { type: "NOT", expr };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of input");

    if (this.match(TokenType.TERM)) {
      return { type: "TERM", value: t.value ?? "" };
    }

    if (this.match(TokenType.PHRASE)) {
      return { type: "PHRASE", value: t.value ?? "" };
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, `Expected ')' to match '(' at ${t.pos}`);
      return expr;
    }

    throw new Error(`Unexpected token '${t.type}' at ${t.pos}`);
  }
}

/**
 * @param {import('./tokenizer.js').Token[]} tokens
 * @returns {Node|null}
 */
export function parse(tokens) {
  const p = new Parser(tokens);
  if (tokens.length === 0) return null;

  const ast = p.parseExpression();
  if (p.peek()) {
    const t = p.peek();
    throw new Error(`Unexpected trailing token '${t.type}' at ${t.pos}`);
  }
  return ast;
}

