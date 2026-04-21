/**
 * HookPart - Hook 内容展示
 * 对齐 VS Code chatHookContentPart.ts (82行)
 */
import { useState } from 'react';
import { Shield, AlertTriangle, ChevronDown, ChevronRight, StopCircle } from 'lucide-react';

export type HookType = 'before_tool' | 'after_tool' | 'before_model' | 'after_model';

export interface HookPartData {
  id: string;
  type: 'hook';
  hookType: HookType;
  toolName?: string;
  isStopped?: boolean;
  systemMessage?: string;
  stopReason?: string;
}

interface Props extends HookPartData {}

function getHookTypeLabel(type: HookType): string {
  const labels: Record<HookType, string> = {
    before_tool: 'Before Tool',
    after_tool: 'After Tool',
    before_model: 'Before Model',
    after_model: 'After Model',
  };
  return labels[type] || type;
}

export function HookPart({ hookType, toolName, isStopped, systemMessage, stopReason }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isWarning = !!systemMessage;

  return (
    <div className={`vscode-chat-hook-part ${isStopped ? 'stopped' : isWarning ? 'warning' : ''}`}>
      <div className="vscode-chat-hook-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-hook-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        {isStopped
          ? <StopCircle size={13} />
          : isWarning
            ? <AlertTriangle size={13} />
            : <Shield size={13} />
        }
        <span className="vscode-chat-hook-type">{getHookTypeLabel(hookType)}</span>
        {toolName && <span className="vscode-chat-hook-tool">— {toolName}</span>}
        {isStopped && (
          <span className="vscode-chat-hook-stopped">Blocked</span>
        )}
      </div>
      {expanded && (
        <div className="vscode-chat-hook-body">
          {systemMessage && (
            <div className="vscode-chat-hook-message">{systemMessage}</div>
          )}
          {stopReason && (
            <div className="vscode-chat-hook-reason">
              <span className="vscode-chat-hook-reason-label">Reason:</span>
              <span>{stopReason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}