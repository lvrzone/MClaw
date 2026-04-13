/**
 * TaskCollapsibleContent Component
 * AI 消息任务折叠组件 - 自动按 ## 任务 分割并折叠历史任务
 */
import { useState, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight, ChevronDown, FileText, Terminal, FolderOpen, Search, Globe, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCollapsibleContentProps {
  text: string;
  defaultExpandCount?: number;
  taskPattern?: RegExp;
  isStreaming?: boolean;
}

interface ToolStatus {
  icon: React.ReactNode;
  text: string;
  colorClass: string;
  bgClass: string;
}

/**
 * 检测工具状态
 */
function detectToolStatus(block: string): ToolStatus | null {
  // 文件操作
  if (block.includes('【文件：') || block.includes('写入文件') || block.includes('write_file')) {
    return {
      icon: <FileText className="h-3 w-3" />,
      text: '已写入文件',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-50/80 dark:bg-emerald-900/20',
    };
  }
  // 命令执行
  if (block.includes('【命令：') || block.includes('执行命令') || block.includes('execute') || block.includes('bash')) {
    return {
      icon: <Terminal className="h-3 w-3" />,
      text: '已执行命令',
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-50/80 dark:bg-blue-900/20',
    };
  }
  // 列出文件
  if (block.includes('列出文件') || block.includes('list_files') || block.includes('查看目录')) {
    return {
      icon: <FolderOpen className="h-3 w-3" />,
      text: '已列出文件',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-50/80 dark:bg-amber-900/20',
    };
  }
  // 读取文件
  if (block.includes('读取文件') || block.includes('read_file') || block.includes('查看文件')) {
    return {
      icon: <FileText className="h-3 w-3" />,
      text: '已读取文件',
      colorClass: 'text-cyan-600 dark:text-cyan-400',
      bgClass: 'bg-cyan-50/80 dark:bg-cyan-900/20',
    };
  }
  // 搜索
  if (block.includes('搜索') || block.includes('search') || block.includes('find')) {
    return {
      icon: <Search className="h-3 w-3" />,
      text: '已搜索',
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-50/80 dark:bg-purple-900/20',
    };
  }
  // MCP / 外部工具
  if (block.includes('MCP：') || block.includes('mcp') || block.includes('调用工具')) {
    return {
      icon: <Wrench className="h-3 w-3" />,
      text: '已调用外部工具',
      colorClass: 'text-pink-600 dark:text-pink-400',
      bgClass: 'bg-pink-50/80 dark:bg-pink-900/20',
    };
  }
  // 浏览器 / 网页
  if (block.includes('浏览器') || block.includes('browser') || block.includes('web_search')) {
    return {
      icon: <Globe className="h-3 w-3" />,
      text: '已浏览网页',
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-50/80 dark:bg-indigo-900/20',
    };
  }
  return null;
}

/**
 * 检测文本是否包含任务块
 */
export function hasTaskBlocks(text: string, taskPattern: RegExp = /##\s*任务\s*\d+/): boolean {
  if (!text || text.trim().length === 0) return false;
  return taskPattern.test(text);
}

export const TaskCollapsibleContent = memo(function TaskCollapsibleContent({
  text,
  defaultExpandCount = 1,
  taskPattern = /(?=##\s*任务\s*\d+[：:])/g,
  isStreaming = false,
}: TaskCollapsibleContentProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  // 按任务模式分割内容 - 使用 useMemo 避免频繁重新计算
  const blocks = useMemo(() => {
    if (!text || text.trim().length === 0) return [];
    const splitBlocks = text.split(taskPattern).filter(block => block.trim());
    return splitBlocks;
  }, [text, taskPattern]);

  // 检测是否包含任务块
  const hasTasks = useMemo(() => {
    if (!text || text.trim().length === 0) return false;
    return /##\s*任务\s*\d+/.test(text);
  }, [text]);

  // 空文本处理
  if (!text || text.trim().length === 0) {
    return null;
  }

  // 非任务内容直接渲染
  if (!hasTasks || blocks.length <= 1) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none break-words break-all text-[13px] leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {text}
        </ReactMarkdown>
        {isStreaming && !text && (
          <span className="inline-block w-1.5 h-3 bg-foreground/40 animate-pulse ml-0.5" />
        )}
      </div>
    );
  }

  // 切换块的展开/折叠状态
  const toggleBlock = (index: number) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 判断块是否应该展开
  const isExpanded = (index: number) => {
    // 最后 N 个默认展开
    const isLastN = index >= blocks.length - defaultExpandCount;
    // 或者用户手动点击展开/折叠
    if (expandedBlocks.has(index)) return true;
    if (expandedBlocks.has(-index - 1)) return false; // 用户手动折叠了默认展开的
    return isLastN;
  };

  // 提取块的标题（第一行）
  const getBlockTitle = (block: string): string => {
    const firstLine = block.split('\n')[0].trim();
    // 移除 Markdown 标题标记
    return firstLine.replace(/^#+\s*/, '') || '任务内容';
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const expanded = isExpanded(index);
        const title = getBlockTitle(block);
        const isTaskBlock = /^##?\s*任务/.test(block.trim());
        const toolStatus = detectToolStatus(block);

        return (
          <div
            key={index}
            className={cn(
              "min-w-0",
              !expanded && isTaskBlock && "cursor-pointer hover:opacity-80"
            )}
          >
            {/* 工具状态条 */}
            {toolStatus && (
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium mb-2",
                toolStatus.colorClass,
                toolStatus.bgClass
              )}>
                {toolStatus.icon}
                <span>{toolStatus.text}</span>
              </div>
            )}

            {expanded ? (
              <div className="min-w-0">
                {/* 可点击的标题栏 - 用于折叠 */}
                <div 
                  className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none group"
                  onClick={() => toggleBlock(-index - 1)}
                >
                  <ChevronDown className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">{title}</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words text-[13px] leading-relaxed min-w-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {block}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground select-none py-0.5"
                onClick={() => toggleBlock(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleBlock(index)}
              >
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="truncate">{title}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Markdown 组件配置
const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !className;
    if (isInline) {
      return (
        <code className="bg-background/40 px-1 py-0.5 rounded text-[12px] font-mono break-words break-all" {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-background/40 rounded-lg p-2 overflow-x-auto my-1">
        <code className={cn('text-[12px] font-mono', className)} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words break-all">
        {children}
      </a>
    );
  },
};

export default TaskCollapsibleContent;
