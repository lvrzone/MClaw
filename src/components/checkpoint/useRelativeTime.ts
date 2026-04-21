/**
 * useRelativeTime - 相对时间 Hook
 * 将 timestamp 转换为 "刚刚", "3分钟前", "1小时前" 等相对时间
 * 每分钟自动更新
 */
import { useState, useEffect, useCallback } from 'react';

interface UseRelativeTimeOptions {
  /** 最小更新间隔（毫秒），默认 60000 (1分钟) */
  updateInterval?: number;
}

export function useRelativeTime(
  timestamp: number,
  options: UseRelativeTimeOptions = {}
): string {
  const { updateInterval = 60000 } = options;

  const [relativeTime, setRelativeTime] = useState(() => computeRelativeTime(timestamp));

  const compute = useCallback(() => {
    setRelativeTime(computeRelativeTime(timestamp));
  }, [timestamp]);

  useEffect(() => {
    compute();

    const timer = setInterval(compute, updateInterval);
    return () => clearInterval(timer);
  }, [compute, updateInterval]);

  return relativeTime;
}

function computeRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${seconds}秒前`;
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (weeks < 4) return `${weeks}周前`;
  if (months < 12) return `${months}个月前`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 格式化绝对时间
 */
export function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 按时间分组 checkpoints
 */
export interface TimeGroup {
  label: string;
  checkpoints: Array<{
    id: string;
    timestamp: number;
    filePath: string;
    fileName: string;
    changeType: 'create' | 'modify' | 'delete';
    summary?: string;
    diffStats?: { additions: number; deletions: number };
    originalContent?: string;
    modifiedContent?: string;
  }>;
}

export function groupCheckpointsByTime(
  checkpoints: Array<{
    id: string;
    timestamp: number;
    filePath: string;
    changeType: 'create' | 'modify' | 'delete';
    summary?: string;
    diffStats?: { additions: number; deletions: number };
    originalContent?: string;
    modifiedContent?: string;
  }>,
  maxItems: number = 50
): TimeGroup[] {
  if (checkpoints.length === 0) return [];

  // 按时间倒序排列
  const sorted = [...checkpoints].sort((a, b) => b.timestamp - a.timestamp);

  // 限制数量
  const limited = sorted.slice(0, maxItems);

  const groups: TimeGroup[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeek = new Date(today.getTime() - 7 * 86400000);

  for (const cp of limited) {
    const cpDate = new Date(cp.timestamp);
    let label: string;

    if (cpDate >= today) {
      label = '今天';
    } else if (cpDate >= yesterday) {
      label = '昨天';
    } else if (cpDate >= thisWeek) {
      label = '本周';
    } else {
      label = cpDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    const existingGroup = groups.find((g) => g.label === label);
    if (existingGroup) {
      existingGroup.checkpoints.push({
        ...cp,
        fileName: cp.filePath.split('/').pop() || cp.filePath,
      });
    } else {
      groups.push({
        label,
        checkpoints: [
          {
            ...cp,
            fileName: cp.filePath.split('/').pop() || cp.filePath,
          },
        ],
      });
    }
  }

  return groups;
}
