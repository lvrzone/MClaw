/**
 * Checkpoint Panel - 文件修改历史与回滚面板
 */
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  FileCode,
  Clock,
  AlertCircle,
  Check,
  FileText,
  FileClock,
  List,
  Activity,
} from 'lucide-react';
import { DiffView } from '@/components/DiffView';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCheckpointStore } from '@/stores/checkpoint';
import { CheckpointTimeline, type CheckpointTimelineData } from './CheckpointTimeline';
import type { ChangeType } from './TimelineNode';

interface CheckpointPanelProps {
  className?: string;
}

export function CheckpointPanel({ className }: CheckpointPanelProps) {
  const { t } = useTranslation();
  const {
    groups,
    currentFilePath,
    selectedCheckpoint,
    diffResult,
    isPanelOpen,
    isLoading,
    error,
    selectFile,
    rollback,
    deleteCheckpointById,
    clearAll,
    closePanel,
  } = useCheckpointStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmRollback, setShowConfirmRollback] = useState<string | null>(null);
  const [batchRollbackProgress] = useState<{ current: number; total: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // 转换为时间线数据格式
  const timelineData: CheckpointTimelineData[] = useMemo(() => {
    const allCheckpoints: CheckpointTimelineData[] = [];

    for (const group of groups) {
      for (const cp of group.checkpoints) {
        // 判断变更类型
        let changeType: ChangeType = 'modify';
        if (cp.description?.toLowerCase().includes('create') || cp.description?.toLowerCase().includes('创建')) {
          changeType = 'create';
        } else if (cp.description?.toLowerCase().includes('delete') || cp.description?.toLowerCase().includes('删除')) {
          changeType = 'delete';
        }

        // 简单估算 diff 统计（基于内容长度差异）
        let diffStats: { additions: number; deletions: number } | undefined;
        if (cp.originalContent && cp.modifiedContent) {
          const oldLines = cp.originalContent.split('\n').length;
          const newLines = cp.modifiedContent.split('\n').length;
          const diff = newLines - oldLines;
          diffStats = {
            additions: diff > 0 ? Math.abs(diff) : 0,
            deletions: diff < 0 ? Math.abs(diff) : 0,
          };
        }

        allCheckpoints.push({
          id: cp.id,
          timestamp: cp.timestamp,
          filePath: cp.filePath,
          fileName: cp.filePath.split('/').pop() || cp.filePath,
          changeType,
          summary: cp.description,
          originalContent: cp.originalContent,
          modifiedContent: cp.modifiedContent,
          diffStats,
        });
      }
    }

    // 按时间倒序
    return allCheckpoints.sort((a, b) => b.timestamp - a.timestamp);
  }, [groups]);

  useEffect(() => {
    // 初始化时展开所有组
    if (groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(groups.map((g) => g.filePath)));
    }
  }, [groups]);

  if (!isPanelOpen) return null;

  const toggleGroup = (filePath: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-96 bg-background border-l border-border shadow-xl z-50 flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileClock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('checkpoint.title', '文件修改历史')}</h2>
          {groups.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {groups.reduce((sum, g) => sum + g.checkpoints.length, 0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 视图切换 */}
          {groups.length > 0 && (
            <div className="flex items-center border rounded-md mr-2">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-r-none"
                onClick={() => setViewMode('list')}
                title={t('checkpoint.viewList', '列表视图')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-l-none"
                onClick={() => setViewMode('timeline')}
                title={t('checkpoint.viewTimeline', '时间线视图')}
              >
                <Activity className="h-4 w-4" />
              </Button>
            </div>
          )}
          {groups.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => setShowConfirmClear(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('checkpoint.clearAll', '清空')}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Batch Processing Progress */}
      {batchRollbackProgress && (
        <div className="mx-4 mt-3 p-3 bg-muted rounded-lg">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(batchRollbackProgress.current / batchRollbackProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            正在批量回滚... ({batchRollbackProgress.current}/{batchRollbackProgress.total})
          </p>
        </div>
      )}

      {/* Content */}
      {viewMode === 'timeline' && groups.length > 0 ? (
        <CheckpointTimeline
          checkpoints={timelineData}
          activeCheckpointId={selectedCheckpoint?.id}
          onSelectCheckpoint={(id) => {
            const cp = timelineData.find((c) => c.id === id);
            if (cp) {
              selectFile(cp.filePath);
            }
          }}
          onRollback={(id) => setShowConfirmRollback(id)}
        />
      ) : groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
          <FileClock className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm">{t('checkpoint.empty', '暂无文件修改历史')}</p>
          <p className="text-xs mt-1 opacity-60">
            {t('checkpoint.emptyHint', 'AI 修改文件时会自动保存历史版本')}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: File List */}
          <ScrollArea className="w-1/2 border-r border-border">
            <div className="p-2 space-y-1">
              {groups.map((group) => (
                <div key={group.filePath}>
                  <button
                    onClick={() => toggleGroup(group.filePath)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors',
                      currentFilePath === group.filePath
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    {expandedGroups.has(group.filePath) ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <FileCode className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">
                      {group.filePath.split('/').pop()}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {group.checkpoints.length}
                    </span>
                  </button>

                  {expandedGroups.has(group.filePath) && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {group.checkpoints.map((cp) => (
                        <button
                          key={cp.id}
                          onClick={() => selectFile(group.filePath)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors',
                            selectedCheckpoint?.id === cp.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted text-muted-foreground'
                          )}
                        >
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate flex-1">{formatTime(cp.timestamp)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Right: Diff View */}
          <div className="w-1/2 flex flex-col">
            {selectedCheckpoint ? (
              <>
                {/* Checkpoint Info */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">
                      {selectedCheckpoint.filePath.split('/').pop()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {formatTime(selectedCheckpoint.timestamp)} · {formatRelativeTime(selectedCheckpoint.timestamp)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-7 text-xs"
                      onClick={() => setShowConfirmRollback(selectedCheckpoint.id)}
                      disabled={isLoading}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t('checkpoint.rollback', '回滚')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => deleteCheckpointById(selectedCheckpoint.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Diff Stats */}
                {diffResult && (
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">+{diffResult.added}</span>
                      <span className="text-red-600">-{diffResult.removed}</span>
                      <span className="text-muted-foreground">{diffResult.unchanged} 未变</span>
                    </div>
                  </div>
                )}

                {/* Diff Content */}
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-3">
                    {diffResult?.hunks.map((hunk, hunkIdx) => (
                      <div key={hunkIdx}>
                        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded mb-2">
                          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                        </div>
                        {hunk.lines.map((line, lineIdx) => (
                          line.type !== 'unchanged' && (
                            <DiffView
                              key={lineIdx}
                              oldCode={line.type === 'removed' ? line.content : ''}
                              newCode={line.type === 'added' ? line.content : ''}
                            />
                          )
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">{t('checkpoint.selectCheckpoint', '选择历史版本查看差异')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background border border-border rounded-xl p-4 max-w-sm w-full shadow-lg">
            <h3 className="font-semibold mb-2">{t('checkpoint.confirmClearTitle', '清空所有历史')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('checkpoint.confirmClearDesc', '确定要删除所有文件修改历史吗？此操作不可恢复。')}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmClear(false)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await clearAll();
                  setShowConfirmClear(false);
                }}
              >
                {t('common.confirm', '确认')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Rollback Dialog */}
      {showConfirmRollback && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background border border-border rounded-xl p-4 max-w-sm w-full shadow-lg">
            <h3 className="font-semibold mb-2">{t('checkpoint.confirmRollbackTitle', '回滚文件')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('checkpoint.confirmRollbackDesc', '确定要回滚到这个版本吗？当前文件内容将被替换。')}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmRollback(null)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  if (showConfirmRollback) {
                    await rollback(showConfirmRollback);
                    setShowConfirmRollback(null);
                  }
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                {t('common.confirm', '确认')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
