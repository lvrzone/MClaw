/**
 * Prompt Syntax Tokenizer
 * Converts prompt text into an array of typed tokens for syntax highlighting.
 *
 * Token matching order (longest-first to avoid partial matches):
 * 1. Control keywords: {{#if ...}}, {{/if}}
 * 2. Variables: ${variable}
 * 3. Expressions: {{expression}}
 * 4. Quoted strings: "..."
 * 5. Comments: # to end of line
 */

import { TokenTypes, type TokenType } from './promptTokens';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

type TokenRule = {
  type: TokenType;
  pattern: RegExp;
};

/** Token rules ordered by match priority (control flow first) */
const TOKEN_RULES: TokenRule[] = [
  // Control keywords: {{#if ...}}, {{/if}}
  {
    type: TokenTypes.KEYWORD,
    pattern: /\{\{#if\b[^}]*\}\}|\{\{\/if\}\}/,
  },
  // Variables: ${variable}
  {
    type: TokenTypes.VARIABLE,
    pattern: /\$\{[^}]+\}/,
  },
  // Expressions: {{...}} (but not control keywords already matched)
  {
    type: TokenTypes.EXPRESSION,
    pattern: /\{\{[^}]*\}\}/,
  },
  // Quoted strings: "..."
  {
    type: TokenTypes.STRING,
    pattern: /"(?:[^"\\]|\\.)*"/,
  },
  // Comments: # to end of line
  {
    type: TokenTypes.COMMENT,
    pattern: /#.*$/,
  },
];

/**
 * Tokenize a prompt text string into an array of typed tokens.
 *
 * @param text - The prompt text to tokenize
 * @returns Array of tokens with type, value, start and end positions
 *
 * @example
 * tokenizePrompt('# This is a comment\n${name}') // => [
 *   { type: 'comment.line', value: '# This is a comment', start: 0, end: 21 },
 *   { type: 'variable.prompt', value: '${name}', start: 22, end: 29 },
 * ]
 */
export function tokenizePrompt(text: string): Token[] {
  if (!text) return [];

  const tokens: Token[] = [];

  // Build a combined regex from all rules (alternation)
  const combinedPattern = new RegExp(
    TOKEN_RULES.map((rule) => `(${rule.pattern.source})`).join('|'),
    'g',
  );

  let match: RegExpExecArray | null;
  while ((match = combinedPattern.exec(text)) !== null) {
    const value = match[0];

    // Skip ahead if matched empty string (prevent infinite loop)
    if (value === '') {
      combinedPattern.lastIndex++;
      continue;
    }

    // Find which rule matched
    const ruleIndex = match.findIndex(
      (m, i) => i > 0 && m !== undefined,
    );
    const type = TOKEN_RULES[ruleIndex - 1]?.type ?? TokenTypes.TEXT;

    tokens.push({
      type,
      value,
      start: match.index,
      end: match.index + value.length,
    });
  }

  // If nothing matched at all, treat entire text as plain text
  if (tokens.length === 0) {
    tokens.push({
      type: TokenTypes.TEXT,
      value: text,
      start: 0,
      end: text.length,
    });
  } else {
    // Fill gaps between tokens with plain text tokens
    const filledTokens: Token[] = [];
    let lastEnd = 0;

    for (const token of tokens) {
      if (token.start > lastEnd) {
        filledTokens.push({
          type: TokenTypes.TEXT,
          value: text.slice(lastEnd, token.start),
          start: lastEnd,
          end: token.start,
        });
      }
      filledTokens.push(token);
      lastEnd = token.end;
    }

    if (lastEnd < text.length) {
      filledTokens.push({
        type: TokenTypes.TEXT,
        value: text.slice(lastEnd),
        start: lastEnd,
        end: text.length,
      });
    }

    return filledTokens;
  }

  return tokens;
}
