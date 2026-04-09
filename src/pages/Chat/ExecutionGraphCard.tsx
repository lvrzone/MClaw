import { ArrowDown, ArrowUp, Bot, CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskStep } from './task-visualization';
import { memo, useMemo } from 'react';

interface ExecutionGraphCardProps {
  agentLabel: string;
  sessionLabel: string;
  steps: TaskStep[];
  active: boolean;
  onJumpToTrigger?: () => void;
  onJumpToReply?: () => void;
}

// 精细化 memo 比较
function arePropsEqual(prev: ExecutionGraphCardProps, next: ExecutionGraphCardProps): boolean {
  return (
    prev.agentLabel === next.agentLabel &&
    prev.sessionLabel === next.sessionLabel &&
    prev.active === next.active &&
    prev.steps.length === next.steps.length &&
    prev.steps.every((step, i) => step.status === next.steps[i].status && step.label === next.steps[i].label)
  );
}

function GraphStatusIcon({ status }: { status: TaskStep['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="h-2.5 w-2.5" />;
  if (status === 'error') return <XCircle className="h-2.5 w-2.5" />;
  if (status === 'running') return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
  return <CircleDashed className="h-2.5 w-2.5" />;
}

export const ExecutionGraphCard = memo(function ExecutionGraphCard({
  agentLabel,
  sessionLabel,
  steps,
  active,
  onJumpToTrigger,
  onJumpToReply,
}: ExecutionGraphCardProps) {
  // 优化：使用 useMemo 缓存显示的步骤（最多显示最近6条）
  const displaySteps = useMemo(() => steps.slice(-6), [steps]);
  
  // 优化：计算完成百分比
  const completedPercent = useMemo(() => {
    return Math.round((steps.filter(s => s.status === 'completed').length / Math.max(steps.length, 1)) * 100);
  }, [steps]);
  
  return (
    <div
      data-testid="chat-execution-graph"
      className={cn(
        "w-full rounded-xl border p-3 will-change-transform",
        active 
          ? "border-blue-200/50 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-900/10" 
          : "border-gray-200/50 bg-white/40 dark:border-white/10 dark:bg-white/[0.02]"
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3 w-3" style={{ color: 'var(--theme-accent-blue)' }} />
          <span className="text-[11px] font-medium">{agentLabel}</span>
        </div>
        <span
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full",
            active 
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" 
              : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
          )}
        >
          {active ? '进行中' : '已完成'}
        </span>
      </div>

      {/* 微型进度条 - 动画优化 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(100,100,100,0.1)' }}>
          <div 
            className="h-full rounded-full progress-bar"
            style={{ 
              width: `${completedPercent}%`,
              background: 'var(--text-secondary)',
              opacity: 0.3,
            }}
          />
        </div>
      </div>

      {/* 步骤列表 */}
      <div className="space-y-1">
        {displaySteps.map((step) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors duration-200",
              step.status === 'running' && "bg-blue-50 dark:bg-blue-900/20",
              step.status === 'completed' && "bg-gray-50/50 dark:bg-gray-800/20",
              step.status === 'error' && "bg-red-50/50 dark:bg-red-900/20",
            )}
          >
            <div className={cn(
              "shrink-0",
              step.status === 'completed' && "text-gray-500",
              step.status === 'running' && "text-blue-500",
              step.status === 'error' && "text-red-500",
            )}>
              <GraphStatusIcon status={step.status} />
            </div>
            <span className={cn(
              "flex-1 truncate",
              step.status === 'completed' && "text-gray-600",
              step.status === 'running' && "text-blue-600",
              step.status === 'error' && "text-red-600",
              step.status === 'pending' && "text-gray-500",
            )}>
              {step.label}
            </span>
            {step.detail && (
              <span className="text-[9px]" style={{ color: 'var(--theme-text-muted)' }}>
                {step.detail.slice(0, 20)}...
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 跳转按钮 */}
      {onJumpToTrigger && onJumpToReply && (
        <div className="flex items-center gap-3 mt-2 pt-2">
          <button
            type="button"
            onClick={onJumpToTrigger}
            className="flex items-center gap-1 text-[10px] hover:text-blue-500 transition-colors"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <ArrowUp className="h-2.5 w-2.5" />
            <span>回到问题</span>
          </button>
          <button
            type="button"
            onClick={onJumpToReply}
            className="flex items-center gap-1 text-[10px] hover:text-blue-500 transition-colors"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <ArrowDown className="h-2.5 w-2.5" />
            <span>查看回复</span>
          </button>
        </div>
      )}
    </div>
  );
}, arePropsEqual);
