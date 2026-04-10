/**
 * Chat Input Component
 * Textarea with send button and universal file upload support.
 * Enter to send, Shift+Enter for new line.
 * Supports: native file picker, clipboard paste, drag & drop.
 * Files are staged to disk via IPC — only lightweight path references
 * are sent with the message (no base64 over WebSocket).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SendHorizontal, Square, X, Paperclip, FileText, Film, Music, FileArchive, File, Loader2, AtSign, ChevronDown, Sparkles, Zap, Brain, Target, Image, Video, Code, Presentation, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// ── Types ────────────────────────────────────────────────────────

export interface FileAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  stagedPath: string;        // disk path for gateway
  preview: string | null;    // data URL for images, null for others
  status: 'staging' | 'ready' | 'error';
  error?: string;
}

interface ChatInputProps {
  onSend: (text: string, attachments?: FileAttachment[], targetAgentId?: string | null) => void;
  onStop?: () => void;
  disabled?: boolean;
  sending?: boolean;
  isEmpty?: boolean;
  quickReplies?: string[];
  onQuickReply?: (reply: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') return <FileText className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <FileArchive className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  return <File className={className} />;
}

/**
 * Read a browser File object as base64 string (without the data URL prefix).
 */
function readFileAsBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error(`Invalid data URL from FileReader for ${file.name}`));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error(`Empty base64 data for ${file.name}`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Component ────────────────────────────────────────────────────

export function ChatInput({ onSend, onStop, disabled = false, sending = false, isEmpty = false, quickReplies = [], onQuickReply }: ChatInputProps) {
  const { t } = useTranslation('chat');
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // 点击快捷回复后自动清除选项
  const handleQuickReplyClick = (reply: string) => {
    if (onQuickReply) {
      onQuickReply(reply);
    }
  };
  const [listenText, setListenText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const listenTextRef = useRef('');
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessions = useChatStore((s) => s.sessions);

  // 监听从"找灵感"页面传来的提示词
  useEffect(() => {
    const checkPendingPrompt = () => {
      const pendingPrompt = sessionStorage.getItem('initialPrompt');
      if (pendingPrompt) {
        setInput(pendingPrompt);
        sessionStorage.removeItem('initialPrompt');
        // 自动聚焦到输入框
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    };
    
    // 立即检查一次
    checkPendingPrompt();
  }, []);
  const currentAgentName = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId)?.name ?? currentAgentId,
    [agents, currentAgentId],
  );
  
  // 检查当前会话是否是群聊
  const currentSession = sessions.find(s => s.key === currentSessionKey);
  const isGroupChat = currentSession?.isGroupChat ?? false;
  const participantAgents = currentSession?.participantAgents ?? [];
  
  // 群聊中可提及的 Agent：排除当前选中的 Agent
  const mentionableAgents = useMemo(() => {
    if (isGroupChat && participantAgents.length > 0) {
      // 群聊模式：只显示参与者
      return (agents ?? []).filter((agent) => 
        participantAgents.includes(agent.id) && agent.id !== currentAgentId
      );
    }
    // 普通模式：显示除当前 Agent 外的所有 Agent
    return (agents ?? []).filter((agent) => agent.id !== currentAgentId);
  }, [agents, currentAgentId, isGroupChat, participantAgents]);
  
  const selectedTarget = useMemo(
    () => (agents ?? []).find((agent) => agent.id === targetAgentId) ?? null,
    [agents, targetAgentId],
  );
  const showAgentPicker = mentionableAgents.length > 0;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus textarea on mount (avoids Windows focus loss after session delete + native dialog)
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (!targetAgentId) return;
    if (targetAgentId === currentAgentId) {
      setTargetAgentId(null);
      setPickerOpen(false);
      return;
    }
    if (!(agents ?? []).some((agent) => agent.id === targetAgentId)) {
      setTargetAgentId(null);
      setPickerOpen(false);
    }
  }, [agents, currentAgentId, targetAgentId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [pickerOpen]);

  // ── Voice Wake Word System ──────────────────────────────────
  const startVoice = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceError('不支持语音识别');
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }
    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setListenText('');
        listenTextRef.current = '';
        setVoiceError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setListenText(transcript);
        listenTextRef.current = transcript;
        // Reset silence timer
        if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
        listenTimerRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 3000);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        const msgs: Record<string, string> = {
          'not-allowed': '请允许麦克风权限',
          'no-speech': '未检测到语音',
          'network': '网络错误',
          'audio-capture': '无法访问麦克风',
        };
        setVoiceError(msgs[event.error] || `识别错误: ${event.error}`);
        setTimeout(() => setVoiceError(null), 3000);
      };

      recognition.onend = () => {
        const text = listenTextRef.current.trim();
        if (text) {
          setInput(prev => prev + text);
        }
        setIsListening(false);
        setListenText('');
        listenTextRef.current = '';
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceError('启动失败');
      setTimeout(() => setVoiceError(null), 3000);
    }
  }, []);

  const stopVoice = useCallback(() => {
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // ── File staging via native dialog ─────────────────────────────

  const pickFiles = useCallback(async () => {
    try {
      const result = await invokeIpc('dialog:open', {
        properties: ['openFile', 'multiSelections'],
      }) as { canceled: boolean; filePaths?: string[] };
      if (result.canceled || !result.filePaths?.length) return;

      // Add placeholder entries immediately
      const tempIds: string[] = [];
      for (const filePath of result.filePaths) {
        const tempId = crypto.randomUUID();
        tempIds.push(tempId);
        // Handle both Unix (/) and Windows (\) path separators
        const fileName = filePath.split(/[\\/]/).pop() || 'file';
        setAttachments(prev => [...prev, {
          id: tempId,
          fileName,
          mimeType: '',
          fileSize: 0,
          stagedPath: '',
          preview: null,
          status: 'staging' as const,
        }]);
      }

      // Stage all files via IPC
      console.log('[pickFiles] Staging files:', result.filePaths);
      const staged = await hostApiFetch<Array<{
        id: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        stagedPath: string;
        preview: string | null;
      }>>('/api/files/stage-paths', {
        method: 'POST',
        body: JSON.stringify({ filePaths: result.filePaths }),
      });
      console.log('[pickFiles] Stage result:', staged?.map(s => ({ id: s?.id, fileName: s?.fileName, mimeType: s?.mimeType, fileSize: s?.fileSize, stagedPath: s?.stagedPath, hasPreview: !!s?.preview })));

      // Update each placeholder with real data
      setAttachments(prev => {
        let updated = [...prev];
        for (let i = 0; i < tempIds.length; i++) {
          const tempId = tempIds[i];
          const data = staged[i];
          if (data) {
            updated = updated.map(a =>
              a.id === tempId
                ? { ...data, status: 'ready' as const }
                : a,
            );
          } else {
            console.warn(`[pickFiles] No staged data for tempId=${tempId} at index ${i}`);
            updated = updated.map(a =>
              a.id === tempId
                ? { ...a, status: 'error' as const, error: 'Staging failed' }
                : a,
            );
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('[pickFiles] Failed to stage files:', err);
      // Mark any stuck 'staging' attachments as 'error' so the user can remove them
      // and the send button isn't permanently blocked
      setAttachments(prev => prev.map(a =>
        a.status === 'staging'
          ? { ...a, status: 'error' as const, error: String(err) }
          : a,
      ));
    }
  }, []);

  // ── Stage browser File objects (paste / drag-drop) ─────────────

  const stageBufferFiles = useCallback(async (files: globalThis.File[]) => {
    for (const file of files) {
      const tempId = crypto.randomUUID();
      setAttachments(prev => [...prev, {
        id: tempId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        stagedPath: '',
        preview: null,
        status: 'staging' as const,
      }]);

      try {
        console.log(`[stageBuffer] Reading file: ${file.name} (${file.type}, ${file.size} bytes)`);
        const base64 = await readFileAsBase64(file);
        console.log(`[stageBuffer] Base64 length: ${base64?.length ?? 'null'}`);
        const staged = await hostApiFetch<{
          id: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
          stagedPath: string;
          preview: string | null;
        }>('/api/files/stage-buffer', {
          method: 'POST',
          body: JSON.stringify({
            base64,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
          }),
        });
        console.log(`[stageBuffer] Staged: id=${staged?.id}, path=${staged?.stagedPath}, size=${staged?.fileSize}`);
        setAttachments(prev => prev.map(a =>
          a.id === tempId ? { ...staged, status: 'ready' as const } : a,
        ));
      } catch (err) {
        console.error(`[stageBuffer] Error staging ${file.name}:`, err);
        setAttachments(prev => prev.map(a =>
          a.id === tempId
            ? { ...a, status: 'error' as const, error: String(err) }
            : a,
        ));
      }
    }
  }, []);

  // ── Attachment management ──────────────────────────────────────

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const allReady = attachments.length === 0 || attachments.every(a => a.status === 'ready');
  const canSend = (input.trim() || attachments.length > 0) && allReady && !disabled && !sending;
  const canStop = sending && !disabled && !!onStop;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const readyAttachments = attachments.filter(a => a.status === 'ready');
    // Capture values before clearing — clear input immediately for snappy UX,
    // but keep attachments available for the async send
    const textToSend = input.trim();
    const attachmentsToSend = readyAttachments.length > 0 ? readyAttachments : undefined;
    console.log(`[handleSend] text="${textToSend.substring(0, 50)}", attachments=${attachments.length}, ready=${readyAttachments.length}, sending=${!!attachmentsToSend}`);
    if (attachmentsToSend) {
      console.log('[handleSend] Attachment details:', attachmentsToSend.map(a => ({
        id: a.id, fileName: a.fileName, mimeType: a.mimeType, fileSize: a.fileSize,
        stagedPath: a.stagedPath, status: a.status, hasPreview: !!a.preview,
      })));
    }
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(textToSend, attachmentsToSend, targetAgentId);
    setTargetAgentId(null);
    setPickerOpen(false);
  }, [input, attachments, canSend, onSend, targetAgentId]);

  const handleStop = useCallback(() => {
    if (!canStop) return;
    onStop?.();
  }, [canStop, onStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !input && targetAgentId) {
        setTargetAgentId(null);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const nativeEvent = e.nativeEvent as KeyboardEvent;
        if (isComposingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
          return;
        }
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, input, targetAgentId],
  );

  // Handle paste (Ctrl/Cmd+V with files)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: globalThis.File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        stageBufferFiles(pastedFiles);
      }
    },
    [stageBufferFiles],
  );

  // Handle drag & drop
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) {
        stageBufferFiles(Array.from(e.dataTransfer.files));
      }
    },
    [stageBufferFiles],
  );

  return (
    <div
      className={cn(
        "p-2 w-full mx-auto transition-all duration-300",
        isEmpty ? "max-w-3xl" : "max-w-4xl"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className={`relative bg-white dark:bg-card rounded-[28px] shadow-sm border p-1.5 transition-all ${dragOver ? 'border-primary ring-1 ring-primary' : 'border-black/10 dark:border-white/10'}`}>
          {selectedTarget && (
            <div className="px-2.5 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setTargetAgentId(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-primary/10"
                title={t('composer.clearTarget')}
              >
                <span>{t('composer.targetChip', { agent: selectedTarget.name })}</span>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            {/* Attach Button */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors"
              onClick={pickFiles}
              disabled={disabled || sending}
              title={t('composer.attachFiles')}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Voice Wake Toggle Button */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "shrink-0 h-10 w-10 rounded-full transition-colors",
                  wakeWordEnabled
                    ? "text-green-500 bg-green-50 dark:bg-green-900/30"
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground"
                )}
                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                disabled={disabled}
                title={wakeWordEnabled ? "语音唤醒已开启 - 点击说话" : "开启语音唤醒"}
              >
                <Mic className="h-4 w-4" />
              </Button>
              {wakeWordEnabled && !isListening && (
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap shadow-lg z-50"
                  style={{ background: 'var(--success)', color: 'white' }}
                >
                  唤醒已开启
                </span>
              )}
              {voiceError && (
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap shadow-lg z-50"
                  style={{ background: 'var(--card)', color: 'var(--error)', border: '1px solid var(--border)' }}
                >
                  {voiceError}
                </span>
              )}
            </div>

            {/* Floating Voice Bubble */}
            {wakeWordEnabled && (
              <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl transition-all",
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
                  )}
                  onClick={() => {
                    if (isListening) {
                      stopVoice();
                    } else {
                      startVoice();
                    }
                  }}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span className="text-[12px]">正在和{currentAgentName}说话...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span className="text-[12px]">对{currentAgentName}说话</span>
                    </>
                  )}
                </button>
                {isListening && listenText && (
                  <div className="mt-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-[12px] text-center max-w-xs">
                    {listenText}
                  </div>
                )}
              </div>
            )}

            {showAgentPicker && (
              <div ref={pickerRef} className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-10 w-10 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors',
                    (pickerOpen || selectedTarget) && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                  onClick={() => setPickerOpen((open) => !open)}
                  disabled={disabled || sending}
                  title={t('composer.pickAgent')}
                >
                  <AtSign className="h-4 w-4" />
                </Button>
                {pickerOpen && (
                  <div className="absolute left-0 bottom-full z-20 mb-2 w-72 overflow-hidden rounded-2xl border p-1.5 shadow-xl bg-white dark:bg-gray-800" style={{ borderColor: 'var(--border)' }}>
                    <div className="px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      {t('composer.agentPickerTitle', { currentAgent: currentAgentName })}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {mentionableAgents.map((agent) => (
                        <AgentPickerItem
                          key={agent.id}
                          agent={agent}
                          selected={agent.id === targetAgentId}
                          onSelect={() => {
                            setTargetAgentId(agent.id);
                            setPickerOpen(false);
                            textareaRef.current?.focus();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Textarea */}
            <div className="flex-1 relative">
              {/* 快捷回复选项 */}
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 py-1.5 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>快速回复：</span>
                  {quickReplies.map((reply, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickReplyClick(reply)}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-all hover:scale-105"
                      style={{
                        background: 'var(--theme-accent-blue)',
                        color: 'white',
                      }}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                onPaste={handlePaste}
                placeholder={disabled ? t('composer.gatewayDisconnectedPlaceholder') : '输入消息...'}
                disabled={disabled}
                className="min-h-[36px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent py-2 px-2 text-[13px] placeholder:text-muted-foreground/60 leading-relaxed"
                rows={1}
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={sending ? handleStop : handleSend}
              disabled={sending ? !canStop : !canSend}
              size="icon"
              className={`shrink-0 h-10 w-10 rounded-full transition-colors ${
                (sending || canSend)
                  ? 'bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10 dark:hover:bg-white/20'
                  : 'text-muted-foreground/50 hover:bg-transparent bg-transparent'
              }`}
              variant="ghost"
              title={sending ? t('composer.stop') : t('composer.send')}
            >
              {sending ? (
                <Square className="h-4 w-4" fill="currentColor" />
              ) : (
                <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>
        {/* 功能工具栏 - 思考模式 + 快捷功能 */}
        <div className="mt-1.5 flex items-center gap-2">
          {/* 思考模式选择 */}
          <ModeSelector />
          
          {/* 分隔线 - 使用边框代替黑线 */}
          <div className="w-px h-5" style={{ background: 'rgba(100,100,100,0.1)' }} />
          
          {/* 快捷功能 */}
          <div className="flex items-center gap-1">
            {/* 找灵感 */}
            <button
              className="input-toolbar-chip no-drag"
              disabled={disabled || sending}
              title="找灵感"
              onClick={() => navigate('/inspirations')}
            >
              <Sparkles className="h-3 w-3" />
              <span>找灵感</span>
            </button>
            {/* 图像生成 */}
            <button
              className="input-toolbar-chip no-drag"
              disabled={disabled || sending}
              title="图像生成"
              onClick={() => setInput(prev => prev + '/image ')}
            >
              <Image className="h-3 w-3" />
              <span>生图</span>
            </button>
            {/* 视频生成 */}
            <button
              className="input-toolbar-chip no-drag"
              disabled={disabled || sending}
              title="视频生成"
              onClick={() => setInput(prev => prev + '/video ')}
            >
              <Video className="h-3 w-3" />
              <span>视频</span>
            </button>
            {/* 编程助手 */}
            <button
              className="input-toolbar-chip no-drag"
              disabled={disabled || sending}
              title="编程助手"
              onClick={() => {
                setInput(prev => prev + ' [编程模式] ');
                textareaRef.current?.focus();
              }}
            >
              <Code className="h-3 w-3" />
              <span>编程</span>
            </button>
            {/* PPT生成 */}
            <button
              className="input-toolbar-chip no-drag"
              disabled={disabled || sending}
              title="PPT生成"
              onClick={() => setInput(prev => prev + '/ppt ')}
            >
              <Presentation className="h-3 w-3" />
              <span>PPT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModeSelector (思考模式选择) ─────────────────────────────
type Mode = 'fast' | 'think' | 'focus';

function ModeSelector() {
  const [selected, setSelected] = useState<Mode>('fast');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const modes = [
    { id: 'fast' as Mode, label: '快速', icon: Zap, desc: '即时响应' },
    { id: 'think' as Mode, label: '思考', icon: Brain, desc: '深度分析' },
    { id: 'focus' as Mode, label: '专注', icon: Target, desc: '精准回答' },
  ];

  const currentMode = modes.find(m => m.id === selected) || modes[0];
  const Icon = currentMode.icon;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="input-toolbar-chip no-drag"
        onClick={() => setOpen(!open)}
      >
        <Icon className="h-3 w-3" />
        <span>{currentMode.label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      
      {open && (
        <div className="absolute left-0 bottom-full z-20 mb-1 w-48 rounded-xl border shadow-lg overflow-hidden bg-white dark:bg-gray-800" style={{ borderColor: 'var(--border)' }}>
          <div className="px-3 py-2 text-[10px] font-medium" style={{ color: 'var(--text-muted)', background: 'var(--secondary)' }}>
            思考模式
          </div>
          <div className="py-1">
            {modes.map((mode) => {
              const MIcon = mode.icon;
              return (
                <button
                  key={mode.id}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-black/5 transition-colors"
                  onClick={() => {
                    setSelected(mode.id);
                    setOpen(false);
                  }}
                >
                  <MIcon className="h-4 w-4" style={{ color: selected === mode.id ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                  <div className="text-left">
                    <div className="text-[12px] font-medium" style={{ color: selected === mode.id ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                      {mode.label}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {mode.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attachment Preview ───────────────────────────────────────────

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: FileAttachment;
  onRemove: () => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/') && attachment.preview;

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border">
      {isImage ? (
        // Image thumbnail
        <div className="w-16 h-16">
          <img
            src={attachment.preview!}
            alt={attachment.fileName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        // Generic file card
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 max-w-[200px]">
          <FileIcon mimeType={attachment.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-medium truncate">{attachment.fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {attachment.fileSize > 0 ? formatFileSize(attachment.fileSize) : '...'}
            </p>
          </div>
        </div>
      )}

      {/* Staging overlay */}
      {attachment.status === 'staging' && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {attachment.status === 'error' && (
        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
          <span className="text-[10px] text-destructive font-medium px-1">Error</span>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function AgentPickerItem({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors',
        selected ? 'bg-primary/10 text-foreground' : 'hover:bg-black/5 dark:hover:bg-white/5'
      )}
    >
      <span className="text-[14px] font-medium text-foreground">{agent.name}</span>
      <span className="text-[11px] text-muted-foreground">
        {agent.modelDisplay}
      </span>
    </button>
  );
}
