/**
 * TaskCollapsibleContent — 任务折叠组件
 * Claude Code / Codex CLI 交互风格
 * 
 * 核心交互：
 * - 流式中：当前任务展开，实时推进
 * - 完成后：所有任务自动收起，只显示标题 + ✅
 * - 用户可点击任意任务展开查看
 */
import { useState, useMemo, memo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown, ChevronRight, Check, Circle,
  Terminal, FileEdit, FileSearch, Search, Globe,
  Wrench, FolderOpen, Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCollapsibleContentProps {
  text: string;
  defaultExpandCount?: number;
  taskPattern?: RegExp;
  isStreaming?: boolean;
  /** 整条消息是否已完成 */
  messageCompleted?: boolean;
}

// ── 工具标签检测 ──
interface ToolTag {
  icon: React.ElementType;
  label: string;
  detail: string;
  color: string;
}

function detectToolTag(block: string): ToolTag | null {
  const cmdMatch = block.match(/【命令[：:] *([^]]+)】/) ||
    block.match(/执行命令[：:] *`?([^`\n]+)`?/) ||
    block.match(/execut(?:e|ing)[：: ]+`?([^`\n]+)`?/i);
  if (cmdMatch) return { icon: Terminal, label: '已执行命令', detail: cmdMatch[1].trim().slice(0, 60), color: 'text-blue-500' };

  const writeMatch = block.match(/【文件[：:] *([^]]+)】/) ||
    block.match(/写入文件[：: ]+`?([^`\n]+)`?/) ||
    block.match(/writ(?:e|ing)[：: ]+`?([^`\n]+)`?/i);
  if (writeMatch) return { icon: FileEdit, label: '已写入文件', detail: writeMatch[1].trim().slice(0, 60), color: 'text-green-500' };

  const readMatch = block.match(/读取文件[：: ]+`?([^`\n]+)`?/) ||
    block.match(/read(?:ing)?[：: ]+`?([^`\n]+)`?/i);
  if (readMatch) return { icon: FileSearch, label: '已读取文件', detail: readMatch[1].trim().slice(0, 60), color: 'text-amber-500' };

  const searchMatch = block.match(/搜索[：: ]+`?([^`\n]+)`?/) ||
    block.match(/search(?:ing)?[：: ]+`?([^`\n]+)`?/i);
  if (searchMatch) return { icon: Search, label: '已搜索', detail: searchMatch[1].trim().slice(0, 40), color: 'text-cyan-500' };

  if (block.match(/浏览器|browser|web_search/i)) return { icon: Globe, label: '已浏览', detail: '', color: 'text-indigo-500' };
  if (block.match(/MCP[：:]|调用工具|mcp/i)) return { icon: Wrench, label: '已调用工具', detail: '', color: 'text-pink-500' };
  if (block.match(/列出文件|list_files|查看目录/i)) return { icon: FolderOpen, label: '已列出文件', detail: '', color: 'text-amber-500' };

  return null;
}

function isTaskCompleted(block: string): boolean {
  return /✅|已完成|completed|done/i.test(block) ||
    (/任务\d+[：:]/.test(block) && /已执行|已写入|已读取/.test(block));
}

export function hasTaskBlocks(text: string): boolean {
  return !!text && /## *任务 *\d+/.test(text);
}

export const TaskCollapsibleContent = memo(function TaskCollapsibleContent({
  text,
  defaultExpandCount = 1,
  taskPattern = /(?=## *任务 *\d+[：:])/g,
  isStreaming = false,
  messageCompleted = false,
}: TaskCollapsibleContentProps) {
  // 用户手动操作记录
  const [userExpanded, setUserExpanded] = useState<Set<number>>(new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<number>>(new Set());
  const prevCompletedRef = useRef(messageCompleted);

  // ★ 核心逻辑：消息完成 → 自动收起所有任务
  useEffect(() => {
    if (messageCompleted && !prevCompletedRef.current) {
      setUserCollapsed(new Set()); // 清空，让 collapsed 逻辑统一走 messageCompleted 分支
    }
    prevCompletedRef.current = messageCompleted;
  }, [messageCompleted]);

  const blocks = useMemo(() => {
    if (!text?.trim()) return [];
    return text.split(taskPattern).filter(b => b.trim());
  }, [text, taskPattern]);

  const hasTasks = useMemo(() => hasTaskBlocks(text), [text]);

  if (!text?.trim()) return null;

  // 非任务内容：直接渲染
  if (!hasTasks || blocks.length <= 1) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none break-words text-[13px] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {text}
        </ReactMarkdown>
        {isStreaming && !text && (
          <span className="inline-block w-1.5 h-3 bg-foreground/40 animate-pulse ml-0.5" />
        )}
      </div>
    );
  }

  const isExpanded = (index: number) => {
    // 用户手动展开过
    if (userExpanded.has(index)) return true;
    // 用户手动收起过
    if (userCollapsed.has(index)) return false;
    // ★ 消息完成后：全部收起
    if (messageCompleted) return false;
    // 流式中：最后 N 个展开
    return index >= blocks.length - defaultExpandCount;
  };

  const expand = (index: number) => {
    setUserExpanded(prev => new Set(prev).add(index));
    setUserCollapsed(prev => { const s = new Set(prev); s.delete(index); return s; });
  };

  const collapse = (index: number) => {
    setUserCollapsed(prev => new Set(prev).add(index));
    setUserExpanded(prev => { const s = new Set(prev); s.delete(index); return s; });
  };

  const getBlockTitle = (block: string): string => {
    return block.split('\n')[0].trim().replace(/^#+ */, '') || '任务内容';
  };

  return (
    <div className="flex flex-col gap-0.5">
      {blocks.map((block, index) => {
        const expanded = isExpanded(index);
        const title = getBlockTitle(block);
        const isTaskBlock = /^##? *任务/.test(block.trim());
        const completed = isTaskBlock ? isTaskCompleted(block) : false;
        const toolTag = isTaskBlock ? detectToolTag(block) : null;

        // 扫描所有工具标签（多行工具）
        const allToolTags: ToolTag[] = [];
        if (isTaskBlock) {
          for (const line of block.split('\n')) {
            const t = detectToolTag(line);
            if (t) allToolTags.push(t);
          }
          if (allToolTags.length === 0 && toolTag) allToolTags.push(toolTag);
        }

        return (
          <div key={index} className="min-w-0">
            {expanded ? (
              <div className="min-w-0">
                {/* 标题行 */}
                <div
                  className="flex items-center gap-1.5 mb-0.5 text-[12px] cursor-pointer hover:opacity-80 transition-opacity select-none group"
                  onClick={() => collapse(index)}
                >
                  {completed ? (
                    <Check className="h-3 w-3 text-green-500/60 shrink-0" />
                  ) : isTaskBlock ? (
                    <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  ) : null}
                  <span className={cn(
                    "font-medium truncate transition-all duration-200",
                    completed ? "text-muted-foreground/50 line-through" : "text-foreground/90",
                  )}>
                    {title}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/30 shrink-0 ml-auto group-hover:text-muted-foreground/60 transition-colors" />
                </div>

                {/* 内联工具标签 */}
                {allToolTags.map((tag, ti) => (
                  <ToolTagLabel key={ti} tag={tag} />
                ))}

                {/* Markdown 内容 */}
                {/* Markdown 内容 - 带竖线连接器 */}
                <div className="ml-1 tree-connector">
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words text-[12px] leading-relaxed min-w-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {block}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* 流式光标 */}
                {isStreaming && index === blocks.length - 1 && (
                  <span className="inline-block w-1 h-2.5 bg-foreground/40 animate-pulse ml-0.5" />
                )}
              </div>
            ) : (
              /* 折叠态 */
              <div
                className="flex items-center gap-1.5 text-[12px] select-none py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => expand(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && expand(index)}
              >
                {completed ? (
                  <Check className="h-3 w-3 text-green-500/60 shrink-0" />
                ) : isTaskBlock ? (
                  <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                ) : null}
                <ChevronRight
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 transition-transform duration-200",
                  )}
                />
                <span className={cn(
                  "truncate transition-all duration-200",
                  completed && "text-muted-foreground/50 line-through",
                )}>{title}</span>
                {/* 折叠态显示工具摘要 */}
                {allToolTags.length > 0 && (
                  <span className={cn("text-[10px]", allToolTags[0].color)}>
                    {allToolTags.map(t => t.label).join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── 工具内联标签 ──
function ToolTagLabel({ tag }: { tag: ToolTag }) {
  const Icon = tag.icon;
  return (
    <div className="flex items-center gap-1 my-0.5 ml-1">
      <Icon className={cn("h-2.5 w-2.5 shrink-0", tag.color)} />
      <span className={cn("text-[10px] font-medium", tag.color)}>{tag.label}</span>
      {tag.detail && (
        <span className="text-[10px] text-muted-foreground/50 font-mono truncate">{tag.detail}</span>
      )}
    </div>
  );
}

// ── Markdown 组件 ──
const mdComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !className;
    if (isInline) {
      return <code className="bg-muted/30 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>{children}</code>;
    }
    return (
      <div className="my-1 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-border/30 overflow-hidden">
        {match && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 border-b border-border/20 bg-muted/10">
            <Code2 className="h-2.5 w-2.5 text-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground/60 font-mono">{match[1]}</span>
          </div>
        )}
        <pre className="px-2 py-1.5 overflow-x-auto">
          <code className={cn('text-[11px] font-mono leading-relaxed text-muted-foreground/80', className)} {...props}>{children}</code>
        </pre>
      </div>
    );
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>;
  },
};

export default TaskCollapsibleContent;
