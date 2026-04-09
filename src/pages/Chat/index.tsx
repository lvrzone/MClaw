/**
 * Chat Page - iOS 26 简约玻璃态风格
 * 性能优化版本：使用 useMemo 缓存派生数据，减少不必要的重新渲染
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { AlertCircle, Loader2, ChevronDown, ChevronRight, Brain, Sparkles, RotateCw, Zap, Search, Book, Pencil, Wrench, Calculator, CheckCircle, XCircle, PanelLeftClose } from 'lucide-react';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ExecutionGraphCard } from './ExecutionGraphCard';
import { ChatToolbar } from './ChatToolbar';
import { extractImages, extractText, extractThinking, extractToolUse } from './message-utils';
import { deriveTaskSteps, parseSubagentCompletionInfo } from './task-visualization';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { useMinLoading } from '@/hooks/use-min-loading';
import { Button } from '@/components/ui/button';

export function Chat() {
  const { t } = useTranslation('chat');
  const gatewayStatus = useGatewayStore((s) => s.status);
  const restartGateway = useGatewayStore((s) => s.restart);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const messages = useChatStore((s) => s.messages);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const lastThinking = useChatStore((s) => s.lastThinking);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const agents = useAgentsStore((s) => s.agents);

  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);
  const [childTranscripts, setChildTranscripts] = useState<Record<string, RawMessage[]>>({});
  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0);
  const [tasksPanelCollapsed, setTasksPanelCollapsed] = useState(true);
  
  // 保存已完成调用的工具记录，用于在调用完成后保留图标
  const [completedToolsHistory, setCompletedToolsHistory] = useState<Array<{
    id: string;
    name: string;
    status: 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>>([]);

  // 快捷回复选项（Agent 提问时自动生成）
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  // 检测 Agent 最后一条消息中的提问，生成快捷回复选项
  useEffect(() => {
    if (loading || sending || messages.length === 0) {
      setQuickReplies([]);
      return;
    }

    // 找到最后一条 Agent 消息
    const lastAgentMsg = [...messages].reverse().find(msg => msg.role === 'assistant');
    if (!lastAgentMsg) {
      setQuickReplies([]);
      return;
    }

    // 提取文本内容
    let text = '';
    if (typeof lastAgentMsg.content === 'string') {
      text = lastAgentMsg.content;
    } else if (Array.isArray(lastAgentMsg.content)) {
      text = lastAgentMsg.content
        .filter(c => c.type === 'text')
        .map(c => (c as { type: 'text'; text: string }).text)
        .join('\n');
    }

    // 检测是否有提问（问号结尾或包含问号）
    const questionPatterns = [/\?{1,}$/, /：$/, /\?[^)]/];
    const hasQuestion = questionPatterns.some(p => p.test(text));

    if (hasQuestion) {
      // 生成常用回复选项
      const defaultReplies = [
        '好的，我明白了',
        '继续',
        '请详细说明一下',
        '还有其他问题吗',
      ];
      setQuickReplies(defaultReplies);
    } else {
      setQuickReplies([]);
    }
  }, [messages, loading, sending]);

  // 当用户点击快捷回复时，清除选项并发送
  const handleQuickReply = (reply: string) => {
    setQuickReplies([]);
    sendMessage(reply);
  };
  
  // 检查从"找灵感"传来的提示词
  const [inputKey, setInputKey] = useState(0);
  useEffect(() => {
    const pendingPrompt = localStorage.getItem('pendingPrompt');
    if (pendingPrompt) {
      localStorage.removeItem('pendingPrompt');
      sessionStorage.setItem('initialPrompt', pendingPrompt);
      setInputKey((k) => k + 1);
    }
  }, []);
  
  const minLoading = useMinLoading(loading && messages.length > 0);
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);

  useEffect(() => {
    return () => cleanupEmptySession();
  }, [cleanupEmptySession]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const completions = messages
      .map((message) => parseSubagentCompletionInfo(message))
      .filter((value): value is NonNullable<typeof value> => value != null);
    const missing = completions.filter((completion) => !childTranscripts[completion.sessionId]);
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (completion) => {
        try {
          const result = await hostApiFetch<{ success: boolean; messages?: RawMessage[] }>(
            `/api/sessions/transcript?agentId=${encodeURIComponent(completion.agentId)}&sessionId=${encodeURIComponent(completion.sessionId)}`,
          );
          if (!result.success) return null;
          return { sessionId: completion.sessionId, messages: result.messages || [] };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setChildTranscripts((current) => {
        const next = { ...current };
        for (const result of results) {
          if (!result) continue;
          next[result.sessionId] = result.messages;
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [messages, childTranscripts]);

  useEffect(() => {
    if (sending && streamingTimestamp === 0) {
      setStreamingTimestamp(Date.now() / 1000);
    } else if (!sending && streamingTimestamp !== 0) {
      setStreamingTimestamp(0);
    }
  }, [sending, streamingTimestamp]);

  // 使用 useMemo 缓存流式消息的派生数据
  const streamData = useMemo(() => {
    const streamMsg = streamingMessage && typeof streamingMessage === 'object'
      ? streamingMessage as unknown as { role?: string; content?: unknown; timestamp?: number }
      : null;
    const streamText = streamMsg ? extractText(streamMsg) : (typeof streamingMessage === 'string' ? streamingMessage : '');
    const hasStreamText = streamText.trim().length > 0;
    const streamThinking = streamMsg ? extractThinking(streamMsg) : null;
    const hasStreamThinking = !!streamThinking && streamThinking.trim().length > 0;
    const streamTools = streamMsg ? extractToolUse(streamMsg) : [];
    const hasStreamTools = streamTools.length > 0;
    const streamImages = streamMsg ? extractImages(streamMsg) : [];
    const hasStreamImages = streamImages.length > 0;
    const hasStreamToolStatus = streamingTools.length > 0;
    
    // 检查流式消息是否已经在 messages 中存在（避免重复渲染）
    const streamMsgId = streamMsg && (streamMsg as Record<string, unknown>).id as string | undefined;
    const isStreamMsgAlreadyInList = streamMsgId && messages.some(msg => msg.id === streamMsgId);
    
    // 是否有任何流式内容
    const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;
    
    // 当发送结束时，确保立即停止渲染流式消息
    // 只有当正在发送中、消息尚未添加到列表、且有实际内容时才渲染
    const shouldRenderStreaming = sending && !isStreamMsgAlreadyInList && hasAnyStreamContent;
    
    return {
      streamMsg,
      streamText,
      hasStreamText,
      streamThinking,
      hasStreamThinking,
      streamTools,
      hasStreamTools,
      streamImages,
      hasStreamImages,
      hasStreamToolStatus,
      hasAnyStreamContent,
      shouldRenderStreaming,
    };
  }, [streamingMessage, streamingTools, messages, sending]);
  
  const { streamMsg, streamText, hasStreamText, hasStreamThinking, hasStreamToolStatus, hasAnyStreamContent, shouldRenderStreaming } = streamData;

  // 自动展开调用面板当有执行数据时
  useEffect(() => {
    if ((sending || hasStreamThinking || hasStreamToolStatus) && tasksPanelCollapsed) {
      setTasksPanelCollapsed(false);
    }
  }, [sending, hasStreamThinking, hasStreamToolStatus, tasksPanelCollapsed]);

  // 监听发送状态变化，保存已完成的工具调用
  useEffect(() => {
    if (sending) return; // 还在发送中，不处理
    
    // 当发送结束时，如果有完成的工具，保存到历史记录
    if (streamingTools.length > 0) {
      const completedTools = streamingTools
        .filter(t => t.status === 'completed' || t.status === 'error')
        .map(t => ({
          id: t.toolCallId || t.id || t.name,
          name: t.name,
          status: t.status,
          durationMs: t.durationMs,
          summary: t.summary,
        }));
      
      if (completedTools.length > 0) {
        setCompletedToolsHistory(prev => {
          // 避免重复添加
          const existingIds = new Set(prev.map(t => t.id));
          const newTools = completedTools.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTools];
        });
      }
    }
    
    // 思考或工具调用结束后，收起调用面板
    // 延迟 500ms 收起，让用户看到最后的状态
    const timer = setTimeout(() => {
      setTasksPanelCollapsed(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [sending, streamingTools]);

  // 监听消息变化，当有新的用户消息时清除工具历史（新的对话开始）
  const lastMsgIdRef = React.useRef<string | undefined>();
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.id !== lastMsgIdRef.current) {
      // 检测到新的用户消息，清除历史
      setCompletedToolsHistory([]);
      lastMsgIdRef.current = lastMsg.id;
    } else if (lastMsg && lastMsg.id) {
      lastMsgIdRef.current = lastMsg.id;
    }
  }, [messages]);

  const isEmpty = messages.length === 0 && !sending;
  
  // 使用 useMemo 缓存复杂的派生数据计算
  const { subagentCompletionInfos, nextUserMessageIndexes, userRunCards } = useMemo(() => {
    const subagentCompletionInfos = messages.map((message) => parseSubagentCompletionInfo(message));
    const nextUserMessageIndexes = new Array<number>(messages.length).fill(-1);
    let nextUserMessageIndex = -1;
    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      nextUserMessageIndexes[idx] = nextUserMessageIndex;
      if (messages[idx].role === 'user' && !subagentCompletionInfos[idx]) {
        nextUserMessageIndex = idx;
      }
    }

    const userRunCards = messages.flatMap((message, idx) => {
    if (message.role !== 'user' || subagentCompletionInfos[idx]) return [];

    const nextUserIndex = nextUserMessageIndexes[idx];
    const segmentEnd = nextUserIndex === -1 ? messages.length : nextUserIndex;
    const segmentMessages = messages.slice(idx + 1, segmentEnd);
    const replyIndexOffset = segmentMessages.findIndex((candidate) => candidate.role === 'assistant');
    const replyIndex = replyIndexOffset === -1 ? null : idx + 1 + replyIndexOffset;
    const completionInfos = subagentCompletionInfos
      .slice(idx + 1, segmentEnd)
      .filter((value): value is NonNullable<typeof value> => value != null);
    const isLatestOpenRun = nextUserIndex === -1 && (sending || pendingFinal || hasAnyStreamContent);
    let steps = deriveTaskSteps({
      messages: segmentMessages,
      streamingMessage: isLatestOpenRun ? streamingMessage : null,
      streamingTools: isLatestOpenRun ? streamingTools : [],
      sending: isLatestOpenRun ? sending : false,
      pendingFinal: isLatestOpenRun ? pendingFinal : false,
      showThinking,
    });

    for (const completion of completionInfos) {
      const childMessages = childTranscripts[completion.sessionId];
      if (!childMessages || childMessages.length === 0) continue;
      const branchRootId = `subagent:${completion.sessionId}`;
      const childSteps = deriveTaskSteps({
        messages: childMessages,
        streamingMessage: null,
        streamingTools: [],
        sending: false,
        pendingFinal: false,
        showThinking,
      }).map((step) => ({
        ...step,
        id: `${completion.sessionId}:${step.id}`,
        depth: step.depth + 1,
        parentId: branchRootId,
      }));

      steps = [
        ...steps,
        {
          id: branchRootId,
          label: `${completion.agentId} subagent`,
          status: 'completed' as const,
          kind: 'system' as const,
          detail: completion.sessionKey,
          depth: 1,
          parentId: 'agent-run',
        },
        ...childSteps,
      ];
    }

    if (steps.length === 0) return [];

    const segmentAgentId = currentAgentId;
    const segmentAgentLabel = agents.find((agent) => agent.id === segmentAgentId)?.name || segmentAgentId;
    const segmentSessionLabel = sessionLabels[currentSessionKey] || currentSessionKey;

    return [{
      triggerIndex: idx,
      replyIndex,
      active: isLatestOpenRun,
      agentLabel: segmentAgentLabel,
      sessionLabel: segmentSessionLabel,
      segmentEnd: nextUserIndex === -1 ? messages.length - 1 : nextUserIndex - 1,
      steps,
    }];
    });
    
    return { subagentCompletionInfos, nextUserMessageIndexes, userRunCards };
  }, [
    messages, 
    currentAgentId, 
    agents, 
    sessionLabels, 
    streamingMessage, 
    streamingTools, 
    sending, 
    pendingFinal, 
    showThinking,
    childTranscripts,
  ]);

  // 使用 useMemo 缓存消息的 suppressToolCards 计算
  const suppressToolCardsMap = useMemo(() => {
    const map = new Map<number, boolean>();
    messages.forEach((_, idx) => {
      const suppress = userRunCards.some((card) =>
        idx > card.triggerIndex && idx <= card.segmentEnd,
      );
      map.set(idx, suppress);
    });
    return map;
  }, [messages, userRunCards]);

  // 使用 useMemo 缓存每个消息对应的 ExecutionGraphCard
  const graphCardsMap = useMemo(() => {
    const map = new Map<number, typeof userRunCards>();
    userRunCards.forEach((card) => {
      const existing = map.get(card.triggerIndex) || [];
      map.set(card.triggerIndex, [...existing, card]);
    });
    return map;
  }, [userRunCards]);

  return (
    <div
      className={cn("relative flex flex-col h-full")}
      style={{ background: 'var(--theme-bg-root)' }}
    >
      {/* 顶部工具栏 */}
      <div className="glass relative z-40 flex shrink-0 items-center justify-between px-3 py-1.5 gap-2">
        {/* 折叠按钮 - 左侧单独放置 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            const iconsCollapsed = localStorage.getItem('sidebar-icons-collapsed') === 'true';
            const sidebarCollapsed = useSettingsStore.getState().sidebarCollapsed;
            
            if (!iconsCollapsed && !sidebarCollapsed) {
              // 完全展开 -> 收起侧边栏（保留图标栏）
              useSettingsStore.getState().setSidebarCollapsed(true);
              window.dispatchEvent(new CustomEvent('sidebar-icons-state', { detail: { iconsCollapsed: false } }));
            } else if (!iconsCollapsed && sidebarCollapsed) {
              // 只保留图标栏 -> 完全收起
              localStorage.setItem('sidebar-icons-collapsed', 'true');
              window.dispatchEvent(new CustomEvent('sidebar-icons-state', { detail: { iconsCollapsed: true } }));
            } else {
              // 完全收起 -> 完全展开
              localStorage.setItem('sidebar-icons-collapsed', 'false');
              useSettingsStore.getState().setSidebarCollapsed(false);
              window.dispatchEvent(new CustomEvent('sidebar-icons-state', { detail: { iconsCollapsed: false } }));
            }
          }}
          title="切换侧边栏"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
        <ChatToolbar />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 消息区域 - 启用性能优化滚动 */}
        <div ref={scrollRef} className="flex-1 min-h-0 chat-scroll-area px-3 py-2">
          <div ref={contentRef} className="w-full space-y-2 list-optimized">
            {isEmpty ? (
              <WelcomeScreen />
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const suppressToolCards = suppressToolCardsMap.get(idx) || false;
                  const cards = graphCardsMap.get(idx) || [];
                  return (
                    <div
                      key={msg.id || `msg-${idx}`}
                      className="space-y-1 msg-bubble-animate"
                      id={`chat-message-${idx}`}
                    >
                      <ChatMessage
                        message={msg}
                        showThinking={showThinking}
                        suppressToolCards={suppressToolCards}
                        suppressProcessAttachments={suppressToolCards}
                      />
                      {cards.map((card) => (
                        <ExecutionGraphCard
                          key={`graph-${card.triggerIndex}`}
                          agentLabel={card.agentLabel}
                          sessionLabel={card.sessionLabel}
                          steps={card.steps}
                          active={card.active}
                          compact
                          onJumpToTrigger={() => {
                            document.getElementById(`chat-message-${card.triggerIndex}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                          onJumpToReply={() => {
                            if (card.replyIndex == null) return;
                            document.getElementById(`chat-message-${card.replyIndex}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}

                {shouldRenderStreaming && (
                  <ChatMessage
                    message={(streamMsg
                      ? {
                          ...(streamMsg as Record<string, unknown>),
                          role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                          content: streamMsg.content ?? streamText,
                          timestamp: streamMsg.timestamp ?? streamingTimestamp,
                        }
                      : {
                          role: 'assistant',
                          content: streamText,
                          timestamp: streamingTimestamp,
                        }) as RawMessage}
                    showThinking={showThinking}
                    isStreaming
                    streamingTools={streamingTools}
                  />
                )}

                {sending && pendingFinal && !shouldRenderStreaming && (
                  <ActivityIndicator phase="tool_processing" />
                )}

                {sending && !pendingFinal && !hasAnyStreamContent && (
                  <TypingIndicator />
                )}
              </>
            )}
          </div>
        </div>

        {/* 任务列表 - 概括会话进行中的任务内容 */}
        <div 
          className="shrink-0"
          style={{ background: 'var(--background)' }}
        >
          {/* 面板头部 */}
          <div 
            className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
            onClick={() => setTasksPanelCollapsed(!tasksPanelCollapsed)}
          >
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3" style={{ color: 'var(--success)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>调用记录</span>
              {sending && (
                <span 
                  className="text-[9px] px-1.5 py-0.5 rounded-full animate-pulse" 
                  style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}
                >
                  {hasStreamToolStatus ? '执行中' : hasStreamThinking ? '调用中' : '处理中'}
                </span>
              )}
            </div>
            {tasksPanelCollapsed ? (
              <ChevronRight className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>

          {/* 调用记录内容 - 展示真实的模型执行数据 */}
          {!tasksPanelCollapsed && (
            <div className="px-3 pb-3">
              {/* 保留已完成调用的工具记录 */}
              {!sending && completedToolsHistory.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {completedToolsHistory.map((tool) => (
                    <div 
                      key={tool.id}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all",
                        tool.status === 'completed' && "bg-green-50/40 dark:bg-green-900/10",
                        tool.status === 'error' && "bg-red-50/40 dark:bg-red-900/10",
                      )}
                    >
                      {/* 状态图标 */}
                      {tool.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {tool.status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                      {/* 工具名带图标 */}
                      <span 
                        className={cn(
                          "text-[11px] font-medium font-mono flex items-center gap-1.5",
                          tool.status === 'completed' && "text-green-700 dark:text-green-500",
                          tool.status === 'error' && "text-red-600 dark:text-red-400",
                        )}
                      >
                        {getToolActionIcon(tool.name)} {tool.name}
                      </span>
                      {/* 摘要 */}
                      {tool.summary && (
                        <span className="text-[10px] truncate ml-auto" style={{ color: 'var(--text-muted)' }}>
                          {tool.summary}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 没有流式数据但有保存的思考内容时 */}
              {!sending && !hasStreamToolStatus && !hasStreamThinking && lastThinking && (
                <div 
                  className="px-2.5 py-1.5 rounded-md"
                  style={{ background: 'rgba(34,197,94,0.05)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="h-3 w-3 text-green-500" />
                    <span className="text-[11px] font-medium text-green-600 dark:text-green-400">思考结果</span>
                  </div>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {lastThinking}
                  </p>
                </div>
              )}

              {/* 完全没有调用数据时 - 不显示任何内容 */}
              {!sending && !hasStreamToolStatus && !hasStreamThinking && !lastThinking && completedToolsHistory.length === 0 && (
                <div className="h-4" /> // 保留空白区域
              )}

              {/* 有流式工具数据时 - 展示每个工具的执行状态 */}
              {sending && hasStreamToolStatus && (
                <div className="space-y-1.5">
                  {streamingTools.map((tool) => (
                    <div 
                      key={tool.toolCallId || tool.id || tool.name}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all",
                        tool.status === 'running' && "bg-green-50/70 dark:bg-green-900/20",
                        tool.status === 'completed' && "bg-green-50/40 dark:bg-green-900/10",
                        tool.status === 'error' && "bg-red-50/40 dark:bg-red-900/10",
                      )}
                    >
                      {/* 状态图标 */}
                      {tool.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      {tool.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {tool.status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                      {/* 工具名 */}
                      <span 
                        className={cn(
                          "text-[11px] font-medium font-mono",
                          tool.status === 'running' && "text-green-600 dark:text-green-400",
                          tool.status === 'completed' && "text-green-700 dark:text-green-500",
                          tool.status === 'error' && "text-red-600 dark:text-red-400",
                        )}
                      >
                        {getToolActionIcon(tool.name)} {tool.name}
                      </span>
                      {/* 运行中动画 */}
                      {tool.status === 'running' && (
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse ml-auto" />
                      )}
                      {/* 摘要 */}
                      {tool.summary && (
                        <span className="text-[10px] truncate ml-auto" style={{ color: 'var(--text-muted)' }}>
                          {tool.summary}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* 思考内容（如果有） - 打字机效果 */}
                  {hasStreamThinking && (
                    <div 
                      className="px-2.5 py-1.5 rounded-md mt-1"
                      style={{ 
                        background: 'rgba(34,197,94,0.05)',
                        borderRadius: '6px',
                      }}
                    >
                      <CallActionIndicator thinking={streamThinking} isStreaming={true} />
                      <div className="text-[10px] leading-relaxed mt-1 overflow-hidden" style={{ color: 'var(--text-secondary)' }}>
                        <span className="stream-thinking-text">{streamThinking}</span>
                        <span className="inline-block w-0.5 h-2.5 bg-green-500 animate-pulse ml-0.5 vertical-middle" />
                      </div>
                    </div>
                  )}

                  {/* 无思考内容时显示当前流式回复文本 */}
                  {!hasStreamThinking && hasStreamText && (
                    <div className="px-2.5 py-1.5 rounded-md mt-1" style={{ background: 'rgba(34,197,94,0.05)', borderRadius: '6px' }}>
                      <CallActionIndicator thinking={streamText} isStreaming={true} />
                      <p className="text-[10px] leading-relaxed mt-1 max-h-24 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
                        {streamText}
                        <span className="inline-block w-1 h-2.5 bg-green-500 animate-pulse ml-0.5" />
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 有思考内容但没有工具数据 - 打字机效果 */}
              {sending && !hasStreamToolStatus && hasStreamThinking && (
                <div 
                  className="px-2.5 py-1.5 rounded-md"
                  style={{ 
                    background: 'rgba(34,197,94,0.05)',
                    borderRadius: '6px',
                  }}
                >
                  <CallActionIndicator thinking={streamThinking} isStreaming={true} />
                  <div className="text-[10px] leading-relaxed mt-1 overflow-hidden" style={{ color: 'var(--text-secondary)' }}>
                    <span className="stream-thinking-text">{streamThinking}</span>
                    <span className="inline-block w-0.5 h-2.5 bg-green-500 animate-pulse ml-0.5 vertical-middle" />
                  </div>
                </div>
              )}

              {/* 无思考内容但有流式文本 - 显示模型正在生成的回复 */}
              {sending && !hasStreamToolStatus && !hasStreamThinking && hasStreamText && (
                <div className="px-2.5 py-1.5 rounded-md" style={{ background: 'rgba(34,197,94,0.05)', borderRadius: '6px' }}>
                  <CallActionIndicator thinking={streamText} isStreaming={true} />
                  <p className="text-[10px] leading-relaxed mt-1 max-h-24 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
                    {streamText}
                    <span className="inline-block w-1 h-2.5 bg-green-500 animate-pulse ml-0.5" />
                  </p>
                </div>
              )}

              {/* 正在等待流式响应 */}
              {sending && !hasStreamToolStatus && !hasStreamThinking && (
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <CallActionIndicator thinking={null} isStreaming={true} />
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-1.5" style={{ background: 'var(--error-bg)' }}>
            <div className="w-full flex items-center justify-between">
              <p className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--error)' }}>
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
              <button 
                onClick={clearError} 
                className="text-[10px] hover:opacity-80"
                style={{ color: 'var(--error)' }}
              >
                忽略
              </button>
            </div>
          </div>
        )}

        {/* 网关状态指示器 - 移到输入框下方 */}
        <div 
          className="shrink-0 px-4 py-1.5 flex items-center justify-between"
          style={{ background: 'var(--background)' }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="h-2 w-2 rounded-full"
              style={{ background: gatewayStatus.state === 'running' ? 'var(--success)' : 'var(--error)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {gatewayStatus.state === 'running' ? '网关已连接' : gatewayStatus.state === 'starting' ? '网关启动中...' : '网关未连接'}
            </span>
          </div>
          <button
            onClick={() => void restartGateway()}
            className="flex items-center gap-1 text-[11px] transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            title="重启网关"
          >
            <RotateCw className="h-3 w-3" />
            <span>重启</span>
          </button>
        </div>

        {/* 输入框 */}
        <ChatInput
          key={inputKey}
          onSend={sendMessage}
          onStop={abortRun}
          disabled={!isGatewayRunning}
          sending={sending}
          isEmpty={isEmpty}
          quickReplies={quickReplies}
          onQuickReply={handleQuickReply}
        />
      </div>

      {/* 加载遮罩 */}
      {minLoading && !sending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-full p-2">
            <LoadingSpinner size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────

function WelcomeScreen() {
  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const currentAgent = (agents ?? []).find((a) => a.id === currentAgentId);
  const agentName = currentAgent?.name || 'MClaw';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in-up">
      <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Hi，我是<span style={{ color: 'var(--accent-blue)' }}> {agentName}+</span>
      </h1>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        有什么我可以帮你做的？
      </p>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-bg)' }}>
        <Sparkles className="h-3 w-3" style={{ color: 'var(--theme-accent-blue)' }} />
      </div>
      <div className="thinking-dots flex gap-1">
        <span /><span /><span />
      </div>
    </div>
  );
}

function ActivityIndicator({ phase }: { phase: 'tool_processing' }) {
  void phase;
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--accent-blue)' }} />
      <span>处理中...</span>
    </div>
  );
}

// 根据工具名返回对应的动作图标
function getToolActionIcon(toolName: string): React.ReactNode {
  const name = toolName.toLowerCase();
  if (name.includes('exec') || name.includes('bash') || name.includes('run') || name.includes('command')) return <Zap className="h-3 w-3" />;
  if (name.includes('search') || name.includes('find') || name.includes('grep')) return <Search className="h-3 w-3" />;
  if (name.includes('read') || name.includes('file') || name.includes('cat')) return <Book className="h-3 w-3" />;
  if (name.includes('write') || name.includes('edit') || name.includes('create')) return <Pencil className="h-3 w-3" />;
  if (name.includes('think') || name.includes('reason')) return <Brain className="h-3 w-3" />;
  if (name.includes('browse') || name.includes('fetch') || name.includes('web')) return <Sparkles className="h-3 w-3" />;
  if (name.includes('code') || name.includes('lint') || name.includes('test')) return <RotateCw className="h-3 w-3" />;
  if (name.includes('image') || name.includes('draw') || name.includes('generate')) return <Sparkles className="h-3 w-3" />;
  return <Wrench className="h-3 w-3" />;
}

// 调用动作指示器 - 根据调用内容推断模型动作类型
function CallActionIndicator({ thinking, isStreaming }: { thinking: string | null; isStreaming: boolean }) {
  const getActionFromThinking = (text: string | null): { icon: React.ReactNode; label: string; color: string } => {
    const iconClass = "h-3.5 w-3.5 shrink-0";
    
    if (!text) return { icon: <Zap className={`${iconClass} animate-pulse`} />, label: '调用中', color: 'blue' };
    
    const lower = text.toLowerCase();
    
    // 根据关键词判断动作类型
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('调用') || lower.includes('exec')) {
      return { icon: <Zap className={`${iconClass} animate-pulse`} />, label: '执行中', color: 'blue' };
    }
    if (lower.includes('搜索') || lower.includes('查询') || lower.includes('search')) {
      return { icon: <Search className={iconClass} />, label: '搜索中', color: 'cyan' };
    }
    if (lower.includes('阅读') || lower.includes('读取') || lower.includes('分析文件') || lower.includes('read')) {
      return { icon: <Book className={iconClass} />, label: '读取中', color: 'indigo' };
    }
    if (lower.includes('编写') || lower.includes('写入') || lower.includes('生成') || lower.includes('write')) {
      return { icon: <Pencil className={iconClass} />, label: '写入中', color: 'purple' };
    }
    if (lower.includes('思考') || lower.includes('thinking') || lower.includes('推理')) {
      return { icon: <Brain className={`${iconClass} ${isStreaming ? 'animate-pulse' : ''}`} />, label: '推理中', color: 'gray' };
    }
    if (lower.includes('工具') || lower.includes('tool')) {
      return { icon: <Wrench className={iconClass} />, label: '工具调用', color: 'orange' };
    }
    if (lower.includes('计算')) {
      return { icon: <Calculator className={iconClass} />, label: '计算中', color: 'rose' };
    }
    
    return { icon: <Zap className={`${iconClass} animate-pulse`} />, label: '调用中', color: 'blue' };
  };

  const action = getActionFromThinking(thinking);

  return (
    <div className="flex items-center gap-2">
      {action.icon}
      <span 
        className={cn(
          "text-[11px] font-medium",
          action.color === 'blue' && (isStreaming ? 'text-blue-500' : 'text-blue-600'),
          action.color === 'cyan' && (isStreaming ? 'text-cyan-500' : 'text-cyan-600'),
          action.color === 'indigo' && (isStreaming ? 'text-indigo-500' : 'text-indigo-600'),
          action.color === 'purple' && (isStreaming ? 'text-purple-500' : 'text-purple-600'),
          action.color === 'orange' && (isStreaming ? 'text-orange-500' : 'text-orange-600'),
          action.color === 'rose' && (isStreaming ? 'text-rose-500' : 'text-rose-600'),
          action.color === 'gray' && (isStreaming ? 'text-gray-500' : 'text-gray-600'),
        )}
      >
        {action.label}
      </span>
      {isStreaming && (
        <span className="w-1 h-1 bg-current rounded-full animate-pulse ml-auto" />
      )}
    </div>
  );
}

export default Chat;
