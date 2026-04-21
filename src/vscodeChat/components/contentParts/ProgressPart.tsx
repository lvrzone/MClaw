/**
 * ProgressPart - 进度条展示
 * 对齐 VS Code chatProgressContentPart.ts (282行)
 */
import type { ProgressPartData } from './ContentPart';

interface Props extends ProgressPartData {}

export function ProgressPart({ title, content, percent, isStreaming }: Props) {
  const isDeterminate = percent !== undefined;
  const displayPercent = percent ?? 0;

  return (
    <div className="vscode-chat-progress-part">
      {(title || content) && (
        <div className="vscode-chat-progress-info">
          {title && <span className="vscode-chat-progress-title">{title}</span>}
          {content && <span className="vscode-chat-progress-content">{content}</span>}
          {isDeterminate && <span className="vscode-chat-progress-percent">{displayPercent}%</span>}
        </div>
      )}
      <div className="vscode-chat-progress-bar-container">
        <div
          className={`vscode-chat-progress-bar ${isDeterminate ? 'determinate' : 'indeterminate'}`}
          style={isDeterminate ? { width: `${displayPercent}%` } : undefined}
        >
          {!isDeterminate && <div className="vscode-chat-progress-indeterminate-bar" />}
        </div>
      </div>
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
