/**
 * MarkdownPart - Markdown 内容块
 * 对齐 VS Code chatMarkdownContentPart.ts (773行)
 *
 * 使用高级 MarkdownRenderer（shiki 语法高亮 + react-markdown + remark-gfm）
 */
import type { MarkdownPartData } from './ContentPart';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface Props extends MarkdownPartData {}

export function MarkdownPart({ content, isStreaming }: Props) {
  return (
    <div className="vscode-chat-markdown-part">
      <MarkdownRenderer content={content} />
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
