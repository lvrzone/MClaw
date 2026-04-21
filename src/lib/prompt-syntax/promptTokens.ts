/**
 * Prompt Language Token Types
 * Defines all token types for the Prompt syntax highlighter
 *
 * Token rules:
 * 1. `#.*$` → comment.line          (line comments)
 * 2. `\$\{[^}]+\}` → variable.prompt   (${variable})
 * 3. `\{\{[^}]+\}\}` → expression.prompt  ({{expression}})
 * 4. `\{\{#if\b` → keyword.control   ({{#if ...}})
 * 5. `\{\{/if\}\}` → keyword.control   ({{/if}})
 * 6. `"([^"\\]|\\.)*"` → string.quoted (quoted strings)
 */

/** Token scope names (TextMate-style) */
export const TokenTypes = {
  COMMENT: 'comment.line',
  VARIABLE: 'variable.prompt',
  EXPRESSION: 'expression.prompt',
  KEYWORD: 'keyword.control',
  STRING: 'string.quoted',
  FUNCTION: 'support.function',
  /** Plain text that doesn't match any rule */
  TEXT: 'text',
} as const;

export type TokenType = (typeof TokenTypes)[keyof typeof TokenTypes];
