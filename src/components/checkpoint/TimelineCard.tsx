/**
 * TimelineCard - 时间线事件卡片
 * 显示文件名、时间、操作类型、diff 统计
 */
import { useTranslation } from 'react-i18next';
import { FilePlus, FileCode, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRelativeTime } from './useRelativeTime';
import type { ChangeType } from './TimelineNode';

export interface TimelineCardData {
  id: string;
  timestamp: number;
  filePath: string;
  fileName: string;
  changeType: ChangeType;
  summary?: string;
  diffStats?: { additions: number; deletions: number };
}

interface TimelineCardProps {
  data: TimelineCardData;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

const changeTypeIcons: Record<ChangeType, React.ElementType> = {
  create: FilePlus,
  modify: FileCode,
  delete: FileX,
};

const changeTypeLabels: Record<ChangeType, string> = {
  create: '创建',
  modify: '修改',
  delete: '删除',
};

const changeTypeColors: Record<ChangeType, string> = {
  create: 'text-green-500',
  modify: 'text-blue-500',
  delete: 'text-red-500',
};

const changeTypeBgColors: Record<ChangeType, string> = {
  create: 'bg-green-500/10 border-green-500/20',
  modify: 'bg-blue-500/10 border-blue-500/20',
  delete: 'bg-red-500/10 border-red-500/20',
};

export function TimelineCard({
  data,
  isActive,
  onClick,
  className,
}: TimelineCardProps) {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime(data.timestamp);

  const Icon = changeTypeIcons[data.changeType];
  const colorClass = changeTypeColors[data.changeType];
  const bgClass = changeTypeBgColors[data.changeType];

  const totalChanges = (data.diffStats?.additions || 0) + (data.diffStats?.deletions || 0);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all duration-200',
        bgClass,
        isActive
          ? 'ring-2 ring-primary shadow-lg -translate-y-0.5'
          : 'hover:-translate-y-0.5 hover:shadow-md',
        className
      )}
    >
      {/* 文件名和类型 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4 shrink-0', colorClass)} />
        <span className="font-medium text-sm truncate flex-1">
          {data.fileName}
        </span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded shrink-0', colorClass)}>
          {t(`checkpoint.changeType.${data.changeType}`, changeTypeLabels[data.changeType])}
        </span>
      </div>

      {/* 摘要 */}
      {data.summary && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {data.summary}
        </p>
      )}

      {/* 底部：时间 + diff 统计 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {relativeTime}
        </span>

        {data.diffStats && totalChanges > 0 && (
          <div className="flex items-center gap-2 text-xs">
            {data.diffStats.additions > 0 && (
              <span className="text-green-600">+{data.diffStats.additions}</span>
            )}
            {data.diffStats.deletions > 0 && (
              <span className="text-red-600">-{data.diffStats.deletions}</span>
            )}
          </div>
        )}
      </div>

      {/* Diff 统计条 */}
      {data.diffStats && totalChanges > 0 && (
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden flex">
          {data.diffStats.additions > 0 && (
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${(data.diffStats.additions / totalChanges) * 100}%`,
              }}
            />
          )}
          {data.diffStats.deletions > 0 && (
            <div
              className="h-full bg-red-500 transition-all"
              style={{
                width: `${(data.diffStats.deletions / totalChanges) * 100}%`,
              }}
            />
          )}
        </div>
      )}
    </button>
  );
}
