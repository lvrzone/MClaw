/**
 * Chat Page - iOS 26 简约玻璃态风格
 * 性能优化版本：使用 useMemo 缓存派生数据，减少不必要的重新渲染
 */
import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Loader2, Sparkles, RotateCw, PanelLeftClose, PanelRightOpen, PanelRightClose, SquareTerminal } from 'lucide-react';
import { useTerminalStore } from '@/stores/terminal';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatToolbar } from './ChatToolbar';
import { CheckpointPanel } from '@/components/checkpoint';
import { FilePanel } from '@/components/FilePanel';
import { extractImages, extractText, extractThinking, extractToolUse } from './message-utils';
import { deriveTaskSteps, parseSubagentCompletionInfo } from './task-visualization';
import { cn } from '@/lib/utils';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { useMinLoading } from '@/hooks/use-min-loading';
import { Button } from '@/components/ui/button';

export function Chat() {
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
  const streamingTools = useChatStore((s) => s.streamingTools ?? []);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const agents = useAgentsStore((s) => s.agents);

  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);
  void cleanupEmptySession; // retained for future use
  const [childTranscripts, setChildTranscripts] = useState<Record<string, RawMessage[]>>({});
  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0);
  const [filePanelOpen, setFilePanelOpen] = useState(true);
  const toggleTerminal = useTerminalStore((s) => s.toggle);
  const terminalOpen = useTerminalStore((s) => s.isOpen);

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

  // 使用 useMemo 缓存流式消息的派生数据
  const streamData = useMemo(() => {
    const streamMsg = streamingMessage && typeof streamingMessage === 'object'
      ? streamingMessage as unknown as { role?: string; content?: unknown; timestamp?: number; id?: string }
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
    const streamMsgId = streamMsg?.id;
    const isStreamMsgAlreadyInList = streamMsgId && messages.some(msg => msg.id === streamMsgId);
    
    // 检查流式消息内容是否与最后一条消息内容相同（避免重复渲染）
    const lastMessage = messages[messages.length - 1];
    const lastMessageText = lastMessage ? extractText(lastMessage) : '';
    const isContentDuplicate = streamText && lastMessageText && 
      (streamText === lastMessageText || lastMessageText.includes(streamText));
    
    // 是否有任何流式内容
    const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;
    
    // 当发送结束时，确保立即停止渲染流式消息
    const shouldRenderStreaming = sending && !isStreamMsgAlreadyInList && !isContentDuplicate && hasAnyStreamContent;
    
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
  
  const { streamMsg, streamText, hasStreamText, hasStreamThinking, hasAnyStreamContent, shouldRenderStreaming } = streamData;
  
  const { contentRef, scrollRef, scrollToBottom } = useStickToBottomInstant(currentSessionKey);

  // 自动滚动到底部 - 当有新消息或流式内容时
  useEffect(() => {
    // 当有新的完成消息、流式内容、工具调用时，自动滚动
    if (messages.length > 0 || sending || streamingTools.length > 0 || hasAnyStreamContent) {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [
    messages.length,
    sending,
    streamingTools.length,
    hasStreamText,
    hasStreamThinking,
  ]);

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



  const isEmpty = messages.length === 0 && !sending;
  
  // 使用 useMemo 缓存复杂的派生数据计算
  const userRunCards = useMemo(() => {
    const subagentCompletionInfos = messages.map((message) => parseSubagentCompletionInfo(message));
    const nextUserMessageIndexes = new Array<number>(messages.length).fill(-1);
    let nextUserMessageIndex = -1;
    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      nextUserMessageIndexes[idx] = nextUserMessageIndex;
      if (messages[idx].role === 'user' && !subagentCompletionInfos[idx]) {
        nextUserMessageIndex = idx;
      }
    }

    return messages.flatMap((message, idx) => {
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
        {/* 功能键 - 居中显示 */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <ChatToolbar />
        </div>
        {/* 右侧按钮组：文件面板 + 终端 */}
        <div className="flex items-center gap-1">
          {/* 文件面板按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-all duration-200 hover:scale-105 active:scale-95",
              filePanelOpen && "bg-primary/10 text-primary"
            )}
            onClick={() => setFilePanelOpen(!filePanelOpen)}
            title="文件面板"
          >
            {filePanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>

          {/* 终端按钮 - 最右侧 */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-all duration-200 hover:scale-105 active:scale-95",
              terminalOpen && "bg-primary/10 text-primary"
            )}
            onClick={toggleTerminal}
            title="终端"
          >
            <SquareTerminal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 主内容区 - 左右分栏 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧聊天区域 */}
        <div className="flex-1 flex flex-col min-h-0">
        {/* 消息区域 - 启用性能优化滚动 */}
        <div ref={scrollRef} className="flex-1 min-h-0 chat-scroll-area px-3 py-2 pr-6">
            <div ref={contentRef} className="w-full space-y-2 list-optimized">
              {isEmpty ? (
                <WelcomeScreen />
              ) : (
                <>
                  {/* 消息列表 */}
                  {messages.map((msg, idx) => {
                    const suppressToolCards = suppressToolCardsMap.get(idx) || false;
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
                      </div>
                    );
                  })}
                  
                  {/* 消息列表结束 */}
                  
                  {/* 流式消息 */}
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

          {/* 网关状态指示器 */}
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

          {/* 模型加载进度 */}
          {gatewayStatus.state === 'starting' && (
            <div className="px-4 pb-2">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-1/2" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">正在启动网关服务...</p>
            </div>
          )}

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
            streamingTools={streamingTools
              .filter(t => t.id !== undefined)
              .map(t => ({ id: t.id as string, name: t.name, status: t.status, summary: t.summary }))}
          />
        </div>

        {/* 右侧文件面板 */}
        <div
          className={cn(
            "shrink-0 border-l border-gray-100 dark:border-border bg-white dark:bg-background overflow-hidden transition-all duration-300 ease-out",
            filePanelOpen ? "w-72 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-4"
          )}
        >
          <div className={cn("w-72 h-full", !filePanelOpen && "invisible")}>
            <FilePanel />
          </div>
        </div>
      </div>

      {/* 加载遮罩 */}
      {minLoading && !sending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-full p-2">
            <LoadingSpinner size="sm" />
          </div>
        </div>
      )}

      {/* Checkpoint 面板 */}
      <CheckpointPanel />
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in-up relative">
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[var(--background)] pointer-events-none" />
      <h1 className="text-[18px] font-semibold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
        Hi，我是<span style={{ color: 'var(--accent-blue)' }}> {agentName}+</span>
      </h1>
      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
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

export default Chat;
