/**
 * SessionService - 会话管理服务
 * 对齐 VS Code agentSessions/ (15个文件，简化版)
 *
 * 功能：
 * - 会话列表管理（增删改查）
 * - 会话过滤与排序
 * - 会话搜索（快速访问）
 * - 会话收藏 / 固定
 * - 自动保存
 * - 归档管理
 */
import { useState, useCallback, useEffect, useRef } from 'react';

// ============ 类型 ============
export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
  isPinned?: boolean;
  isActive?: boolean;
  agentId?: string;
  messageCount: number;
  preview?: string;        // 最后一条消息预览
  tags?: string[];
  model?: string;          // 使用的模型
}

export type SortOrder = 'updated' | 'created' | 'title';
export type FilterMode = 'all' | 'active' | 'archived' | 'pinned';

// ============ Storage ============
const STORAGE_KEY = 'mclaw-chat-sessions';
const MAX_SESSIONS = 100;

function loadFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('[SessionService] Failed to save sessions:', e);
  }
}

// ============ Hook ============
export function useSessionService() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadFromStorage());
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated');
  const [searchQuery, setSearchQuery] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖保存
  const scheduleSave = useCallback((updated: ChatSession[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveToStorage(updated), 500);
  }, []);

  // 持久化
  useEffect(() => {
    saveToStorage(sessions);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sessions]);

  // ============ CRUD ============

  /** 创建新会话 */
  const createSession = useCallback((title?: string, agentId?: string): ChatSession => {
    const now = Date.now();
    const session: ChatSession = {
      id: `session_${now}_${Math.random().toString(36).slice(2, 7)}`,
      title: title || `New Chat ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      agentId,
      messageCount: 0,
    };
    setSessions((prev) => {
      const next = prev.map((s) => ({ ...s, isActive: false }));
      return [session, ...next].slice(0, MAX_SESSIONS);
    });
    return session;
  }, []);

  /** 删除会话 */
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** 归档会话 */
  const archiveSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, isArchived: true, isActive: false } : s
      );
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** 恢复归档 */
  const restoreSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, isArchived: false } : s
      );
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** 切换固定 */
  const togglePin = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, isPinned: !s.isPinned } : s
      );
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** 切换活跃会话 */
  const setActiveSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) => ({
        ...s,
        isActive: s.id === id,
        isArchived: s.id === id ? false : s.isArchived,
      }));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  /** 更新会话元信息 */
  const updateSession = useCallback((id: string, patch: Partial<ChatSession>) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
      );
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  // ============ 查询 ============

  /** 过滤 + 排序后的会话列表 */
  const filteredSessions = useCallback((): ChatSession[] => {
    let list = [...sessions];

    // 过滤
    if (filterMode === 'active') list = list.filter((s) => !s.isArchived);
    else if (filterMode === 'archived') list = list.filter((s) => s.isArchived);
    else if (filterMode === 'pinned') list = list.filter((s) => s.isPinned);
    // 'all' → 不过滤

    // 搜索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.preview?.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // 排序
    list.sort((a, b) => {
      // 固定的永远在前
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (sortOrder === 'updated') return b.updatedAt - a.updatedAt;
      if (sortOrder === 'created') return b.createdAt - a.createdAt;
      return a.title.localeCompare(b.title);
    });

    return list;
  }, [sessions, filterMode, sortOrder, searchQuery]);

  /** 获取活跃会话 */
  const activeSession = useCallback((): ChatSession | null => {
    return sessions.find((s) => s.isActive) ?? null;
  }, [sessions]);

  /** 获取会话数统计 */
  const sessionStats = useCallback(() => ({
    total: sessions.length,
    active: sessions.filter((s) => !s.isArchived).length,
    archived: sessions.filter((s) => s.isArchived).length,
    pinned: sessions.filter((s) => s.isPinned).length,
  }), [sessions]);

  return {
    sessions,
    filterMode,
    sortOrder,
    searchQuery,
    setFilterMode,
    setSortOrder,
    setSearchQuery,
    createSession,
    deleteSession,
    archiveSession,
    restoreSession,
    togglePin,
    setActiveSession,
    updateSession,
    filteredSessions,
    activeSession,
    sessionStats,
  };
}

export default useSessionService;
