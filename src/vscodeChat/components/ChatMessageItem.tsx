/**
 * ChatMessageItem - 渲染单条聊天消息
 * 移植自 VS Code Chat
 */
import { useMemo } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCall } from './ToolCall';

// 消息类型
export interface ChatMessageProps {
  message: {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{
      type: string;
      text?: string;
      name?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    }>;
    timestamp?: number;
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  };
  isStreaming?: boolean;
}

// 格式化时间戳
function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 渲染文本内容
function renderTextContent(content: string): React.ReactNode {
  if (!content) return null;
  
  // 检查是否包含代码块
  if (content.includes('```')) {
    return <MarkdownRenderer content={content} />;
  }
  
  // 简单文本处理
  return (
    <div className="vscode-chat-text">
      {content.split('\n').map((line, i) => {
        // 处理行内代码
        if (line.includes('`')) {
          const parts = line.split(/(`[^`]+`)/g);
          return (
            <p key={i}>
              {parts.map((part, j) => {
                if (part.startsWith('`') && part.endsWith('`')) {
                  return <code key={j} className="vscode-inline-code">{part.slice(1, -1)}</code>;
                }
                return part;
              })}
            </p>
          );
        }
        return <p key={i}>{line || '\u00A0'}</p>;
      })}
    </div>
  );
}

// 渲染工具调用
function renderToolCalls(message: ChatMessageProps['message']): React.ReactNode {
  const toolCalls = message.tool_calls || [];
  if (!toolCalls.length) return null;
  
  return (
    <div className="vscode-chat-tool-calls">
      {toolCalls.map((toolCall) => (
        <ToolCall
          key={toolCall.id}
          toolCall={toolCall}
        />
      ))}
    </div>
  );
}

// ChatMessageItem 组件
export function ChatMessageItem({ 
  message, 
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  
  // 解析内容
  const renderedContent = useMemo(() => {
    if (!message.content) return null;
    
    // 如果是数组格式 (带有 tool_calls 等)
    if (Array.isArray(message.content)) {
      return message.content.map((block, idx) => {
        if (block.type === 'text' && block.text) {
          return (
            <div key={idx} className="vscode-chat-content-block">
              {renderTextContent(block.text)}
            </div>
          );
        }
        if (block.type === 'tool_use' && block.name) {
          return (
            <div key={idx} className="vscode-chat-tool-use">
              <span className="vscode-chat-tool-name">{block.name}</span>
            </div>
          );
        }
        return null;
      });
    }
    
    // 如果是字符串
    return renderTextContent(message.content as string);
  }, [message.content]);
  
  // 流式输出时的光标
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
            <span className="vscode-chat-timestamp">
              {formatTime(message.timestamp)}
            </span>
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
          {renderToolCalls(message)}
          {streamingCursor}
        </div>
        
        {/* 工具调用 ID */}
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
