/**
 * ToolUsePart - 工具调用展示
 * 对齐 VS Code tools/ 模块
 */
import {  useState  } from 'react';
import type { ToolUsePartData } from './ContentPart';
import { Wrench, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Props extends ToolUsePartData {}

export function ToolUsePart({ toolName, input, status = 'running', isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle size={12} className="vscode-chat-tool-status-done" />;
      case 'error': return <XCircle size={12} className="vscode-chat-tool-status-error" />;
      default: return <Loader2 size={12} className="vscode-chat-tool-status-running vscode-spin" />;
    }
  };

  const statusText = () => {
    switch (status) {
      case 'completed': return 'Done';
      case 'error': return 'Error';
      default: return 'Running';
    }
  };

  return (
    <div className="vscode-chat-tool-use-part" data-status={status}>
      <div className="vscode-chat-tool-use-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-tool-use-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <Wrench size={13} className="vscode-chat-tool-use-icon" />
        <span className="vscode-chat-tool-use-name">{toolName}</span>
        <span className="vscode-chat-tool-use-status">{statusIcon()}{statusText()}</span>
      </div>
      {expanded && (
        <div className="vscode-chat-tool-use-body">
          <div className="vscode-chat-tool-use-params">
            <div className="vscode-chat-tool-use-params-label">Parameters</div>
            <pre className="vscode-chat-tool-use-params-pre">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        </div>
      )}
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
