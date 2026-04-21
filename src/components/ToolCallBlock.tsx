/**
 * ToolCallBlock — 工具调用块组件
 * Claude Code / Codex CLI 交互风格
 * 
 * 支持 exec / write / read / search / browser / bash 等所有工具类型
 * 交互逻辑：
 * - 流式中：展开，实时显示执行状态 + 参数
 * - 完成后：收起为紧凑行，可点击展开
 * - Plan 工具特殊渲染
 */
import { useState, memo, useEffect, useRef } from 'react';
import {
  Terminal, FileEdit, FileSearch, Search, Globe,
  Code2, Wrench, ListTodo, GitBranch, Zap,
  CheckCircle2, XCircle, Loader2, ChevronRight,
  Brain, FolderOpen, Pencil, Database, Mail, Calendar,
  Image, MessageSquare, Cloud, Shield, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NormalizedBlock } from '@/stores/chat/types';

interface ToolCallBlockProps {
  block: NormalizedBlock;
  isSessionActive?: boolean;
  /** 整条消息是否已完成 */
  messageCompleted?: boolean;
}

// ── 全量工具图标映射 ──
const toolIcons: Record<string, React.ElementType> = {
  // 核心工具
  exec: Terminal, execute: Terminal, bash: Terminal, shell: Terminal,
  write: FileEdit, writetofile: FileEdit, edit: Pencil, update: Pencil,
  read: FileSearch, readfile: FileSearch, cat: FileSearch,
  search: Search, grep: Search, find: Search,
  web_search: Globe, browser: Globe, fetch: Globe, web_fetch: Globe,
  // 编程
  python: Code2, javascript: Code2, typescript: Code2, node: Code2,
  // 思考
  thinking: Brain, think: Brain, reason: Brain,
  // Plan
  plan_create: ListTodo, plan_update: GitBranch,
  // 文件系统
  ls: FolderOpen, list: FolderOpen, mkdir: FolderOpen, mv: FolderOpen, cp: FolderOpen, rm: FolderOpen,
  // 数据
  database: Database, sql: Database, db: Database,
  // 通信
  mail: Mail, email: Mail, send: Mail,
  message: MessageSquare, chat: MessageSquare, im: MessageSquare,
  // 日历
  calendar: Calendar, schedule: Calendar, event: Calendar,
  // 图像
  image: Image, screenshot: Image, capture: Image,
  // 云
  cloud: Cloud, deploy: Cloud, upload: Cloud, download: Cloud,
  // 安全
  auth: Shield, login: Shield, token: Shield,
  // 系统
  system: Cpu, config: Cpu, env: Cpu,
  // 通用
  tool: Wrench, mcp: Zap, api: Zap,
};

// ── 工具颜色映射 ──
const toolColors: Record<string, string> = {
  // 核心工具
  exec: 'text-blue-500', execute: 'text-blue-500', bash: 'text-blue-500', shell: 'text-blue-500',
  write: 'text-green-500', writetofile: 'text-green-500', edit: 'text-green-500', update: 'text-green-500',
  read: 'text-amber-500', readfile: 'text-amber-500', cat: 'text-amber-500',
  search: 'text-cyan-500', grep: 'text-cyan-500', find: 'text-cyan-500',
  web_search: 'text-cyan-600', browser: 'text-indigo-500', fetch: 'text-indigo-500', web_fetch: 'text-indigo-500',
  // 编程
  python: 'text-yellow-500', javascript: 'text-yellow-400', typescript: 'text-blue-400', node: 'text-green-400',
  // 思考
  thinking: 'text-purple-500', think: 'text-purple-500', reason: 'text-purple-500',
  // Plan
  plan_create: 'text-violet-500', plan_update: 'text-violet-500',
  // 文件系统
  ls: 'text-amber-400', list: 'text-amber-400', mkdir: 'text-amber-400',
  // 通信
  mail: 'text-red-400', email: 'text-red-400',
  message: 'text-blue-400', chat: 'text-blue-400',
  // 日历
  calendar: 'text-orange-400', schedule: 'text-orange-400',
  // 图像
  image: 'text-pink-400', screenshot: 'text-pink-400',
  // 云
  cloud: 'text-sky-400', deploy: 'text-sky-400',
  // 通用
  mcp: 'text-pink-500', api: 'text-pink-500',
};

// ── 工具中文名映射 ──
const toolNames: Record<string, string> = {
  exec: '执行命令', execute: '执行命令', bash: 'Bash', shell: 'Shell',
  write: '写入文件', writetofile: '写入文件', edit: '编辑文件', update: '更新',
  read: '读取文件', readfile: '读取文件', cat: '查看文件',
  search: '搜索', grep: '搜索', find: '查找',
  web_search: '网页搜索', browser: '浏览器', fetch: '请求', web_fetch: '网页获取',
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', node: 'Node.js',
  thinking: '思考', think: '思考', reason: '推理',
  plan_create: '创建计划', plan_update: '更新计划',
  ls: '列出目录', list: '列出', mkdir: '创建目录', mv: '移动', cp: '复制', rm: '删除',
  database: '数据库', sql: 'SQL', db: '数据库',
  mail: '邮件', email: '邮件', send: '发送',
  message: '消息', chat: '聊天', im: '即时消息',
  calendar: '日历', schedule: '日程', event: '事件',
  image: '图片', screenshot: '截图', capture: '捕获',
  cloud: '云服务', deploy: '部署', upload: '上传', download: '下载',
  auth: '认证', login: '登录', token: '令牌',
  system: '系统', config: '配置', env: '环境',
  tool: '工具', mcp: 'MCP', api: 'API',
};

function getToolKey(name: string): string {
  const lower = name.toLowerCase();
  // 直接匹配
  if (toolIcons[lower]) return lower;
  // 模糊匹配
  for (const key of Object.keys(toolIcons)) {
    if (lower.includes(key)) return key;
  }
  // 常见前缀匹配
  if (lower.startsWith('feishu_') || lower.startsWith('feishu')) return 'api';
  if (lower.startsWith('github') || lower.startsWith('gh')) return 'api';
  if (lower.includes('exec') || lower.includes('run') || lower.includes('command')) return 'exec';
  if (lower.includes('write') || lower.includes('create') || lower.includes('save')) return 'write';
  if (lower.includes('read') || lower.includes('get') || lower.includes('fetch') || lower.includes('load')) return 'read';
  if (lower.includes('search') || lower.includes('query') || lower.includes('find')) return 'search';
  if (lower.includes('browser') || lower.includes('web') || lower.includes('url') || lower.includes('http')) return 'browser';
  return 'tool';
}

function formatSummary(_name: string, args: unknown): string {
  if (!args) return '';
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    for (const field of ['file_path', 'path', 'filePath', 'file', 'url', 'query', 'command', 'cmd', 'text', 'content', 'name', 'description']) {
      if (obj[field]) return String(obj[field]).slice(0, 60);
    }
    // 第一条 string 值
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && v.length > 0) return v.slice(0, 60);
    }
  } catch { /* */ }
  return '';
}

export const ToolCallBlock = memo(function ToolCallBlock({
  block,
  messageCompleted = false,
}: ToolCallBlockProps) {
  const tool = block.tool;

  // Plan 特殊渲染 - 在 Hooks 之前检查
  if (tool?.name === 'plan_create' || tool?.name === 'plan_update') {
    return <PlanTag block={block} />;
  }

  if (!tool) return null;

  const toolKey = getToolKey(tool.name);
  const Icon = toolIcons[toolKey] || Wrench;
  const color = toolColors[toolKey] || 'text-muted-foreground';
  const displayName = toolNames[toolKey] || tool.name;
  const summary = formatSummary(tool.name, tool.args);
  const isRunning = tool.status === 'running' || tool.status === 'stream_executing';
  const isFailed = tool.status === 'failed';
  const isDone = messageCompleted && !isRunning;

  // 展开/收起
  const [expanded, setExpanded] = useState(false);
  const prevRunningRef = useRef(isRunning);

  // 有结果或参数时才可展开
  const hasDetails = tool.args != null || tool.result != null || tool.error;

  // ★ 流式结束 → 自动收起
  useEffect(() => {
    if (prevRunningRef.current && !isRunning && messageCompleted) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, messageCompleted]);

  return (
    <div className={cn(
      "my-0.5 rounded-md transition-all duration-200 border overflow-hidden",
      isRunning && [
        "border-blue-500/30 bg-blue-500/5",
        "outline outline-2 outline-blue-500/20",
        "animate-[border-ping_2s_cubic-bezier(0,0,0.2,1)_infinite]",
      ],
      isDone && !isFailed && "border-transparent",
      isFailed && "border-red-500/30 bg-red-500/5",
    )}>
      {/* 头部行 — WorkBuddy 风格头部/正文分离 */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 select-none",
          isRunning && "bg-blue-50/50 dark:bg-blue-900/20",
          isFailed && "bg-red-50/50 dark:bg-red-900/20",
          !isRunning && !isFailed && hasDetails && "cursor-pointer hover:bg-muted/15",
          !isRunning && !isFailed && !hasDetails && "rounded-md",
          isRunning && "rounded-t-md",
          expanded && hasDetails && "rounded-t-md",
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* 状态指示 */}
        {isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
        ) : isFailed ? (
          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-green-500/60 shrink-0" />
        )}

        {/* 图标 */}
        <Icon className={cn("h-3 w-3 shrink-0", color)} />

        {/* 名称 */}
        <span className={cn("text-[11px] font-medium", isDone ? 'text-muted-foreground/70' : color)}>
          {displayName}
        </span>

        {/* 摘要 */}
        {summary && !expanded && (
          <span className="text-[10px] text-muted-foreground/50 font-mono truncate flex-1 min-w-0">
            {summary}
          </span>
        )}

        {/* 展开/收起箭头 - 统一旋转动画 */}
        {hasDetails && (
          <ChevronRight
            className={cn(
              "h-2.5 w-2.5 text-muted-foreground/30 shrink-0 transition-transform duration-200 ease-out",
            )}
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        )}

        {/* 运行中脉冲状态点 */}
        {isRunning && <span className="cb-status-dot shrink-0 ml-1" />}
      </div>

      {/* 正文 - max-height 滑动折叠 + 竖线连接器 */}
      {hasDetails && (
        <div
          className={cn(
            "collapse-transition border-t border-border/20",
            expanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="ml-3.5 tree-connector py-1.5 space-y-1">
            {/* 参数 */}
            {tool.args != null && (
              <div>
                <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">参数</div>
                <pre className="text-[10px] font-mono text-muted-foreground/60 bg-muted/20 rounded px-2 py-1 overflow-x-auto max-h-[120px] whitespace-pre-wrap break-all">
                  {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
            )}
            {/* 结果 */}
            {tool.result != null && (
              <div>
                <div className="text-[9px] text-green-500/60 uppercase tracking-wider mb-0.5">结果</div>
                <pre className="text-[10px] font-mono text-muted-foreground/60 bg-green-500/5 rounded px-2 py-1 overflow-x-auto max-h-[160px] whitespace-pre-wrap break-all">
                  {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                </pre>
              </div>
            )}
            {/* 错误 */}
            {tool.error && (
              <div>
                <div className="text-[9px] text-red-500/60 uppercase tracking-wider mb-0.5">错误</div>
                <pre className="text-[10px] font-mono text-red-500/70 bg-red-500/5 rounded px-2 py-1 overflow-x-auto max-h-[100px] whitespace-pre-wrap break-all">
                  {tool.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Plan 标签 ──
function PlanTag({ block }: { block: NormalizedBlock }) {
  const [expanded, setExpanded] = useState(false);
  const tool = block.tool;
  if (!tool) return null;
  const args = tool.args as Record<string, unknown> | undefined;
  const title = (args?.title as string) || (args?.summary as string) || '任务计划';
  const steps = Array.isArray(args?.steps) ? args.steps : Array.isArray(args?.tasks) ? args.tasks : [];

  return (
    <div className="my-0.5">
      <div
        className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-muted/15 rounded select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ListTodo className="h-3 w-3 text-violet-500 shrink-0" />
        <span className="text-[11px] font-medium text-violet-500">{title}</span>
        {steps.length > 0 && (
          <span className="text-[9px] text-muted-foreground/40">{steps.length} 步</span>
        )}
        <ChevronRight
          className={cn(
            "h-2.5 w-2.5 text-muted-foreground/30 shrink-0 transition-transform duration-200 ease-out",
          )}
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </div>
      {expanded && steps.length > 0 && (
        <div className="ml-5 tree-connector space-y-0.5 mt-0.5">
          {steps.map((step: unknown, i: number) => {
            const s = step as Record<string, unknown>;
            return (
              <div key={i} className="flex items-start gap-1.5 text-[10px]">
                <span className="shrink-0 w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[8px] font-medium text-violet-600 dark:text-violet-400">
                  {i + 1}
                </span>
                <span className="text-muted-foreground/60 leading-relaxed">
                  {typeof step === 'string' ? step : (s.title || s.description || s.name || JSON.stringify(step)) as string}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
