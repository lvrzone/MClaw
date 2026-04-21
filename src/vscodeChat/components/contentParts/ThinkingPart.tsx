/**
 * ThinkingPart - Thinking 思考过程展示（增强版）
 * 对齐 VS Code chatThinkingContentPart.ts
 * 包含：闪烁动画、连接线、可折叠、流式输出
 */
import { useState, useEffect, useRef } from 'react';
import type { ThinkingPartData } from './ContentPart';
import { ChevronRight, ChevronDown, Brain, Clock, Hash } from 'lucide-react';

interface Props extends ThinkingPartData {}

export function ThinkingPart({
  content,
  isStreaming = false,
  isCollapsed: defaultCollapsed = true,
  tokenCount,
  durationMs,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [displayedContent, setDisplayedContent] = useState('');
  const [showShimmer, setShowShimmer] = useState(false);
  const streamingRef = useRef(content);
  const prevContentRef = useRef('');

  // 流式输出：逐字显示 + 闪烁动画
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
      setShowShimmer(false);
      return;
    }

    // 开始流式输出时显示闪烁动画
    if (content && !showShimmer) {
      setShowShimmer(true);
    }

    streamingRef.current = content;

    if (displayedContent === '' || content.startsWith(prevContentRef.current)) {
      // 新内容，动画显示
      let i = prevContentRef.current.length;
      const newContent = content.slice(prevContentRef.current.length);
      const interval = setInterval(() => {
        i += 3;
        setDisplayedContent(content.slice(0, prevContentRef.current.length + i));
        if (i >= newContent.length) {
          clearInterval(interval);
          prevContentRef.current = content;
        }
      }, 20);
      return () => clearInterval(interval);
    } else {
      setDisplayedContent(content);
    }
  }, [content, isStreaming]);

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`vscode-chat-thinking ${isStreaming ? 'simmering' : ''} ${!isCollapsed ? 'expanded' : ''}`}
      data-streaming={isStreaming}
    >
      {/* 连接线 */}
      <div className="vscode-chat-thinking-connector" />

      {/* Header - 始终可见 */}
      <div
        className="vscode-chat-thinking-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsCollapsed(!isCollapsed)}
      >
        <span className="vscode-chat-thinking-expand">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <Brain size={14} className="vscode-chat-thinking-icon" />
        <span className="vscode-chat-thinking-label">
          {isStreaming ? (
            <>
              <span className="vscode-chat-thinking-shimmer-text">思考中...</span>
              <span className="vscode-chat-thinking-spinner">◐</span>
            </>
          ) : (
            '思考过程'
          )}
        </span>
        <span className="vscode-chat-thinking-meta">
          {tokenCount !== undefined && (
            <span className="vscode-chat-thinking-meta-item">
              <Hash size={11} /> {tokenCount}
            </span>
          )}
          {durationMs !== undefined && (
            <span className="vscode-chat-thinking-meta-item">
              <Clock size={11} /> {formatDuration(durationMs)}
            </span>
          )}
        </span>
      </div>

      {/* Content - 可折叠 */}
      {!isCollapsed && (
        <div className="vscode-chat-thinking-content">
          <pre className="vscode-chat-thinking-pre">
            {displayedContent}
            {isStreaming && (
              <span className="vscode-chat-thinking-cursor">▊</span>
            )}
          </pre>
        </div>
      )}

      {/* Collapsed preview */}
      {isCollapsed && content && (
        <div
          className="vscode-chat-thinking-preview"
          onClick={() => setIsCollapsed(false)}
        >
          <span className="vscode-chat-thinking-preview-text">
            {content.slice(0, 100)}{content.length > 100 ? '...' : ''}
          </span>
          <span className="vscode-chat-thinking-preview-hint">点击展开</span>
        </div>
      )}
    </div>
  );
}

export default ThinkingPart;
