/**
 * Task Plan Panel - 思考过程与工具调用展示
 * 流式输出效果 + 标签式显示
 */
import { useState, useEffect, useRef } from 'react';
import { 
  Brain,
  Zap,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Terminal,
  Search,
  FileCode,
  Settings,
  Globe,
  Image,
  Video,
  Mic,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolStatus = 'running' | 'completed' | 'error';

interface TaskPlanPanelProps {
  thinking?: string;
  isStreaming?: boolean;
  compact?: boolean;
  tools?: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: ToolStatus;
    summary?: string;
    durationMs?: number;
  }>;
}

// 工具图标映射
const toolIcons: Record<string, React.ElementType> = {
  'web_search': Search,
  'browser': Globe,
  'code': FileCode,
  'file': FileCode,
  'image': Image,
  'video': Video,
  'audio': Mic,
  'search': Search,
  'terminal': Terminal,
  'config': Settings,
  'default': Zap,
};

function getToolIcon(name: string): React.ElementType {
  const lowerName = name.toLowerCase();
  for (const [key, icon] of Object.entries(toolIcons)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return toolIcons['default'];
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// 流式文字组件
function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!text) {
      setDisplayText('');
      return;
    }
    
    // 如果已完成，直接显示全部
    if (!isStreaming) {
      setDisplayText(text);
      return;
    }
    
    // 流式效果：逐步显示文字
    let currentIndex = displayText.length;
    const targetLength = text.length;
    
    if (currentIndex >= targetLength) return;
    
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayText(text.slice(0, currentIndex));
      
      // 自动滚动到底部
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      
      if (currentIndex >= targetLength) {
        clearInterval(interval);
      }
    }, 15); // 15ms 每字符，约 60fps
    
    return () => clearInterval(interval);
  }, [text, isStreaming]);
  
  // 光标闪烁效果
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [isStreaming]);
  
  return (
    <div 
      ref={containerRef}
      className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap font-mono max-h-[120px] overflow-y-auto scrollbar-thin"
    >
      {displayText}
      {isStreaming && (
        <span 
          className={cn(
            "inline-block w-2 h-4 ml-0.5 align-middle bg-blue-500/80",
            cursorVisible ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}

// 工具标签组件
function ToolTag({ 
  tool, 
  index 
}: { 
  tool: { name: string; status: ToolStatus; summary?: string }; 
  index: number;
}) {
  const Icon = getToolIcon(tool.name);
  const isRunning = tool.status === 'running';
  const isCompleted = tool.status === 'completed';
  const isError = tool.status === 'error';
  
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium",
        "transition-all duration-300 animate-in fade-in slide-in-from-left-2",
        "border shadow-sm",
        isRunning && [
          "bg-blue-50/90 dark:bg-blue-900/40",
          "border-blue-300/60 dark:border-blue-700/40",
          "text-blue-700 dark:text-blue-300",
        ],
        isCompleted && [
          "bg-green-50/80 dark:bg-green-900/30",
          "border-green-300/50 dark:border-green-700/30",
          "text-green-700 dark:text-green-300",
        ],
        isError && [
          "bg-red-50/80 dark:bg-red-900/30",
          "border-red-300/50 dark:border-red-700/30",
          "text-red-700 dark:text-red-300",
        ]
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {isRunning ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isCompleted ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[80px]">{formatToolName(tool.name)}</span>
      {tool.summary && (
        <span className="text-[9px] opacity-60 truncate max-w-[60px]">
          {tool.summary.slice(0, 15)}...
        </span>
      )}
    </div>
  );
}

export function TaskPlanPanel({ 
  thinking,
  isStreaming = false,
  compact = false,
  tools = []
}: TaskPlanPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasContent = Boolean(thinking) || tools.length > 0;
  const hasActivity = isStreaming || hasContent;
  
  // 自动展开当有活动时
  useEffect(() => {
    if (hasActivity && collapsed) {
      setCollapsed(false);
    }
  }, [hasActivity]);
  
  // 如果没有内容且未展开，不渲染
  if (!hasActivity && collapsed) return null;
  
  const completedTools = tools.filter(t => t.status === 'completed').length;
  
  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden transition-all duration-300",
        "bg-gradient-to-br from-slate-50/95 via-blue-50/30 to-indigo-50/20",
        "dark:from-zinc-900/95 dark:via-blue-900/20 dark:to-indigo-900/10",
        "backdrop-blur-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50",
        compact ? "mx-2 mb-2" : "mx-4 mb-4"
      )}
    >
      {/* 头部 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center h-5 w-5 rounded-md",
            isStreaming ? "bg-blue-500/10" : "bg-slate-500/10"
          )}>
            {isStreaming ? (
              <Brain className="h-3 w-3 text-blue-500 animate-pulse" />
            ) : (
              <Sparkles className="h-3 w-3 text-slate-500" />
            )}
          </div>
          <span className="text-[12px] font-semibold text-foreground">
            {isStreaming ? '思考中' : '思考过程'}
          </span>
          
          {/* 工具调用计数 */}
          {tools.length > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              isStreaming 
                ? "bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                : "bg-green-100/80 dark:bg-green-900/40 text-green-600 dark:text-green-400"
            )}>
              {completedTools}/{tools.length} 工具
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="text-[10px] text-blue-500 animate-pulse">●</span>
          )}
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 内容区 */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* 思考过程 - 流式输出 */}
          {thinking && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {isStreaming ? '正在思考...' : '思考完成'}
                </span>
              </div>
              <div className={cn(
                "px-2.5 py-2 rounded-lg",
                "bg-slate-100/60 dark:bg-slate-800/40",
                "border border-slate-200/50 dark:border-slate-700/30"
              )}>
                <StreamingText text={thinking} isStreaming={isStreaming} />
              </div>
            </div>
          )}
          
          {/* 工具调用标签云 */}
          {tools.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  工具调用
                </span>
                <span className="text-[9px] text-muted-foreground/50 ml-auto">
                  点击展开详情
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {tools.map((tool, idx) => (
                  <ToolTag key={tool.toolCallId || tool.id || idx} tool={tool} index={idx} />
                ))}
              </div>
            </div>
          )}
          
          {/* 等待状态 */}
          {isStreaming && !thinking && tools.length === 0 && (
            <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>准备中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
