/**
 * ChatMessageItem - 单条聊天消息（Content Parts 驱动版）
 * 对齐 VS Code Chat chatListRenderer.ts
 * 数据流：RawMessage → normalizeContentBlocks() → parseNormalizedBlocks() → renderParts()
 */
import { useMemo } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import { renderParts } from './contentParts/PartRegistry';
import { parseMessageToParts, parseContentToParts } from '../services/contentPartParser';
import type { RawMessage } from '@/stores/chat/types';

// ============ Props ============
export interface ChatMessageProps {
  message: {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string | unknown[];
    timestamp?: number;
    tool_call_id?: string;
  };
  isStreaming?: boolean;
  showThinking?: boolean;
}

// ============ 工具函数 ============
function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============ 用户消息渲染 ============
function renderUserContent(content: string | unknown[]): React.ReactNode {
  if (typeof content === 'string') {
    return (
      <div className="vscode-chat-markdown-text">
        {content.split('\n').map((line, i) => (
          <p key={i}>{line || '\u00A0'}</p>
        ))}
      </div>
    );
  }
  const parts = parseContentToParts(content as unknown[]);
  if (!parts.length) return null;
  return renderParts(parts);
}

// ============ 助手消息渲染 ============
function renderAssistantContent(
  message: ChatMessageProps['message'],
  isStreaming: boolean,
): React.ReactNode {
  const { content } = message;

  const rawMessage: RawMessage = {
    role: message.role,
    content: content as RawMessage['content'],
    timestamp: message.timestamp,
    id: message.id,
    toolCallId: message.tool_call_id,
  };

  const parts = parseMessageToParts(rawMessage, { isStreaming });

  if (!parts.length && typeof content === 'string' && content) {
    return renderParts(parseContentToParts([{ type: 'markdown', content }] as unknown[], { isStreaming }));
  }

  return parts.length > 0 ? renderParts(parts) : null;
}

// ============ 组件 ============
export function ChatMessageItem({
  message,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const renderedContent = useMemo(() => {
    if (isUser) return renderUserContent(message.content);
    return renderAssistantContent(message, isStreaming);
  }, [message.content, isUser, isStreaming]);

  const streamingCursor = isStreaming ? (
    <span className="vscode-chat-streaming-cursor">▊</span>
  ) : null;

  return (
    <div className={`vscode-chat-message ${message.role} ${isStreaming ? 'streaming' : ''}`}>
      {/* 头像 */}
      <div className="vscode-chat-avatar">
        {isUser ? (
          <User size={16} />
        ) : isAssistant ? (
          <Bot size={16} />
        ) : (
          <span className="vscode-chat-system-icon">S</span>
        )}
      </div>

      {/* 消息内容 */}
      <div className="vscode-chat-message-content">
        {/* 元信息 */}
        <div className="vscode-chat-message-meta">
          <span className="vscode-chat-sender-name">
            {isUser ? 'You' : isAssistant ? 'Assistant' : 'System'}
          </span>
          {message.timestamp && (
            <span className="vscode-chat-timestamp">{formatTime(message.timestamp)}</span>
          )}
          {isStreaming && (
            <span className="vscode-chat-streaming-indicator">
              <Loader2 size={12} className="vscode-spin" />
              <span>Generating...</span>
            </span>
          )}
        </div>

        {/* 主要内容 */}
        <div className="vscode-chat-message-body">
          {renderedContent}
          {streamingCursor}
        </div>

        {message.tool_call_id && (
          <div className="vscode-chat-tool-call-id">
            <span className="vscode-chat-label">tool_call_id:</span>
            <code>{message.tool_call_id}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessageItem;
