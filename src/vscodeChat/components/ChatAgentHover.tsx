/**
 * ChatAgentHover - Agent 信息悬浮卡片
 * 对齐 VS Code chatAgentHover.ts (138行)
 *
 * 显示：Agent 图标、名称、发布者、描述、命令列表
 */
import { useState, useRef, useEffect } from 'react';
import { Bot, ChevronDown, ChevronUp, Terminal, Info } from 'lucide-react';

// ============ Types ============
export interface ChatAgentInfo {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  publisher?: string;
  isVerified?: boolean;
  commands?: Array<{ id: string; label: string; description?: string }>;
}

export interface ChatAgentHoverProps {
  agent: ChatAgentInfo;
  anchor: HTMLElement | null;
  onClose: () => void;
  onCommandClick?: (commandId: string) => void;
}

// ============ Sub-components ============
function AgentAvatar({ agent }: { agent: ChatAgentInfo }) {
  return (
    <div className="vscode-chat-hover-avatar">
      {agent.icon
        ? <img src={agent.icon} alt={agent.name} className="vscode-chat-hover-avatar-img" />
        : <Bot size={20} />
      }
    </div>
  );
}

function AgentCommands({ agent, onCommandClick }: { agent: ChatAgentInfo; onCommandClick?: (id: string) => void }) {
  if (!agent.commands?.length) return null;
  return (
    <div className="vscode-chat-hover-commands">
      <div className="vscode-chat-hover-section-label">
        <Terminal size={11} /> Commands
      </div>
      {agent.commands.map((cmd) => (
        <button
          key={cmd.id}
          className="vscode-chat-hover-command"
          onClick={() => onCommandClick?.(cmd.id)}
        >
          <span className="vscode-chat-hover-command-label">/{cmd.label}</span>
          {cmd.description && (
            <span className="vscode-chat-hover-command-desc">{cmd.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============ Main Component ============
export function ChatAgentHover({ agent, anchor, onClose, onCommandClick }: ChatAgentHoverProps) {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const hoverRef = useRef<HTMLDivElement>(null);

  // 计算悬浮位置
  useEffect(() => {
    if (!anchor || !hoverRef.current) return;
    const rect = anchor.getBoundingClientRect();
    const hover = hoverRef.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    let top = rect.bottom + 8;
    let left = rect.left;

    // 底部超出 → 改到上方
    if (top + hover.height > viewport.height) {
      top = rect.top - hover.height - 8;
    }
    // 右侧超出 → 左对齐调整
    if (left + hover.width > viewport.width) {
      left = viewport.width - hover.width - 8;
    }
    // 左侧边界
    if (left < 8) left = 8;

    setPosition({ top, left });
  }, [anchor]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hoverRef.current && !hoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={hoverRef}
      className="vscode-chat-agent-hover"
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      {/* Header */}
      <div className="vscode-chat-hover-header">
        <AgentAvatar agent={agent} />
        <div className="vscode-chat-hover-info">
          <div className="vscode-chat-hover-name-row">
            <span className="vscode-chat-hover-name">{agent.name}</span>
            {agent.isVerified && (
              <span className="vscode-chat-hover-verified" title="Verified Publisher">✓</span>
            )}
          </div>
          {agent.publisher && (
            <span className="vscode-chat-hover-publisher">{agent.publisher}</span>
          )}
        </div>
        <button className="vscode-chat-hover-close" onClick={onClose}>×</button>
      </div>

      {/* Description */}
      {agent.description && (
        <div className="vscode-chat-hover-description">
          <Info size={11} className="vscode-chat-hover-desc-icon" />
          <span>{agent.description}</span>
        </div>
      )}

      {/* Commands (expandable) */}
      <AgentCommands agent={agent} onCommandClick={onCommandClick} />

      {/* Expand toggle */}
      {agent.commands && agent.commands.length > 0 && (
        <button
          className="vscode-chat-hover-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Less' : `${agent.commands!.length} command${agent.commands!.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

export default ChatAgentHover;
