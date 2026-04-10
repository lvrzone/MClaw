/**
 * Task Plan Panel - 任务计划分解展示 v2.0
 * 增强版：支持阶段性反馈、进度追踪、实时状态更新
 */
import { useState, useEffect } from 'react';
import { 
  Target,
  ListTodo,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  FileSearch,
  Search,
  Settings,
  AlertCircle,
  Layers,
  Zap,
  Brain,
  FileCode,
  Terminal,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'error';
export type TaskPhase = 'analyzing' | 'planning' | 'executing' | 'verifying' | 'done';

export interface TaskPlanStep {
  id: string;
  label: string;
  status: TaskStepStatus;
  icon?: string;
  detail?: string;
  phase?: TaskPhase; // 所属阶段
  startTime?: number; // 开始时间
  duration?: number; // 持续时间
}

export interface TaskPlanProgress {
  phase: TaskPhase;
  phaseLabel: string;
  phaseProgress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

interface TaskPlanPanelProps {
  userGoal?: string;
  steps: TaskPlanStep[];
  isStreaming?: boolean;
  compact?: boolean;
}

// 阶段配置 - 不同阶段的颜色和图标
export const phaseConfig: Record<TaskPhase, {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
}> = {
  analyzing: {
    icon: Brain,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    label: '分析中',
  },
  planning: {
    icon: Target,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    label: '规划中',
  },
  executing: {
    icon: Zap,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    label: '执行中',
  },
  verifying: {
    icon: Eye,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: '验证中',
  },
  done: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: '已完成',
  },
};

const stepIcons: Record<string, React.ReactNode> = {
  'analyze': <Brain className="h-3 w-3" />,
  'analysis': <Brain className="h-3 w-3" />,
  'search': <Search className="h-3 w-3" />,
  'code': <FileCode className="h-3 w-3" />,
  'write': <FileCode className="h-3 w-3" />,
  'read': <FileSearch className="h-3 w-3" />,
  'config': <Settings className="h-3 w-3" />,
  'build': <Terminal className="h-3 w-3" />,
  'test': <Search className="h-3 w-3" />,
  'deploy': <Settings className="h-3 w-3" />,
  'aggregate': <Layers className="h-3 w-3" />,
  'verify': <Eye className="h-3 w-3" />,
  'refresh': <RefreshCw className="h-3 w-3" />,
  'default': <Bot className="h-3 w-3" />,
};

function getIconForStep(label: string): React.ReactNode {
  const lowerLabel = label.toLowerCase();
  for (const [key, icon] of Object.entries(stepIcons)) {
    if (lowerLabel.includes(key)) {
      return icon;
    }
  }
  return stepIcons['default'];
}

const statusConfig = {
  pending: {
    icon: Circle,
    bg: 'bg-gray-100/60 dark:bg-gray-800/40',
    border: 'border-gray-200/50 dark:border-gray-700/50',
    text: 'text-gray-500',
    dot: 'bg-gray-300',
    pulse: false,
  },
  running: {
    icon: Loader2,
    bg: 'bg-gradient-to-r from-blue-50/60 to-blue-100/40 dark:from-blue-900/30 dark:to-blue-800/20',
    border: 'border-blue-300/60 dark:border-blue-700/40',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
    pulse: true,
  },
  completed: {
    icon: CheckCircle2,
    bg: 'bg-gradient-to-r from-green-50/50 to-green-100/30 dark:from-green-900/20 dark:to-green-800/10',
    border: 'border-green-200/60 dark:border-green-700/40',
    text: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
    pulse: false,
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-gradient-to-r from-red-50/50 to-red-100/30 dark:from-red-900/20 dark:to-red-800/10',
    border: 'border-red-200/60 dark:border-red-700/40',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    pulse: false,
  },
};

// 从消息中提取任务目标
export function extractTaskGoal(messages: Array<{ role: string; content: string | unknown }>): string | undefined {
  // 找到用户的第一条消息作为任务目标
  const userMessage = messages.find(msg => msg.role === 'user');
  if (!userMessage) return undefined;

  let text = '';
  if (typeof userMessage.content === 'string') {
    text = userMessage.content;
  } else if (Array.isArray(userMessage.content)) {
    text = userMessage.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n');
  }

  if (!text) return undefined;
  
  // 限制长度
  if (text.length > 100) {
    return text.slice(0, 100) + '...';
  }
  return text;
}

// 从工具调用中推断任务步骤
export function inferTaskSteps(
  tools: Array<{ name: string; input?: Record<string, unknown> }>,
  completedTools: Array<{ name: string; summary?: string }>
): TaskPlanStep[] {
  const steps: TaskPlanStep[] = [];
  const seenIds = new Set<string>();

  // 添加已完成工具
  completedTools.forEach((tool, idx) => {
    const id = `completed-${tool.name}-${idx}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    
    steps.push({
      id,
      label: formatToolName(tool.name),
      status: 'completed',
      detail: tool.summary,
    });
  });

  // 添加正在运行的工具
  tools.forEach((tool, idx) => {
    const id = `running-${tool.name}-${idx}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    // 检查是否已经标记为完成
    const alreadyCompleted = completedTools.some((ct, ci) => 
      `completed-${ct.name}-${ci}` === id
    );
    if (alreadyCompleted) return;

    steps.push({
      id,
      label: formatToolName(tool.name),
      status: 'running',
    });
  });

  return steps;
}

function formatToolName(name: string): string {
  // 将 tool_name 转换为 "Tool Name"
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export function TaskPlanPanel({ 
  userGoal, 
  steps, 
  isStreaming = false,
  compact = false 
}: TaskPlanPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showGoal, setShowGoal] = useState(true);
  
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const totalCount = steps.length;
  const currentStep = steps.find(s => s.status === 'running');
  const hasActivity = isStreaming || steps.length > 0;

  // 计算进度百分比
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 自动展开当有活动时
  useEffect(() => {
    if (hasActivity && collapsed) {
      setCollapsed(false);
    }
  }, [hasActivity]);

  // 如果没有任何内容且未展开，不渲染
  if (!hasActivity && collapsed) return null;

  return (
    <div 
      className={cn(
        "rounded-xl overflow-hidden transition-all duration-300",
        "bg-white/90 dark:bg-zinc-900/90",
        "border border-black/5 dark:border-white/10",
        "backdrop-blur-xl shadow-sm",
        compact ? "mx-2 mb-2" : "mx-4 mb-4"
      )}
    >
      {/* 头部 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-semibold text-foreground">任务计划</span>
          
          {hasActivity && (
            <span 
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                isStreaming 
                  ? "bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 animate-pulse"
                  : completedCount === totalCount && totalCount > 0
                    ? "bg-green-100/80 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                    : "bg-gray-100/80 dark:bg-gray-800/60 text-gray-500"
              )}
            >
              {isStreaming 
                ? '🔄 执行中' 
                : completedCount === totalCount && totalCount > 0
                  ? '✅ 已完成'
                  : `${completedCount}/${totalCount}`
              }
            </span>
          )}
        </div>
        
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* 进度条 - 当有步骤时显示 */}
      {totalCount > 0 && !collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>进度</span>
            <span className="font-medium text-foreground">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isStreaming 
                  ? "bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"
                  : completedCount === totalCount
                    ? "bg-gradient-to-r from-green-400 to-green-600"
                    : "bg-gradient-to-r from-blue-400 to-blue-600"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 内容区 */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {/* 任务目标 */}
          {userGoal && (
            <div className="space-y-1.5">
              <button
                onClick={() => setShowGoal(!showGoal)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>目标</span>
              </button>
              
              {showGoal && (
                <div 
                  className={cn(
                    "px-2.5 py-2 rounded-lg text-[11px] leading-relaxed",
                    "bg-gradient-to-r from-primary/5 to-transparent",
                    "border-l-2 border-primary/30",
                    "text-foreground/80"
                  )}
                >
                  {userGoal}
                </div>
              )}
            </div>
          )}

          {/* 当前执行阶段高亮 */}
          {currentStep && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-blue-50/80 dark:bg-blue-900/30",
              "border border-blue-200/50 dark:border-blue-800/50",
              "animate-pulse"
            )}>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  正在执行
                </span>
              </div>
              <span className="text-[11px] text-foreground/80 truncate flex-1">
                {currentStep.label}
              </span>
              {currentStep.detail && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                  {currentStep.detail}
                </span>
              )}
            </div>
          )}

          {/* 任务步骤 */}
          {steps.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <ListTodo className="h-3 w-3" />
                <span>执行步骤</span>
                {currentStep && (
                  <span className="text-blue-500 ml-auto">
                    → {currentStep.label}
                  </span>
                )}
              </div>
              
              <div className="space-y-0.5 pl-1">
                {steps.map((step, idx) => {
                  const config = statusConfig[step.status];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200",
                        config.bg,
                        "border",
                        config.border
                      )}
                    >
                      {/* 状态图标 */}
                      <div className={cn("shrink-0", step.status === 'running' && "animate-spin")}>
                        <Icon className={cn("h-3 w-3", config.text)} />
                      </div>
                      
                      {/* 步骤图标 */}
                      <div className="shrink-0 text-muted-foreground/60">
                        {getIconForStep(step.label)}
                      </div>
                      
                      {/* 步骤标签 */}
                      <span className={cn(
                        "text-[11px] font-medium flex-1",
                        config.text
                      )}>
                        {step.label}
                      </span>
                      
                      {/* 步骤详情 */}
                      {step.detail && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {step.detail}
                        </span>
                      )}
                      
                      {/* 序号 */}
                      <span className="text-[9px] text-muted-foreground/50">
                        #{idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 等待状态 */}
          {isStreaming && steps.length === 0 && (
            <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>分析任务中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
