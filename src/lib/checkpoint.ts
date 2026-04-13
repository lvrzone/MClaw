/**
 * Checkpoint System - 文件修改历史与回滚
 * 使用 Electron IPC 与主进程通信
 */

// 旧接口兼容类型
export interface Checkpoint {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  timestamp: number;
  sessionId: string;
  messageId?: string;
  toolCallId?: string;
  description?: string;
}

export interface CheckpointGroup {
  filePath: string;
  checkpoints: Checkpoint[];
}

export interface DiffResult {
  added: number;
  removed: number;
  unchanged: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

// 新接口类型
export interface CheckpointInfo {
  id: string;
  checkpointId: string;
  taskId: string;
  timestamp: number;
  time: string;
  comment: string;
  fileCount: number;
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalSize: number;
}

// Electron IPC 调用
async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.ipcRenderer?.invoke) {
    return (window as any).electronAPI.ipcRenderer.invoke(channel, ...args);
  }
  throw new Error('Electron IPC not available');
}

/**
 * 创建 Checkpoint
 */
export async function createCheckpoint(
  taskId: string,
  comment?: string,
  projectDir?: string
): Promise<{ success: boolean; checkpoint?: { id: string; taskId: string; timestamp: number; comment: string; fileCount: number }; error?: string }> {
  return ipcInvoke('checkpoint:create', { taskId, comment, projectDir });
}

/**
 * 获取任务的所有 Checkpoint
 */
export async function getCheckpoints(taskId: string): Promise<{ success: boolean; checkpoints: CheckpointInfo[]; error?: string }> {
  return ipcInvoke('checkpoint:list', taskId);
}

/**
 * 获取单个 Checkpoint
 */
export async function getCheckpoint(checkpointId: string): Promise<{ success: boolean; checkpoint?: { id: string; taskId: string; timestamp: number; comment: string; files: string[] }; error?: string }> {
  return ipcInvoke('checkpoint:get', checkpointId);
}

/**
 * 回滚到指定 Checkpoint
 */
export async function rollbackCheckpoint(
  checkpointId: string,
  projectDir?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return ipcInvoke('checkpoint:rollback', { checkpointId, projectDir });
}

/**
 * 删除 Checkpoint
 */
export async function deleteCheckpoint(checkpointId: string): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke('checkpoint:delete', checkpointId);
}

/**
 * 获取 Checkpoint 统计信息
 */
export async function getCheckpointStats(): Promise<{ success: boolean; stats?: CheckpointStats; error?: string }> {
  return ipcInvoke('checkpoint:stats');
}

// ============ 兼容旧接口 ============

// 内存存储（兼容旧接口）
let memoryCheckpoints: Checkpoint[] = [];

/**
 * 兼容：获取文件的所有 Checkpoint
 * @deprecated 使用新的项目级 Checkpoint API
 */
export async function getCheckpointsForFile(filePath: string): Promise<Checkpoint[]> {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return memoryCheckpoints
    .filter(cp => cp.filePath === normalizedPath)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 兼容：获取所有 Checkpoint，按文件分组
 * @deprecated 使用新的项目级 Checkpoint API
 */
export async function getAllCheckpointsGrouped(): Promise<CheckpointGroup[]> {
  const grouped = new Map<string, Checkpoint[]>();

  for (const cp of memoryCheckpoints) {
    const existing = grouped.get(cp.filePath) || [];
    existing.push(cp);
    grouped.set(cp.filePath, existing);
  }

  return Array.from(grouped.entries())
    .map(([filePath, checkpoints]) => ({
      filePath,
      checkpoints: checkpoints.sort((a, b) => b.timestamp - a.timestamp),
    }))
    .sort((a, b) => b.checkpoints[0]?.timestamp - a.checkpoints[0]?.timestamp);
}

/**
 * 兼容：回滚到指定 Checkpoint
 * @deprecated 使用 rollbackCheckpoint 替代
 */
export async function rollbackToCheckpoint(checkpointId: string): Promise<boolean> {
  const checkpoint = memoryCheckpoints.find(cp => cp.id === checkpointId);
  if (!checkpoint) return false;

  try {
    // 使用 host API 写入原始内容
    const result = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: checkpoint.filePath,
        content: checkpoint.originalContent,
      }),
    }).then(r => r.json());

    return result.success;
  } catch (error) {
    console.error('Failed to rollback checkpoint:', error);
    return false;
  }
}

/**
 * 兼容：清空所有 Checkpoint
 * @deprecated 使用新的项目级 Checkpoint API
 */
export async function clearAllCheckpoints(): Promise<void> {
  memoryCheckpoints = [];
}

/**
 * 兼容：获取会话相关的所有 Checkpoint
 */
export async function getCheckpointsForSession(sessionId: string): Promise<Checkpoint[]> {
  return memoryCheckpoints
    .filter(cp => cp.sessionId === sessionId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 兼容：对比两个 Checkpoint 的差异
 */
export function diffCheckpoints(
  oldCheckpoint: Checkpoint,
  newCheckpoint: Checkpoint
): DiffResult {
  return computeDiff(oldCheckpoint.modifiedContent, newCheckpoint.modifiedContent);
}

/**
 * 兼容：对比 Checkpoint 与当前文件
 */
export async function diffCheckpointWithCurrent(checkpoint: Checkpoint): Promise<DiffResult> {
  try {
    const result = await fetch(`/api/files/read?path=${encodeURIComponent(checkpoint.filePath)}`).then(r => r.json());
    return computeDiff(checkpoint.modifiedContent, result.content || '');
  } catch {
    return computeDiff(checkpoint.modifiedContent, '');
  }
}

/**
 * 兼容：在写入前创建 Checkpoint
 */
export async function checkpointBeforeWrite(
  filePath: string,
  newContent: string,
  sessionId: string,
  metadata?: {
    messageId?: string;
    toolCallId?: string;
    description?: string;
  }
): Promise<Checkpoint | null> {
  try {
    // 读取当前文件内容
    const result = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`).then(r => r.json());

    // 如果文件不存在或内容相同，不创建 checkpoint
    if (!result.exists || result.content === newContent) {
      return null;
    }

    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath: filePath.replace(/\\/g, '/'),
      originalContent: result.content,
      modifiedContent: newContent,
      timestamp: Date.now(),
      sessionId,
      ...metadata,
      description: metadata?.description || `修改文件: ${filePath.split('/').pop()}`,
    };

    memoryCheckpoints.unshift(checkpoint);

    // 限制数量
    if (memoryCheckpoints.length > 100) {
      memoryCheckpoints.splice(100);
    }

    return checkpoint;
  } catch (error) {
    console.error('Failed to create checkpoint:', error);
    return null;
  }
}

// ============ 内部辅助函数 ============

function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const hunks: DiffHunk[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const { lines, oldStart, newStart } = diffLines(oldLines, newLines);

  for (const line of lines) {
    if (line.type === 'added') added++;
    else if (line.type === 'removed') removed++;
    else unchanged++;
  }

  if (lines.length > 0) {
    hunks.push({
      oldStart: oldStart + 1,
      oldLines: oldLines.length,
      newStart: newStart + 1,
      newLines: newLines.length,
      lines,
    });
  }

  return { added, removed, unchanged, hunks };
}

function diffLines(
  oldLines: string[],
  newLines: string[]
): { lines: DiffLine[]; oldStart: number; newStart: number } {
  const lines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let oldStart = 0;
  let newStart = 0;
  let foundDiff = false;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldLine === newLine) {
      lines.push({
        type: 'unchanged',
        content: oldLine || '',
        lineNumber: oldIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else {
      if (!foundDiff) {
        oldStart = oldIdx;
        newStart = newIdx;
        foundDiff = true;
      }

      const nextMatchInNew = newLines.slice(newIdx + 1).indexOf(oldLine);
      const nextMatchInOld = oldLines.slice(oldIdx + 1).indexOf(newLine);

      if (oldLine !== undefined && (nextMatchInNew === -1 || (nextMatchInOld !== -1 && nextMatchInOld < nextMatchInNew))) {
        lines.push({
          type: 'removed',
          content: oldLine,
          lineNumber: oldIdx + 1,
        });
        oldIdx++;
      } else if (newLine !== undefined) {
        lines.push({
          type: 'added',
          content: newLine,
          lineNumber: newIdx + 1,
        });
        newIdx++;
      } else {
        if (oldIdx < oldLines.length) {
          lines.push({
            type: 'removed',
            content: oldLines[oldIdx],
            lineNumber: oldIdx + 1,
          });
          oldIdx++;
        }
        if (newIdx < newLines.length) {
          lines.push({
            type: 'added',
            content: newLines[newIdx],
            lineNumber: newIdx + 1,
          });
          newIdx++;
        }
      }
    }
  }

  return { lines, oldStart, newStart };
}
