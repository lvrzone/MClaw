/**
 * MClaw Task Progress Panel
 * 显示任务执行过程中的关键节点和进度
 */
import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  X,
  Sparkles,
  FileCode,
  Terminal,
  Globe,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskStep {
  id: string;
  icon?: React.ReactNode;
  label: string;
  status: TaskStepStatus;
  timestamp?: number;
  detail?: string;
}

interface TaskProgressPanelProps {
  title?: string;
  steps: TaskStep[];
  currentStepId?: string;
  onStepClick?: (stepId: string) => void;
  autoCollapse?: boolean;
  defaultCollapsed?: boolean;
}

const statusConfig = {
  pending: {
    icon: <Circle className="h-2.5 w-2.5 text-gray-400" />,
    bg: 'bg-gray-100',
    text: 'text-gray-500',
  },
  running: {
    icon: <Loader2 className="h-2.5 w-2.5 text-blue-500 animate-spin" />,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  completed: {
    icon: <CheckCircle className="h-2.5 w-2.5 text-green-500" />,
    bg: 'bg-green-50',
    text: 'text-green-600',
  },
  failed: {
    icon: <X className="h-2.5 w-2.5 text-red-500" />,
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
};

export function TaskProgressPanel({
  title = '任务',
  steps,
  currentStepId,
  onStepClick,
  autoCollapse = false,
  defaultCollapsed = false,
}: TaskProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed || steps.length === 0);
  const [showDetails, setShowDetails] = useState(false);
  
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep = steps.find(s => s.status === 'running' || s.id === currentStepId);

  // 自动收起（当所有任务完成时）
  useEffect(() => {
    if (autoCollapse && completedCount === totalCount && totalCount > 0) {
      const timer = setTimeout(() => setCollapsed(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [autoCollapse, completedCount, totalCount]);

  if (steps.length === 0) {
    // 无任务时显示极简占位
    return (
      <div
        className="rounded-lg overflow-hidden transition-all duration-200 border border-gray-200/30"
        style={{ background: 'rgba(255,255,255,0.9)' }}
      >
        <div 
          className="flex items-center justify-between px-2 py-1.5 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-gray-400" />
            <span className="text-[10px] text-gray-400">{title}</span>
          </div>
          {collapsed ? (
            <ChevronDown className="h-3 w-3 text-gray-300" />
          ) : (
            <ChevronUp className="h-3 w-3 text-gray-300" />
          )}
        </div>
        {!collapsed && (
          <div className="px-2 pb-2">
            <p className="text-[10px] text-gray-400 text-center py-2">暂无任务</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-200',
        'border border-gray-200/30 shadow-sm'
      )}
      style={{ background: 'rgba(255,255,255,0.95)' }}
    >
      {/* 头部 - 极简 */}
      <div 
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer"
        style={{ background: 'rgba(59,130,246,0.03)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
            {title}
          </span>
          {currentStep && (
            <span className="text-[9px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-600">
              进行中
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono" style={{ color: 'var(--theme-text-muted)' }}>
            {completedCount}/{totalCount}
          </span>
          {collapsed ? (
            <ChevronDown className="h-3 w-3" style={{ color: 'var(--theme-text-muted)' }} />
          ) : (
            <ChevronUp className="h-3 w-3" style={{ color: 'var(--theme-text-muted)' }} />
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {!collapsed && (
        <div className="px-2 py-1.5 space-y-0.5">
          {/* 进度条 */}
          <div className="h-0.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${progressPercent}%`,
                background: progressPercent === 100 
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              }}
            />
          </div>

          {/* 步骤列表 */}
          <div className="space-y-0.5">
            {steps.slice(-5).map((step) => {
              const config = statusConfig[step.status];
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-start gap-1.5 px-1.5 py-1 rounded transition-all duration-150',
                    step.status === 'running' && 'bg-blue-50',
                    step.status === 'completed' && 'bg-green-50/30',
                    step.status === 'failed' && 'bg-red-50/30',
                    onStepClick && 'cursor-pointer',
                  )}
                  onClick={() => step.detail && setShowDetails(!showDetails)}
                >
                  <div className="shrink-0 mt-0.5">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-[10px] font-medium truncate block', config.text)}>
                      {step.label}
                    </span>
                    {showDetails && step.detail && (
                      <p className="text-[9px] mt-0.5 p-1 rounded bg-white/50 font-mono truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 预设图标
export const TaskIcons = {
  code: <FileCode className="h-3.5 w-3.5" />,
  terminal: <Terminal className="h-3.5 w-3.5" />,
  web: <Globe className="h-3.5 w-3.5" />,
  database: <Database className="h-3.5 w-3.5" />,
  sparkle: <Sparkles className="h-3.5 w-3.5" />,
};
