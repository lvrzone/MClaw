/**
 * TimelineNode - 时间线节点组件
 * 圆点 + 连接线，根据操作类型着色
 */
import { cn } from '@/lib/utils';

export type ChangeType = 'create' | 'modify' | 'delete';

interface TimelineNodeProps {
  changeType: ChangeType;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  className?: string;
}

const changeTypeColors: Record<ChangeType, string> = {
  create: 'bg-green-500 border-green-500',
  modify: 'bg-blue-500 border-blue-500',
  delete: 'bg-red-500 border-red-500',
};

const changeTypeGlowColors: Record<ChangeType, string> = {
  create: 'shadow-[0_0_12px_rgba(34,197,94,0.6)]',
  modify: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
  delete: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
};

export function TimelineNode({
  changeType,
  isActive,
  isFirst,
  isLast,
  className,
}: TimelineNodeProps) {
  const colorClass = changeTypeColors[changeType];
  const glowClass = changeTypeGlowColors[changeType];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* 连接线 - 顶部 */}
      {!isFirst && (
        <div
          className={cn(
            'w-0.5 h-4',
            isActive ? 'bg-primary/30' : 'bg-border'
          )}
        />
      )}

      {/* 圆点节点 */}
      <div
        className={cn(
          'relative w-3 h-3 rounded-full border-2 transition-all duration-200',
          colorClass,
          isActive && [
            'scale-150',
            glowClass,
          ]
        )}
      >
        {isActive && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-pulse',
              colorClass.replace('bg-', 'bg-').replace('border-', 'border-'),
              'opacity-50'
            )}
          />
        )}
      </div>

      {/* 连接线 - 底部 */}
      {!isLast && (
        <div
          className={cn(
            'w-0.5 flex-1 min-h-[40px]',
            isActive ? 'bg-primary/30' : 'bg-border'
          )}
        />
      )}
    </div>
  );
}
