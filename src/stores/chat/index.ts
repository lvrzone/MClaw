/**
 * Chat State Store - 优化版本
 * 精简重构，职责分离更清晰
 */
import { create } from 'zustand';
import { useGatewayStore } from '../gateway';
import { useAgentsStore } from '../agents';
import {
  TIME,
  SESSION,
  normalizeTimestamp,
} from '@/constants';
import {
  isDuplicateEvent,
  clearDedupeCache,
  extractAndCacheImages,
  normalizeMessageContent,
  formatSessionTitle,
} from './utils';
import {
  DEFAULT_CANONICAL_PREFIX,
  DEFAULT_SESSION_KEY,
  type ChatSession,
  type ChatState,
  type RawMessage,
} from './types';

export type {
  AttachedFileMeta,
  ChatSession,
  ContentBlock,
  RawMessage,
  ToolStatus,
} from './types';

// 模块级状态
let lastChatEventAt = 0;
let historyPollTimer: ReturnType<typeof setTimeout> | null = null;
let errorRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
let loadSessionsInFlight: Promise<void> | null = null;
let lastLoadSessionsAt = 0;
const historyLoadInFlight = new Map<string, Promise<void>>();
const lastHistoryLoadAtBySession = new Map<string, number>();

// 清理函数
const clearTimers = () => {
  if (errorRecoveryTimer) {
    clearTimeout(errorRecoveryTimer);
    errorRecoveryTimer = null;
  }
  if (historyPollTimer) {
    clearTimeout(historyPollTimer);
    historyPollTimer = null;
  }
};

// 创建 Store
export const useChatStore = create<ChatState>((set, get) => ({
  // 初始状态
  messages: [],
  loading: false,
  error: null,
  sending: false,
  activeRunId: null,
  streamingText: '',
  streamingMessage: null,
  streamingTools: [],
  pendingFinal: false,
  lastUserMessageAt: null,
  pendingToolImages: [],
  sessions: [],
  currentSessionKey: DEFAULT_SESSION_KEY,
  currentAgentId: '',
  sessionLabels: {},
  sessionCustomLabels: {},
  sessionLastActivity: {},
  sessionUnreadCounts: {},
  showThinking: false,
  thinkingLevel: null,
  lastThinking: null,
  scrollToMessageId: null,
  scrollToMessage: (messageId: string) => set({ scrollToMessageId: messageId }),
  clearScrollTarget: () => set({ scrollToMessageId: null }),

  // 加载会话列表
  loadSessions: async () => {
    const now = Date.now();
    if (now - lastLoadSessionsAt < TIME.SESSION_LOAD_MIN_INTERVAL_MS) return;
    if (loadSessionsInFlight) return loadSessionsInFlight;

    const gateway = useGatewayStore.getState();
    if (!gateway.connected || !gateway.client) {
      set({ error: 'Gateway未连接' });
      return;
    }

    loadSessionsInFlight = (async () => {
      try {
        set({ loading: true, error: null });
        const result = await gateway.rpc<{ sessions?: ChatSession[] }>('chat.sessions', {});
        const sessions = (result?.sessions || []) as ChatSession[];

        set(state => {
          const newSessions = sessions.map(s => ({
            ...s,
            key: s.key || DEFAULT_SESSION_KEY,
          }));

          // 更新活动记录
          const newActivity = { ...state.sessionLastActivity };
          newSessions.forEach(s => {
            if (s.updatedAt) {
              newActivity[s.key] = normalizeTimestamp(s.updatedAt);
            }
          });

          return {
            sessions: newSessions,
            sessionLastActivity: newActivity,
            loading: false,
          };
        });

        lastLoadSessionsAt = Date.now();
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : '加载会话失败',
          loading: false,
        });
      } finally {
        loadSessionsInFlight = null;
      }
    })();

    return loadSessionsInFlight;
  },

  // 切换会话
  switchSession: (key: string) => {
    const state = get();
    if (key === state.currentSessionKey) return;

    clearTimers();
    clearDedupeCache();

    set({
      currentSessionKey: key,
      messages: [],
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      sending: false,
      pendingFinal: false,
      error: null,
    });

    // 清除未读计数
    set(state => ({
      sessionUnreadCounts: { ...state.sessionUnreadCounts, [key]: 0 },
    }));

    // 加载历史记录
    get().loadHistory();
  },

  // 新建会话
  newSession: () => {
    clearTimers();
    clearDedupeCache();

    const newKey = `${DEFAULT_CANONICAL_PREFIX}:${Date.now()}`;

    set(state => ({
      currentSessionKey: newKey,
      sessions: [
        {
          key: newKey,
          label: '新会话',
          updatedAt: Date.now(),
        },
        ...state.sessions,
      ],
      messages: [],
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      sending: false,
      pendingFinal: false,
      error: null,
      sessionLabels: { ...state.sessionLabels, [newKey]: '新会话' },
      sessionLastActivity: {
        ...state.sessionLastActivity,
        [newKey]: Date.now(),
      },
    }));
  },

  // 创建群聊
  createGroupChat: (agentIds: string[]) => {
    if (!agentIds.length) return;

    const newKey = `group:${Date.now()}`;
    const agentNames = agentIds
      .map(id => useAgentsStore.getState().agents.find(a => a.id === id)?.name)
      .filter(Boolean);

    set(state => ({
      currentSessionKey: newKey,
      sessions: [
        {
          key: newKey,
          label: `群聊: ${agentNames.join(', ')}`,
          participantAgents: agentIds,
          isGroupChat: true,
          updatedAt: Date.now(),
        },
        ...state.sessions,
      ],
      messages: [],
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      sending: false,
      pendingFinal: false,
      error: null,
    }));
  },

  // 删除会话
  deleteSession: async (key: string) => {
    const gateway = useGatewayStore.getState();
    if (!gateway.connected || !gateway.client) {
      throw new Error('Gateway未连接');
    }

    await gateway.rpc('chat.deleteSession', { sessionKey: key });

    set(state => {
      const newSessions = state.sessions.filter(s => s.key !== key);
      const newLabels = { ...state.sessionLabels };
      const newCustomLabels = { ...state.sessionCustomLabels };
      const newActivity = { ...state.sessionLastActivity };
      const newUnread = { ...state.sessionUnreadCounts };

      delete newLabels[key];
      delete newCustomLabels[key];
      delete newActivity[key];
      delete newUnread[key];

      // 如果删除的是当前会话，切换到默认会话
      let newCurrentKey = state.currentSessionKey;
      if (key === state.currentSessionKey) {
        newCurrentKey = DEFAULT_SESSION_KEY;
        get().switchSession(newCurrentKey);
      }

      return {
        sessions: newSessions,
        sessionLabels: newLabels,
        sessionCustomLabels: newCustomLabels,
        sessionLastActivity: newActivity,
        sessionUnreadCounts: newUnread,
        currentSessionKey: newCurrentKey,
      };
    });
  },

  // 清理空会话
  cleanupEmptySession: () => {
    const state = get();
    const currentSession = state.sessions.find(
      s => s.key === state.currentSessionKey
    );

    if (
      currentSession &&
      state.messages.length === 0 &&
      !currentSession.label
    ) {
      get().deleteSession(currentSession.key);
    }
  },

  // 加载历史记录
  loadHistory: async (quiet = false) => {
    const state = get();
    const sessionKey = state.currentSessionKey;
    const now = Date.now();

    if (!quiet) set({ loading: true, error: null });

    // 检查加载间隔
    const lastLoad = lastHistoryLoadAtBySession.get(sessionKey) || 0;
    if (now - lastLoad < TIME.HISTORY_LOAD_MIN_INTERVAL_MS) {
      if (!quiet) set({ loading: false });
      return;
    }

    // 检查是否已有进行中的加载
    const inFlight = historyLoadInFlight.get(sessionKey);
    if (inFlight) {
      await inFlight;
      return;
    }

    const gateway = useGatewayStore.getState();
    if (!gateway.connected || !gateway.client) {
      if (!quiet) set({ loading: false, error: 'Gateway未连接' });
      return;
    }

    const loadPromise = (async () => {
      try {
        const result = await gateway.rpc<{ messages?: RawMessage[] }>('chat.history', {
          sessionKey,
          limit: SESSION.MAX_MESSAGES_PER_SESSION,
        });

        const messages = (result?.messages || []) as RawMessage[];

        set({
          messages: messages.map(m => ({
            ...m,
            content: normalizeMessageContent(m.content),
          })),
          loading: false,
        });

        // 更新会话标签（基于第一条用户消息）
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const text = normalizeMessageContent(firstUserMsg.content)
            .map(b => b.text)
            .join('');
          if (text) {
            set(s => ({
              sessionLabels: {
                ...s.sessionLabels,
                [sessionKey]: formatSessionTitle(text),
              },
            }));
          }
        }

        lastHistoryLoadAtBySession.set(sessionKey, Date.now());
      } catch (err) {
        if (!quiet) {
          set({
            error: err instanceof Error ? err.message : '加载历史记录失败',
            loading: false,
          });
        }
      } finally {
        historyLoadInFlight.delete(sessionKey);
      }
    })();

    historyLoadInFlight.set(sessionKey, loadPromise);
    await loadPromise;
  },

  // 发送消息
  sendMessage: async (text, attachments = [], targetAgentId = null) => {
    const state = get();
    const gateway = useGatewayStore.getState();

    if (!gateway.connected || !gateway.client) {
      set({ error: 'Gateway未连接' });
      return;
    }

    if (!text.trim() && !attachments.length) return;

    // 清理之前的状态
    clearTimers();
    clearDedupeCache();

    // 构建消息
    const userMessage: RawMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      _attachedFiles: attachments.map(att => ({
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        preview: att.preview,
        source: 'user-upload',
      })),
    };

    // 更新状态
    set({
      messages: [...state.messages, userMessage],
      sending: true,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: Date.now(),
      error: null,
    });

    // 更新会话标签
    if (!state.sessionLabels[state.currentSessionKey]) {
      set(s => ({
        sessionLabels: {
          ...s.sessionLabels,
          [state.currentSessionKey]: formatSessionTitle(text),
        },
      }));
    }

    try {
      const agentId = targetAgentId || state.currentAgentId;

      await gateway.rpc('chat.send', {
        sessionKey: state.currentSessionKey,
        message: text,
        attachments: attachments.map(att => ({
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          stagedPath: att.stagedPath,
        })),
        agentId: agentId || undefined,
        thinkingLevel: state.thinkingLevel || undefined,
      });

      // 启动历史记录轮询
      const pollHistory = () => {
        if (!get().sending) return;

        const timeSinceLastEvent = Date.now() - lastChatEventAt;
        if (timeSinceLastEvent > TIME.HISTORY_POLL_SILENCE_WINDOW_MS) {
          get().loadHistory(true);
        }

        historyPollTimer = setTimeout(pollHistory, TIME.HISTORY_LOAD_MIN_INTERVAL_MS);
      };

      historyPollTimer = setTimeout(pollHistory, TIME.HISTORY_POLL_SILENCE_WINDOW_MS);
    } catch (err) {
      set({
        sending: false,
        error: err instanceof Error ? err.message : '发送消息失败',
      });
    }
  },

  // 中止运行
  abortRun: async () => {
    const state = get();
    if (!state.activeRunId) return;

    const gateway = useGatewayStore.getState();
    if (!gateway.connected || !gateway.client) return;

    try {
      await gateway.rpc('chat.abort', {
        sessionKey: state.currentSessionKey,
        runId: state.activeRunId,
      });
    } catch (err) {
      console.error('Abort failed:', err);
    }

    clearTimers();

    set({
      sending: false,
      activeRunId: null,
      pendingFinal: false,
    });
  },

  // 处理聊天事件
  handleChatEvent: (event: Record<string, unknown>) => {
    const eventState = String(event.state || '');

    // 更新最后事件时间
    lastChatEventAt = Date.now();

    // 去重检查
    if (isDuplicateEvent(eventState, event)) {
      return;
    }

    // 处理不同状态的事件
    switch (eventState) {
      case 'started':
        set({
          activeRunId: String(event.runId || ''),
          streamingTools: [],
        });
        break;

      case 'delta':
        if (event.delta && typeof event.delta === 'string') {
          set(s => ({
            streamingText: s.streamingText + event.delta,
          }));
        }
        break;

      case 'tool_start':
        if (event.tool) {
          const tool = event.tool as Record<string, unknown>;
          set(s => ({
            streamingTools: [
              ...s.streamingTools,
              {
                id: String(tool.id || Date.now()),
                name: String(tool.name || 'Unknown'),
                status: 'running',
                updatedAt: Date.now(),
              },
            ],
          }));
        }
        break;

      case 'tool_end':
        if (event.tool) {
          const tool = event.tool as Record<string, unknown>;
          set(s => ({
            streamingTools: s.streamingTools.map(t =>
              t.id === tool.id
                ? {
                    ...t,
                    status: 'completed',
                    durationMs: Number(tool.durationMs) || 0,
                    summary: String(tool.summary || ''),
                  }
                : t
            ),
          }));

          // 提取工具结果中的图片
          const images = extractAndCacheImages(tool.content);
          if (images.length) {
            set(s => ({
              pendingToolImages: [...s.pendingToolImages, ...images],
            }));
          }
        }
        break;

      case 'error':
        // 延迟处理错误，给恢复机会
        errorRecoveryTimer = setTimeout(() => {
          set(s => {
            if (s.sending) {
              return {
                sending: false,
                activeRunId: null,
                error: String(event.error || '流式响应出错'),
              };
            }
            return s;
          });
        }, TIME.ERROR_RECOVERY_WAIT_MS);
        break;

      case 'completed':
        clearTimers();

        set(s => {
          const assistantMessage: RawMessage = {
            role: 'assistant',
            content: s.streamingText || '[无内容]',
            timestamp: Date.now(),
          };

          // 如果有待处理的工具图片，附加到消息
          if (s.pendingToolImages.length) {
            assistantMessage._attachedFiles = [...s.pendingToolImages];
          }

          return {
            messages: [...s.messages, assistantMessage],
            sending: false,
            activeRunId: null,
            streamingText: '',
            streamingMessage: null,
            streamingTools: [],
            pendingFinal: false,
            pendingToolImages: [],
            sessionLastActivity: {
              ...s.sessionLastActivity,
              [s.currentSessionKey]: Date.now(),
            },
          };
        });

        // 刷新历史记录
        get().loadHistory(true);
        break;
    }
  },

  // 切换思考显示
  toggleThinking: () => {
    set(s => ({ showThinking: !s.showThinking }));
  },

  // 刷新
  refresh: async () => {
    await get().loadSessions();
    await get().loadHistory();
  },

  // 清除错误
  clearError: () => set({ error: null }),

  // 清除未读计数
  clearUnreadCount: (key: string) => {
    set(s => ({
      sessionUnreadCounts: { ...s.sessionUnreadCounts, [key]: 0 },
    }));
  },
}));

// 导出默认值
export { DEFAULT_CANONICAL_PREFIX, DEFAULT_SESSION_KEY };
