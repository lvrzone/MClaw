/**
 * ToolResultPart - 工具调用结果展示
 */
import type { ToolResultPartData } from './ContentPart';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Props extends ToolResultPartData {}

export function ToolResultPart({ toolName, content, isError, isStreaming }: Props) {
  return (
    <div className={`vscode-chat-tool-result-part ${isError ? 'error' : ''}`}>
      <div className="vscode-chat-tool-result-header">
        {isError
          ? <XCircle size={12} className="vscode-chat-tool-result-icon-error" />
          : <CheckCircle2 size={12} className="vscode-chat-tool-result-icon" />
        }
        <span className="vscode-chat-tool-result-label">
          {isError ? 'Error' : 'Result'}{toolName && ` — ${toolName}`}
        </span>
      </div>
      <div className="vscode-chat-tool-result-body">
        <pre className="vscode-chat-tool-result-pre">{content}</pre>
      </div>
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
