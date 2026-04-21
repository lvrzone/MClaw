/**
 * CheckpointTimeline - 时间线视图主组件
 * 垂直时间线布局（左侧时间轴 + 右侧事件卡片）
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TimelineNode, type ChangeType } from './TimelineNode';
import { TimelineCard } from './TimelineCard';
import { groupCheckpointsByTime } from './useRelativeTime';
import { DiffView } from '@/components/DiffView';

export interface CheckpointTimelineData {
  id: string;
  timestamp: number;
  filePath: string;
  fileName: string;
  changeType: ChangeType;
  summary?: string;
  diffStats?: { additions: number; deletions: number };
  originalContent?: string;
  modifiedContent?: string;
}

interface CheckpointTimelineProps {
  checkpoints: CheckpointTimelineData[];
  activeCheckpointId?: string;
  onSelectCheckpoint: (id: string) => void;
  onRollback: (id: string) => void;
  className?: string;
  maxItems?: number;
}

export function CheckpointTimeline({
  checkpoints,
  activeCheckpointId,
  onSelectCheckpoint,
  onRollback,
  className,
  maxItems = 50,
}: CheckpointTimelineProps) {
  const { t } = useTranslation();

  // 按时间分组
  const timeGroups = useMemo(() => {
    return groupCheckpointsByTime(checkpoints, maxItems);
  }, [checkpoints, maxItems]);

  // 展平所有 checkpoints 用于查找
  const allCheckpoints = useMemo(() => {
    return timeGroups.flatMap((g) => g.checkpoints);
  }, [timeGroups]);

  const activeCheckpoint = activeCheckpointId
    ? allCheckpoints.find((cp) => cp.id === activeCheckpointId)
    : null;

  // 统计信息
  const stats = useMemo(() => {
    const total = checkpoints.length;
    const creates = checkpoints.filter((cp) => cp.changeType === 'create').length;
    const modifies = checkpoints.filter((cp) => cp.changeType === 'modify').length;
    const deletes = checkpoints.filter((cp) => cp.changeType === 'delete').length;
    return { total, creates, modifies, deletes };
  }, [checkpoints]);

  if (checkpoints.length === 0) {
    return (
      <div className={cn('flex-1 flex flex-col items-center justify-center text-muted-foreground p-8', className)}>
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm">{t('checkpoint.empty', '暂无文件修改历史')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header 统计 */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {t('checkpoint.total', '共')} {stats.total} {t('checkpoint.records', '条记录')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-green-500">{stats.creates} {t('checkpoint.created', '创建')}</span>
            <span className="text-blue-500">{stats.modifies} {t('checkpoint.modified', '修改')}</span>
            <span className="text-red-500">{stats.deletes} {t('checkpoint.deleted', '删除')}</span>
          </div>
        </div>
      </div>

      {/* 时间线内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：时间线 */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {timeGroups.map((group, groupIdx) => (
              <div key={group.label} className="mb-6">
                {/* 时间分组标题 */}
                <div className="text-xs font-medium text-muted-foreground mb-3 ml-4">
                  {group.label}
                </div>

                {/* 该组内的 checkpoints */}
                <div className="space-y-3">
                  {group.checkpoints.map((checkpoint, idx) => (
                    <div key={checkpoint.id} className="flex gap-3">
                      {/* 时间轴节点 */}
                      <TimelineNode
                        changeType={checkpoint.changeType}
                        isActive={checkpoint.id === activeCheckpointId}
                        isFirst={idx === 0 && groupIdx === 0}
                        isLast={
                          idx === group.checkpoints.length - 1 &&
                          groupIdx === timeGroups.length - 1
                        }
                      />

                      {/* 事件卡片 */}
                      <div className="flex-1">
                        <TimelineCard
                          data={checkpoint}
                          isActive={checkpoint.id === activeCheckpointId}
                          onClick={() => onSelectCheckpoint(checkpoint.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {checkpoints.length >= maxItems && (
              <div className="text-center text-xs text-muted-foreground py-4">
                {t('checkpoint.maxReached', '仅显示最近')} {maxItems} {t('checkpoint.items', '条')}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 右侧：选中项详情 */}
        {activeCheckpoint && (
          <div className="w-80 border-l border-border flex flex-col bg-muted/10">
            {/* 详情头部 */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium truncate">
                  {activeCheckpoint.fileName}
                </span>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => onRollback(activeCheckpoint.id)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('checkpoint.rollback', '回滚')}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {activeCheckpoint.filePath}
              </div>
            </div>

            {/* Diff 预览 */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {activeCheckpoint.diffStats && (
                  <div className="flex items-center gap-3 text-xs mb-3">
                    <span className="text-green-600">
                      +{activeCheckpoint.diffStats.additions}
                    </span>
                    <span className="text-red-600">
                      -{activeCheckpoint.diffStats.deletions}
                    </span>
                  </div>
                )}

                {activeCheckpoint.originalContent && activeCheckpoint.modifiedContent && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('checkpoint.changes', '变更内容')}:
                    </div>
                    {activeCheckpoint.originalContent
                      .split('\n')
                      .slice(0, 20)
                      .map((line, idx) => {
                        const modifiedLines = activeCheckpoint.modifiedContent!.split('\n');
                        const isAdded = modifiedLines.includes(line);
                        const isRemoved = !modifiedLines.includes(line);

                        return (
                          <DiffView
                            key={idx}
                            oldCode={isRemoved ? line : ''}
                            newCode={isAdded ? line : ''}
                          />
                        );
                      })}
                    {activeCheckpoint.originalContent.split('\n').length > 20 && (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        ...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
