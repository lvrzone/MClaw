/**
 * ChatResponseList - 聊天响应列表组件
 * 移植自 VS Code Chat chatResponseList
 */
import { useRef, useEffect, useCallback } from 'react';
import { ChatMessageItem, ChatMessageProps } from './ChatMessageItem';

// 消息列表Props
interface ChatResponseListProps {
  messages: ChatMessageProps['message'][];
  isStreaming?: boolean;
  onScrollToBottom?: () => void;
  className?: string;
}

export function ChatResponseList({
  messages,
  isStreaming = false,
  onScrollToBottom,
  className = '',
}: ChatResponseListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  
  // 检测是否在底部
  const checkIfAtBottom = useCallback(() => {
    if (!listRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);
  
  // 滚动到底部
  const scrollToBottom = useCallback((force = false) => {
    if (!listRef.current) return;
    
    const shouldScroll = force || isAtBottomRef.current || isStreaming;
    if (!shouldScroll) return;
    
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, [isStreaming]);
  
  // 监听滚动
  const handleScroll = useCallback(() => {
    isAtBottomRef.current = checkIfAtBottom();
    if (isAtBottomRef.current && onScrollToBottom) {
      onScrollToBottom();
    }
  }, [checkIfAtBottom, onScrollToBottom]);
  
  // 消息变化时自动滚动
  useEffect(() => {
    scrollToBottom(messages.length === 1);
  }, [messages, scrollToBottom]);
  
  // 流式输出时持续滚动
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        scrollToBottom(true);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming, scrollToBottom]);
  
  // 渲染消息
  const renderMessages = () => {
    return messages.map((message, index) => {
      const isLast = index === messages.length - 1;
      const messageId = message.id || `msg-${index}`;
      
      return (
        <ChatMessageItem
          key={messageId}
          message={message}
          isStreaming={isLast && isStreaming && message.role === 'assistant'}
        />
      );
    });
  };
  
  // 空状态
  const renderEmptyState = () => (
    <div className="vscode-chat-empty-state">
      <div className="vscode-chat-empty-icon">💬</div>
      <div className="vscode-chat-empty-title">开始新对话</div>
      <div className="vscode-chat-empty-subtitle">
        输入消息开始聊天，或使用 <code>/</code> 查看可用命令
      </div>
    </div>
  );
  
  return (
    <div 
      ref={listRef}
      className={`vscode-chat-response-list ${className}`}
      onScroll={handleScroll}
    >
      {messages.length === 0 ? renderEmptyState() : renderMessages()}
    </div>
  );
}

export default ChatResponseList;
