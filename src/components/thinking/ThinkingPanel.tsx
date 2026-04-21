import { memo, useRef, useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { ThinkingExternalResources, type ResourceItem } from './ThinkingExternalResources';

interface ThinkingPanelProps {
  thinking: string | null;
  isStreaming?: boolean;
  resources?: ResourceItem[];
  onToggle?: () => void;
}

/**
 * ThinkingPanel - 增强版 Thinking 面板
 * 显示 thinking 文本，支持流式渲染、折叠和外部资源追踪
 */
export const ThinkingPanel = memo(function ThinkingPanel({
  thinking,
  isStreaming = false,
  resources = [],
  onToggle
}: ThinkingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // 流式时自动滚动到底部
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isStreaming]);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
    onToggle?.();
  };

  if (!thinking && resources.length === 0) {
    return null;
  }

  return (
    <div className="thinking-panel border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div 
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        onClick={handleToggle}
      >
        <Brain className="w-4 h-4 text-purple-500" />
        
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Thinking
        </span>
        
        {isStreaming && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <span className="animate-pulse">●</span>
            streaming
          </span>
        )}
        
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="thinking-content">
          {/* Thinking text */}
          {thinking && (
            <div 
              ref={contentRef}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-64 overflow-y-auto"
            >
              {thinking}
              {/* 流式时显示闪烁光标 */}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 dark:bg-gray-500 animate-pulse" />
              )}
            </div>
          )}

          {/* External Resources */}
          {resources.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <ThinkingExternalResources resources={resources} />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
