/**
 * Prompt Syntax Highlighter — React Component
 * Renders tokenized Prompt text with syntax highlighting.
 * Uses a layered approach: textarea underneath, highlighted preview on top.
 */

import { useMemo } from 'react';
import { tokenizePrompt, type Token } from './promptTokenizer';
import { TokenTypes } from './promptTokens';
import styles from './promptHighlight.module.css';

/** Maps token types to CSS class names */
function getTokenClassName(type: string): string {
  switch (type) {
    case TokenTypes.COMMENT:
      return styles.comment;
    case TokenTypes.VARIABLE:
      return styles.variable;
    case TokenTypes.EXPRESSION:
      return styles.expression;
    case TokenTypes.KEYWORD:
      return styles.keyword;
    case TokenTypes.STRING:
      return styles.string;
    case TokenTypes.FUNCTION:
      return styles.function;
    default:
      return styles.text;
  }
}

interface PromptHighlightProps {
  /** The prompt code text to render */
  code: string;
  /** Additional CSS class for the wrapper <code> element */
  className?: string;
}

export const PromptHighlight: React.FC<PromptHighlightProps> = ({
  code,
  className,
}) => {
  const tokens = useMemo(() => tokenizePrompt(code), [code]);

  return (
    <code className={className ? `${className} ${styles.wrapper}` : styles.wrapper}>
      {tokens.map((token, i) => (
        <span
          key={i}
          className={getTokenClassName(token.type)}
          title={token.type}
        >
          {token.value}
        </span>
      ))}
    </code>
  );
};

/** Standalone token renderer (no wrapper) */
interface TokenSpanProps {
  token: Token;
  className?: string;
}

export const TokenSpan: React.FC<TokenSpanProps> = ({ token, className }) => (
  <span className={`${getTokenClassName(token.type)} ${className ?? ''}`}>
    {token.value}
  </span>
);
