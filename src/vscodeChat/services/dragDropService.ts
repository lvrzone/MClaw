/**
 * PendingDragDrop - 待处理拖拽状态持久化
 * 对齐 VS Code chatPendingDragAndDrop.ts
 *
 * 功能：
 * - 拖拽开始 → 记录状态
 * - 页面刷新后恢复拖拽状态
 * - 拖拽完成 → 清除状态
 */
import { useCallback, useEffect, useRef } from 'react';

export interface DragState {
  isDragging: boolean;
  files: File[];
  text?: string;
  timestamp: number;
}

const PENDING_DRAG_KEY = 'mclaw-pending-drag';

export function usePendingDragDrop() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 开始拖拽 — 记录状态 */
  const startDrag = useCallback((files: File[], text?: string) => {
    const state: DragState = {
      isDragging: true,
      files,
      text,
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(PENDING_DRAG_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, []);

  /** 完成拖拽 — 清除状态 */
  const endDrag = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_DRAG_KEY);
    } catch { /* ignore */ }
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  /** 读取待处理拖拽 */
  const getPendingDrag = useCallback((): DragState | null => {
    try {
      const raw = sessionStorage.getItem(PENDING_DRAG_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as DragState;
      // 过期 30s
      if (Date.now() - state.timestamp > 30000) {
        sessionStorage.removeItem(PENDING_DRAG_KEY);
        return null;
      }
      return state;
    } catch {
      return null;
    }
  }, []);

  /** 恢复拖拽状态（启动时） */
  useEffect(() => {
    const pending = getPendingDrag();
    if (pending) {
      // 30s 后自动过期
      timerRef.current = setTimeout(() => {
        endDrag();
      }, 30000 - (Date.now() - pending.timestamp));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [getPendingDrag, endDrag]);

  return { startDrag, endDrag, getPendingDrag };
}

export default usePendingDragDrop;
