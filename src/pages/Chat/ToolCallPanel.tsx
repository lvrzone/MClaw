/**
 * ToolCallPanel - 实时显示当前工具调用和思考过程
 * 位于网关状态上方，实时显示 thinking、exec、write、read 等工具调用
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Brain, Terminal, FileEdit, FileSearch, Search, Globe, Code2, Wrench, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCall {
  id?: string;
  toolCallId?: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  summary?: string;
  input?: unknown;
  content?: unknown;
  updatedAt?: number;
}

interface ToolCallPanelProps {
  tools: ToolCall[];
  isStreaming?: boolean;
  thinking?: string | null;
}

// 工具图标映射
const toolIcons: Record<string, React.ElementType> = {
  thinking: Brain,
  think: Brain,
  exec: Terminal,
  execute: Terminal,
  write: FileEdit,
  writetofile: FileEdit,
  read: FileSearch,
  readfile: FileSearch,
  search: Search,
  web_search: Globe,
  browser: Globe,
  bash: Terminal,
  python: Code2,
  javascript: Code2,
  typescript: Code2,
};

// 工具颜色映射
const toolColors: Record<string, { bg: string; border: string; text: string; icon: string; glow: string }> = {
  thinking: { 
    bg: 'bg-purple-50/80 dark:bg-purple-900/30', 
    border: 'border-purple-200 dark:border-purple-800', 
    text: 'text-purple-700 dark:text-purple-300', 
    icon: 'text-purple-500',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.4)]'
  },
  think: { 
    bg: 'bg-purple-50/80 dark:bg-purple-900/30', 
    border: 'border-purple-200 dark:border-purple-800', 
    text: 'text-purple-700 dark:text-purple-300', 
    icon: 'text-purple-500',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.4)]'
  },
  exec: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/30', 
    border: 'border-blue-200 dark:border-blue-800', 
    text: 'text-blue-700 dark:text-blue-300', 
    icon: 'text-blue-500',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]'
  },
  execute: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/30', 
    border: 'border-blue-200 dark:border-blue-800', 
    text: 'text-blue-700 dark:text-blue-300', 
    icon: 'text-blue-500',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]'
  },
  write: { 
    bg: 'bg-green-50/80 dark:bg-green-900/30', 
    border: 'border-green-200 dark:border-green-800', 
    text: 'text-green-700 dark:text-green-300', 
    icon: 'text-green-500',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.4)]'
  },
  writetofile: { 
    bg: 'bg-green-50/80 dark:bg-green-900/30', 
    border: 'border-green-200 dark:border-green-800', 
    text: 'text-green-700 dark:text-green-300', 
    icon: 'text-green-500',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.4)]'
  },
  read: { 
    bg: 'bg-amber-50/80 dark:bg-amber-900/30', 
    border: 'border-amber-200 dark:border-amber-800', 
    text: 'text-amber-700 dark:text-amber-300', 
    icon: 'text-amber-500',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]'
  },
  readfile: { 
    bg: 'bg-amber-50/80 dark:bg-amber-900/30', 
    border: 'border-amber-200 dark:border-amber-800', 
    text: 'text-amber-700 dark:text-amber-300', 
    icon: 'text-amber-500',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]'
  },
  search: { 
    bg: 'bg-cyan-50/80 dark:bg-cyan-900/30', 
    border: 'border-cyan-200 dark:border-cyan-800', 
    text: 'text-cyan-700 dark:text-cyan-300', 
    icon: 'text-cyan-500',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]'
  },
  web_search: { 
    bg: 'bg-cyan-50/80 dark:bg-cyan-900/30', 
    border: 'border-cyan-200 dark:border-cyan-800', 
    text: 'text-cyan-700 dark:text-cyan-300', 
    icon: 'text-cyan-500',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]'
  },
  browser: { 
    bg: 'bg-cyan-50/80 dark:bg-cyan-900/30', 
    border: 'border-cyan-200 dark:border-cyan-800', 
    text: 'text-cyan-700 dark:text-cyan-300', 
    icon: 'text-cyan-500',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]'
  },
  bash: { 
    bg: 'bg-gray-50/80 dark:bg-gray-900/30', 
    border: 'border-gray-200 dark:border-gray-800', 
    text: 'text-gray-700 dark:text-gray-300', 
    icon: 'text-gray-500',
    glow: 'shadow-[0_0_12px_rgba(107,114,128,0.4)]'
  },
  python: { 
    bg: 'bg-yellow-50/80 dark:bg-yellow-900/30', 
    border: 'border-yellow-200 dark:border-yellow-800', 
    text: 'text-yellow-700 dark:text-yellow-300', 
    icon: 'text-yellow-500',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.4)]'
  },
  javascript: { 
    bg: 'bg-yellow-50/80 dark:bg-yellow-900/30', 
    border: 'border-yellow-200 dark:border-yellow-800', 
    text: 'text-yellow-700 dark:text-yellow-300', 
    icon: 'text-yellow-500',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.4)]'
  },
  typescript: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/30', 
    border: 'border-blue-200 dark:border-blue-800', 
    text: 'text-blue-700 dark:text-blue-300', 
    icon: 'text-blue-500',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]'
  },
};

// 获取工具显示名称
function getToolDisplayName(name: string): string {
  const nameMap: Record<string, string> = {
    thinking: '思考中',
    think: '思考中',
    exec: '执行命令',
    execute: '执行命令',
    write: '写入文件',
    writetofile: '写入文件',
    read: '读取文件',
    readfile: '读取文件',
    search: '搜索',
    web_search: '网页搜索',
    browser: '浏览器',
    bash: 'Bash',
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  };
  return nameMap[name.toLowerCase()] || name;
}

// 格式化工具摘要
function formatToolSummary(name: string, input: unknown): string {
  if (!input) return '';
  
  try {
    const inputObj = typeof input === 'string' ? JSON.parse(input) : input;
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('write') || lowerName.includes('file')) {
      return inputObj.file_path || inputObj.path || inputObj.filePath || inputObj.file || '';
    }
    
    if (lowerName.includes('read')) {
      return inputObj.file_path || inputObj.path || inputObj.filePath || inputObj.file || '';
    }
    
    if (lowerName.includes('exec') || lowerName === 'bash' || lowerName === 'terminal') {
      const cmd = inputObj.command || inputObj.cmd || inputObj.executable || '';
      return cmd.slice(0, 40) + (cmd.length > 40 ? '...' : '');
    }
    
    if (lowerName.includes('search') || lowerName.includes('web')) {
      return inputObj.query || inputObj.q || inputObj.keyword || inputObj.search || '';
    }
    
    if (lowerName.includes('thinking') || lowerName === 'think') {
      const thought = inputObj.thought || inputObj.thinking || inputObj.content || inputObj.text || '';
      return thought.slice(0, 50) + (thought.length > 50 ? '...' : '');
    }
    
    const possibleFields = ['path', 'file', 'url', 'query', 'command', 'text', 'content', 'message'];
    for (const field of possibleFields) {
      if (inputObj[field]) {
        const value = String(inputObj[field]).slice(0, 40);
        return value + (String(inputObj[field]).length > 40 ? '...' : '');
      }
    }
  } catch {
    // 解析失败返回空
  }
  
  return '';
}

// 思考过程组件 - 带打字机效果
function ThinkingProcess({ thinking, isStreaming }: { thinking: string; isStreaming: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const prevThinkingRef = useRef('');
  
  useEffect(() => {
    if (!thinking) {
      setDisplayText('');
      prevThinkingRef.current = '';
      return;
    }
    
    // 如果是全新的思考内容，从头开始
    if (!thinking.startsWith(prevThinkingRef.current)) {
      setDisplayText(thinking);
      prevThinkingRef.current = thinking;
      return;
    }
    
    // 追加新内容
    const newContent = thinking.slice(prevThinkingRef.current.length);
    if (newContent) {
      let index = 0;
      const interval = setInterval(() => {
        if (index >= newContent.length) {
          clearInterval(interval);
          return;
        }
        setDisplayText(prev => prev + newContent[index]);
        index++;
      }, 15); // 打字速度
      
      return () => clearInterval(interval);
    }
    
    prevThinkingRef.current = thinking;
  }, [thinking]);
  
  if (!thinking && !displayText) return null;
  
  return (
    <div className="px-3 py-2 border-b border-border/30 bg-purple-50/30 dark:bg-purple-900/10">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <Brain className={cn(
            "h-4 w-4 text-purple-500",
            isStreaming && "animate-pulse"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
            思考过程
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
            {displayText || thinking}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-purple-500 ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolCallPanel({ tools, isStreaming, thinking }: ToolCallPanelProps) {
  const [expanded, setExpanded] = useState(true);
  
  // 只显示正在运行或刚刚完成的工具（1秒内）
  const visibleTools = useMemo(() => {
    const now = Date.now();
    return tools.filter(t => {
      if (!t.name || t.name.trim() === '') return false;
      // 正在运行的工具始终显示
      if (t.status === 'running') return true;
      // 已完成的工具只显示1秒
      if (t.status === 'completed' && t.updatedAt) {
        return now - t.updatedAt < 1000;
      }
      return false;
    });
  }, [tools]);
  
  const hasThinking = !!thinking && thinking.trim().length > 0;
  const hasTools = visibleTools.length > 0;
  
  // 如果没有工具且不在流式状态，不显示面板（思考内容只在流式时显示）
  if (!hasTools && !isStreaming) return null;
  
  const runningCount = visibleTools.filter(t => t.status === 'running').length;
  
  return (
    <div className="mx-3 mb-2 rounded-xl overflow-hidden transition-all duration-300 relative">
      {/* 扫光效果 - 快速蓝色 */}
      {isStreaming && (
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.15) 50%, transparent 100%)',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}
        />
      )}
      
      {/* 头部 - 显示实时状态 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors relative z-10"
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
          <span className="text-xs font-medium">
            {isStreaming 
              ? runningCount > 0 
                ? `正在调用工具 (${runningCount})` 
                : hasThinking 
                  ? '思考中...' 
                  : '处理中...'
              : '处理完成'
            }
          </span>
          
          {/* 工具图标预览 */}
          {hasTools && (
            <div className="flex items-center gap-1 ml-2">
              {visibleTools.slice(0, 4).map((tool, i) => {
                const lowerName = tool.name.toLowerCase();
                const Icon = toolIcons[lowerName] || Wrench;
                const colors = toolColors[lowerName] || toolColors.bash;
                return (
                  <div
                    key={tool.toolCallId || tool.id || i}
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                      colors.bg
                    )}
                  >
                    <Icon className={cn("h-3 w-3", colors.icon)} />
                  </div>
                );
              })}
              {visibleTools.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{visibleTools.length - 4}</span>
              )}
            </div>
          )}
        </div>
        
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {/* 展开内容 */}
      {expanded && (
        <div className="relative z-10">
          {/* 思考过程 */}
          {hasThinking && (
            <ThinkingProcess thinking={thinking} isStreaming={isStreaming ?? false} />
          )}
          
          {/* 工具列表 */}
          {hasTools && (
            <div className="px-3 py-2 space-y-1.5">
              {visibleTools.map((tool) => {
                const lowerName = tool.name.toLowerCase();
                const Icon = toolIcons[lowerName] || Wrench;
                const colors = toolColors[lowerName] || toolColors.bash;
                const displayName = getToolDisplayName(tool.name);
                const summary = tool.summary || formatToolSummary(tool.name, tool.input) || formatToolSummary(tool.name, tool.content);
                
                return (
                  <div
                    key={tool.toolCallId || tool.id}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 relative overflow-hidden",
                      colors.bg
                    )}
                  >
                    {/* 单个工具扫光效果 - 快速蓝色 */}
                    {tool.status === 'running' && (
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.25) 50%, transparent 100%)',
                          animation: 'shimmer 1.2s ease-in-out infinite',
                        }}
                      />
                    )}
                    
                    {/* 状态图标 */}
                    <div className="shrink-0 relative z-10">
                      {tool.status === 'running' ? (
                        <Loader2 className={cn("h-3.5 w-3.5 animate-spin", colors.icon)} />
                      ) : tool.status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                    
                    {/* 工具图标 */}
                    <Icon className={cn("h-3.5 w-3.5 shrink-0 relative z-10", colors.icon)} />
                    
                    {/* 工具名称 */}
                    <span className={cn("font-medium shrink-0 relative z-10", colors.text)}>
                      {displayName}
                    </span>
                    
                    {/* 摘要 */}
                    {summary && (
                      <span className="text-muted-foreground truncate flex-1 text-[11px] relative z-10">
                        {summary}
                      </span>
                    )}
                    
                    {/* 耗时 */}
                    {tool.durationMs && tool.status === 'completed' && (
                      <span className="text-[10px] text-muted-foreground shrink-0 relative z-10">
                        {tool.durationMs < 1000 
                          ? `${tool.durationMs}ms` 
                          : `${(tool.durationMs / 1000).toFixed(1)}s`
                        }
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 空状态 - 只有思考没有工具时 */}
          {hasThinking && !hasTools && isStreaming && (
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span>正在分析...</span>
            </div>
          )}
        </div>
      )}
      
      {/* 全局 CSS 动画 */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
