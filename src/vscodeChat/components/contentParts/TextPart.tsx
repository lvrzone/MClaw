/**
 * TextPart - 纯文本内容块
 */
import type { TextPartData } from './ContentPart';

interface Props extends TextPartData {}

export function TextPart({ text, isStreaming }: Props) {
  return (
    <div className="vscode-chat-text-part">
      <p className="vscode-chat-text-content">
        {text}
        {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
      </p>
    </div>
  );
}
