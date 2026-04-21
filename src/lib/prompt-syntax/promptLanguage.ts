/**
 * Prompt Language Configuration
 * Defines language features for .prompt files:
 * - Comments: line comments with #
 * - Brackets: {{ }} and ${ }
 * - Auto-closing and surrounding pairs
 */

export const PROMPT_LANGUAGE_ID = 'prompt';

export interface PromptLanguageConfig {
  comments: {
    lineComment: string;
  };
  brackets: Array<[string, string]>;
  autoClosingPairs: Array<{ open: string; close: string }>;
  surroundingPairs: Array<[string, string]>;
}

export const promptLanguageConfig: PromptLanguageConfig = {
  comments: { lineComment: '#' },
  brackets: [
    ['{{', '}}'],
    ['${', '}'],
  ],
  autoClosingPairs: [
    { open: '{{', close: '}}' },
    { open: '${', close: '}' },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    ['{{', '}}'],
    ['${', '}'],
    ['"', '"'],
  ],
};
