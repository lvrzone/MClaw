/**
 * ChatResponseList - 聊天响应列表（增强版，支持虚拟滚动）
 * 对齐 VS Code chatListWidget.ts + chatListRenderer.ts
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { ChatMessageItem, ChatMessageProps } from './ChatMessageItem';

const ITEM_HEIGHT_ESTIMATE = 120; // 估算消息高度
const OVERSCAN = 5;               // 上下各渲染额外 N 条

interface ChatResponseListProps {
  messages: ChatMessageProps['message'][];
  isStreaming?: boolean;
  onScrollToBottom?: () => void;
  className?: string;
  useVirtualScroll?: boolean; // 大量消息时开启
  showThinking?: boolean;
}

export function ChatResponseList({
  messages,
  isStreaming = false,
  onScrollToBottom,
  className = '',
  useVirtualScroll = false,
  showThinking = false,
}: ChatResponseListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [scrollTop, setScrollTop] = useState(0);

  // ========== 虚拟滚动相关 ==========
  const totalHeight = messages.length * ITEM_HEIGHT_ESTIMATE;

  const visibleRange = useMemo(() => {
    if (!useVirtualScroll) return { start: 0, end: messages.length };
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT_ESTIMATE) - OVERSCAN);
    const visibleCount = Math.ceil((listRef.current?.clientHeight ?? 600) / ITEM_HEIGHT_ESTIMATE);
    const end = Math.min(messages.length, start + visibleCount + OVERSCAN * 2);
    return { start, end };
  }, [scrollTop, messages.length, useVirtualScroll]);

  const visibleMessages = useMemo(() => {
    if (!useVirtualScroll) return messages;
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange, useVirtualScroll]);

  const offsetY = visibleRange.start * ITEM_HEIGHT_ESTIMATE;

  // ========== 滚动检测 ==========
  const checkIfAtBottom = useCallback(() => {
    if (!listRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

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

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
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
    if (!isStreaming) return;
    const interval = setInterval(() => scrollToBottom(true), 100);
    return () => clearInterval(interval);
  }, [isStreaming, scrollToBottom]);

  // ========== 渲染 ==========
  const renderMessages = () => {
    return (useVirtualScroll ? visibleMessages : messages).map((message, index) => {
      const rawIndex = useVirtualScroll ? visibleRange.start + index : index;
      const isLast = rawIndex === messages.length - 1;
      const messageId = message.id || `msg-${rawIndex}`;
      return (
        <ChatMessageItem
          key={messageId}
          message={message}
          isStreaming={isLast && isStreaming && message.role === 'assistant'}
          showThinking={showThinking}
        />
      );
    });
  };

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
      {messages.length === 0 ? (
        renderEmptyState()
      ) : useVirtualScroll ? (
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              transform: `translateY(0)`,
            }}
          >
            {renderMessages()}
          </div>
        </div>
      ) : (
        renderMessages()
      )}
    </div>
  );
}

export default ChatResponseList;
