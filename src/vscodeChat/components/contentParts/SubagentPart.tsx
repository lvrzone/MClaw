/**
 * SubagentPart - 子代理会话展示
 * 对齐 VS Code chatSubagentContentPart.ts (1183行，简化版)
 */
import { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export interface SubagentToolCall {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface SubagentPartData {
  id: string;
  type: 'subagent';
  title: string;
  agentId?: string;
  tools?: SubagentToolCall[];
  isWorking?: boolean;
  workingMessage?: string;
}

interface Props extends SubagentPartData {}

const workingMessages = ['Processing', 'Preparing', 'Loading', 'Analyzing', 'Evaluating'];

export function SubagentPart({ title, agentId, tools, isWorking, workingMessage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const wm = workingMessage || workingMessages[Math.floor(Math.random() * workingMessages.length)];

  return (
    <div className="vscode-chat-subagent-part">
      <div className="vscode-chat-subagent-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-subagent-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <Bot size={13} />
        <span className="vscode-chat-subagent-title">{title || 'Subagent'}</span>
        {agentId && <span className="vscode-chat-subagent-agent">@{agentId}</span>}
        {isWorking && (
          <span className="vscode-chat-subagent-working">
            <Loader2 size={11} className="vscode-spin" />
            {wm}
          </span>
        )}
      </div>
      {expanded && tools && tools.length > 0 && (
        <div className="vscode-chat-subagent-tools">
          {tools.map((tool, i) => (
            <div key={i} className="vscode-chat-subagent-tool" data-status={tool.status}>
              <span className="vscode-chat-subagent-tool-name">{tool.name}</span>
              <span className="vscode-chat-subagent-tool-status">
                {tool.status === 'running' && <Loader2 size={10} className="vscode-spin" />}
                {tool.status === 'completed' && '✓'}
                {tool.status === 'error' && '✕'}
              </span>
              {tool.result && <pre className="vscode-chat-subagent-tool-result">{tool.result}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}