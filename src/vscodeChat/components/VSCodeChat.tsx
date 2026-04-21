/**
 * VSCodeChat - VS Code 风格聊天主组件（完整版）
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MoreVertical, MessageSquarePlus, Send, Square,
  Plus, X, Copy, Trash2, ChevronDown,
  Upload, File, History, Sparkles, Bot,
  Settings, Clock, Brain,
  Zap, CheckSquare
} from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { ChatResponseList } from './ChatResponseList';
import { type ChatMessageProps } from './ChatMessageItem';
import { SessionPicker } from './sessions';
import { SlashCommandPicker } from './sessions/SlashCommandPicker';
import Confirmation from './Confirmation';
import '../styles/chat.css';
import { CheckpointTimeline } from './sessions/CheckpointTimeline';

// ==================== 类型 ============
interface DraggedFile {
  name: string;
  type: string;
  size: number;
  uri?: string;
}

interface Tool {
  id: string;
  name: string;
  enabled: boolean;
}

interface Mode {
  id: string;
  name: string;
  icon: typeof Brain;
  description: string;
}

// ==================== 工具函数 ============
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ==================== 附件列表 ============
interface AttachmentsListProps {
  files: DraggedFile[];
  onRemove: (index: number) => void;
}

function AttachmentsList({ files, onRemove }: AttachmentsListProps) {
  if (files.length === 0) return null;
  return (
    <div className="vscode-chat-attachments">
      <div className="vscode-chat-attachments-list">
        {files.map((file, index) => (
          <div key={index} className="vscode-chat-attachment-item">
            <File size={14} className="vscode-chat-attachment-icon" />
            <span className="vscode-chat-attachment-name">{file.name}</span>
            <span className="vscode-chat-attachment-size">{formatFileSize(file.size)}</span>
            <button
              className="vscode-chat-attachment-remove"
              onClick={() => onRemove(index)}
              title="移除"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 拖拽上传 ============
interface DragDropZoneProps {
  onFilesDropped: (files: DraggedFile[]) => void;
  children: React.ReactNode;
}

function DragDropZone({ onFilesDropped, children }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<DraggedFile[]>([]);
  const dragCountRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    if (dragCountRef.current === 1) {
      setIsDragging(true);
      const files = Array.from(e.dataTransfer.files).map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }));
      setDraggedFiles(files);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
      setDraggedFiles([]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
    }));
    if (files.length > 0) onFilesDropped(files);
    setDraggedFiles([]);
  }, [onFilesDropped]);

  return (
    <div
      className="vscode-chat-drag-drop-zone"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="vscode-chat-drag-drop-overlay">
          <div className="vscode-chat-drag-drop-content">
            <Upload size={48} className="vscode-chat-drag-drop-icon" />
            <div className="vscode-chat-drag-drop-title">拖放文件到此处</div>
            <div className="vscode-chat-drag-drop-files">
              {draggedFiles.map((file, i) => (
                <div key={i} className="vscode-chat-drag-drop-file">
                  <File size={14} />
                  <span>{file.name}</span>
                  <span className="vscode-chat-drag-drop-size">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 主组件 ============
interface VSCodeChatProps {
  title?: string;
  placeholder?: string;
  className?: string;
}

export function VSCodeChat({
  title = 'Chat',
  placeholder = '输入消息或 / 查看命令...',
  className = '',
}: VSCodeChatProps) {
  // ========== Store ==========
  const storeMessages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const sending = useChatStore((s) => s.sending);
  const loading = useChatStore((s) => s.loading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const newSession = useChatStore((s) => s.newSession);
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const toolConfirm = useChatStore((s) => s.toolConfirm);
  const resolveToolConfirm = useChatStore((s) => s.resolveToolConfirm);

  // ========== Local State ==========
  const [inputValue, setInputValue] = useState('');
  const [slashFilter, setSlashFilter] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showCheckpointTimeline, setShowCheckpointTimeline] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<DraggedFile[]>([]);
  const [selectedMode, setSelectedMode] = useState('auto');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const toolPickerRef = useRef<HTMLDivElement>(null);
  const modePickerRef = useRef<HTMLDivElement>(null);
  const agentPickerRef = useRef<HTMLDivElement>(null);

  const isStreaming = sending || loading;

  // ========== 工具列表 ==========
  const [tools, setTools] = useState<Tool[]>([
    { id: 'file-read', name: '读取文件', enabled: true },
    { id: 'file-write', name: '写入文件', enabled: true },
    { id: 'terminal', name: '终端命令', enabled: true },
    { id: 'web-search', name: '网络搜索', enabled: false },
    { id: 'code-execute', name: '执行代码', enabled: true },
  ]);

  // ========== 思考模式 ==========
  const modes: Mode[] = [
    { id: 'auto', name: '自动', icon: Zap, description: '智能选择思考深度' },
    { id: 'think', name: '深度思考', icon: Brain, description: '详细分析问题' },
    { id: 'fast', name: '快速响应', icon: Zap, description: '最小化思考' },
  ];

  // ========== 消息列表 ==========
  const messages: ChatMessageProps['message'][] = useMemo(() => {
    return storeMessages.map((msg, idx) => ({
      id: msg.id || `msg-${msg.timestamp || idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content as string | unknown[],
      timestamp: msg.timestamp,
      tool_call_id: msg.toolCallId,
    }));
  }, [storeMessages]);

  // 流式消息
  const streamContent = useMemo((): string | null => {
    if (!isStreaming || !streamingMessage) return null;
    if (typeof streamingMessage === 'string') return streamingMessage;
    if (typeof streamingMessage === 'object') {
      const sm = streamingMessage as { content?: string };
      if (typeof sm.content === 'string') return sm.content;
    }
    return null;
  }, [isStreaming, streamingMessage]);

  const displayMessages = useMemo((): ChatMessageProps['message'][] => {
    if (!isStreaming || !streamContent) return messages;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return messages;
    return [
      ...messages.slice(0, -1),
      {
        ...last,
        content: typeof last.content === 'string'
          ? last.content + streamContent
          : streamContent,
      },
    ];
  }, [messages, isStreaming, streamContent]);

  // ========== 自动调整 textarea 高度 ==========
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [inputValue]);

  // ========== 关闭所有 picker ==========
  const closeAllPickers = useCallback(() => {
    setShowToolPicker(false);
    setShowModePicker(false);
    setShowAgentPicker(false);
    setShowSlashMenu(false);
  }, []);

  // ========== 斜杠命令处理 ==========
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(value.slice(1).trim());
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: { name: string }) => {
    if (cmd.name === 'clear') {
      newSession();
      setShowSlashMenu(false);
      setInputValue('');
    } else if (cmd.name === 'help') {
      setInputValue('/help ');
      setShowSlashMenu(false);
      textareaRef.current?.focus();
    } else if (cmd.name === 'export') {
      const exportText = displayMessages.map((m) => {
        const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `${m.role === 'user' ? 'You' : 'Assistant'}:\n${text}`;
      }).join('\n\n---\n\n');
      navigator.clipboard.writeText(exportText).then(() => alert('对话已复制'));
      setShowSlashMenu(false);
    } else {
      setInputValue(`/${cmd.name} `);
      setShowSlashMenu(false);
      textareaRef.current?.focus();
    }
  }, [displayMessages, newSession]);

  // ========== 发送消息 ==========
  const handleSend = useCallback(async (textOverride?: string) => {
    const text = textOverride ?? inputValue.trim();
    if (!text && attachedFiles.length === 0) return;
    setInputValue('');
    setShowSlashMenu(false);
    setAttachedFiles([]);
    const withFiles = attachedFiles.length > 0
      ? `${text}\n\n[附件: ${attachedFiles.map((f) => f.name).join(', ')}]`
      : text;
    await sendMessage(withFiles);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [inputValue, attachedFiles, sendMessage]);

  // ========== 键盘事件 ==========
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      closeAllPickers();
      return;
    }
    if (showSlashMenu) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showSlashMenu, handleSend, closeAllPickers]);

  const handleStop = useCallback(() => {
    abortRun?.();
  }, [abortRun]);

  // ========== 附件 ==========
  const handleFilesDrop = useCallback((files: DraggedFile[]) => {
    setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ========== Header 菜单 ==========
  const handleNewChat = useCallback(() => {
    newSession();
    setInputValue('');
    setShowHeaderMenu(false);
  }, [newSession]);

  const handleExport = useCallback(() => {
    const text = displayMessages.map((m) => {
      const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${m.role === 'user' ? 'You' : 'Assistant'}:\n${c}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => alert('对话已复制'));
    setShowHeaderMenu(false);
  }, [displayMessages]);

  // ========== 工具切换 ==========
  const handleToggleTool = useCallback((toolId: string) => {
    setTools(prev => prev.map(t =>
      t.id === toolId ? { ...t, enabled: !t.enabled } : t
    ));
  }, []);

  // ========== Agent 选择 ==========
  const switchAgent = useChatStore((s) => s.switchAgent);
  const handleSelectAgent = useCallback((agentId: string) => {
    console.log('Selected agent:', agentId);
    switchAgent(agentId);
    setShowAgentPicker(false);
  }, [switchAgent]);

  // ========== 触发文件选择 ==========
  const handleFilePick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      handleFilesDrop(files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })));
    };
    input.click();
  }, [handleFilesDrop]);

  // ========== 点击外部关闭 picker ==========
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolPickerRef.current && !toolPickerRef.current.contains(e.target as Node)) {
        setShowToolPicker(false);
      }
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
        setShowModePicker(false);
      }
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ========== 当前会话标签 ==========
  const currentSession = sessions.find((s) => s.key === currentSessionKey);
  const sessionLabel = currentSession?.displayName
    || currentSession?.label
    || currentSessionKey.split(':').pop()
    || '新对话';

  // ========== 当前 Agent 信息 ==========
  const agentList = agents.map((a) => ({ id: a.id, name: a.name, model: a.modelDisplay }));

  // ========== 渲染工具选择器 ==========
  const renderToolPicker = () => (
    <div ref={toolPickerRef} className="vscode-chat-popover">
      <div className="vscode-chat-popover-header">
        <Settings size={14} />
        <span>选择工具</span>
        <button className="vscode-chat-popover-close" onClick={() => setShowToolPicker(false)}>
          <X size={14} />
        </button>
      </div>
      <div className="vscode-chat-popover-list">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`vscode-chat-popover-item ${tool.enabled ? 'enabled' : ''}`}
            onClick={() => handleToggleTool(tool.id)}
          >
            <div className="vscode-chat-popover-checkbox">
              {tool.enabled ? <CheckSquare size={14} /> : <Square size={14} />}
            </div>
            <span>{tool.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ========== 渲染模式选择器 ==========
  const renderModePicker = () => {
    return (
      <div ref={modePickerRef} className="vscode-chat-popover">
        <div className="vscode-chat-popover-header">
          <Brain size={14} />
          <span>思考模式</span>
          <button className="vscode-chat-popover-close" onClick={() => setShowModePicker(false)}>
            <X size={14} />
          </button>
        </div>
        <div className="vscode-chat-popover-list">
          {modes.map((mode) => {
            const ModeIcon = mode.icon;
            return (
              <button
                key={mode.id}
                className={`vscode-chat-popover-item ${selectedMode === mode.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMode(mode.id);
                  setShowModePicker(false);
                }}
              >
                <ModeIcon size={14} className="vscode-chat-popover-icon" />
                <div className="vscode-chat-popover-content">
                  <span className="vscode-chat-popover-title">{mode.name}</span>
                  <span className="vscode-chat-popover-desc">{mode.description}</span>
                </div>
                {selectedMode === mode.id && <CheckSquare size={14} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== 渲染 Agent 选择器 ==========
  const renderAgentPicker = () => (
    <div ref={agentPickerRef} className="vscode-chat-popover">
      <div className="vscode-chat-popover-header">
        <Bot size={14} />
        <span>选择 Agent</span>
        <button className="vscode-chat-popover-close" onClick={() => setShowAgentPicker(false)}>
          <X size={14} />
        </button>
      </div>
      <div className="vscode-chat-popover-list">
        {agentList.map((agent) => (
          <button
            key={agent.id}
            className={`vscode-chat-popover-item ${currentAgentId === agent.id ? 'selected' : ''}`}
            onClick={() => handleSelectAgent(agent.id)}
          >
            <Bot size={14} className="vscode-chat-popover-icon" />
            <div className="vscode-chat-popover-content">
              <span className="vscode-chat-popover-title">{agent.name}</span>
              {agent.model && <span className="vscode-chat-popover-desc">{agent.model}</span>}
            </div>
            {currentAgentId === agent.id && <CheckSquare size={14} />}
          </button>
        ))}
        {agentList.length === 0 && (
          <div className="vscode-chat-popover-empty">暂无 Agent</div>
        )}
      </div>
    </div>
  );

  // ========== 渲染 ==========
  return (
    <DragDropZone onFilesDropped={handleFilesDrop}>
      <div className={`vscode-chat ${className}`}>

        {/* ── Header ── */}
        <div className="vscode-chat-header">
          <div className="vscode-chat-header-title">
            <MessageSquarePlus size={18} />
            <span>{title}</span>
          </div>

          {/* Session 切换按钮 */}
          <button
            className="vscode-chat-session-label"
            onClick={() => setShowSessionPicker(true)}
            title="切换会话"
          >
            <History size={14} />
            <span>{sessionLabel}</span>
            <ChevronDown size={12} />
          </button>

          {/* 右侧操作区 */}
          <div className="vscode-chat-header-actions">
            {/* Thinking 开关 */}
            <button
              className={`vscode-chat-header-button ${showThinking ? 'active' : ''}`}
              onClick={toggleThinking}
              title={showThinking ? '隐藏思考过程' : '显示思考过程'}
            >
              <Sparkles size={16} />
            </button>

            {/* Checkpoint 版本历史 */}
            <button
              className="vscode-chat-header-button"
              onClick={() => setShowCheckpointTimeline(true)}
              title="版本历史"
            >
              <Clock size={16} />
            </button>

            <button
              className="vscode-chat-header-button"
              onClick={() => {
                console.log('More button clicked, showHeaderMenu:', !showHeaderMenu);
                setShowHeaderMenu(!showHeaderMenu);
              }}
              title="更多选项"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* ── Header 下拉菜单 ── */}
        {showHeaderMenu && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => {
              console.log('Overlay clicked, closing menu');
              setShowHeaderMenu(false);
            }}
          >
            <div
              className="vscode-chat-header-menu"
              style={{
                position: 'absolute',
                right: '12px',
                top: '52px',
                zIndex: 1000
              }}
            >
              <button className="vscode-chat-header-menu-item" onClick={handleNewChat}>
                <History size={13} />
                <span>新建对话</span>
              </button>
              <button className="vscode-chat-header-menu-item" onClick={handleExport}>
                <Copy size={13} />
                <span>复制对话</span>
              </button>
              <button
                className="vscode-chat-header-menu-item"
                onClick={() => {
                  // 测试工具确认对话框
                  useChatStore.getState().requestToolConfirm(
                    'test-123',
                    'delete_file',
                    '删除 /tmp/test.txt 文件',
                    { path: '/tmp/test.txt' }
                  );
                  setShowHeaderMenu(false);
                }}
              >
                <Zap size={13} />
                <span>测试确认对话框</span>
              </button>
              <div className="vscode-chat-header-menu-divider" />
              <button
                className="vscode-chat-header-menu-item danger"
                onClick={() => {
                  newSession();
                  setShowHeaderMenu(false);
                }}
              >
                <Trash2 size={13} />
                <span>清空对话</span>
              </button>
            </div>
          </div>
        )}

        {/* ── 消息列表 ── */}
        <ChatResponseList
          messages={displayMessages}
          isStreaming={isStreaming}
          showThinking={showThinking}
        />

        {/* ── 工具确认对话框 ── */}
        {toolConfirm && (
          <div className="vscode-chat-confirmation-container">
            <Confirmation
              message={`工具 "${toolConfirm.toolName}" 请求执行：${toolConfirm.description}`}
              isWarning={true}
              options={[
                { label: '允许', value: 'allow' },
                { label: '拒绝', value: 'deny' },
              ]}
              onConfirm={(value) => {
                resolveToolConfirm(value === 'allow');
              }}
              onDismiss={() => resolveToolConfirm(false)}
            />
          </div>
        )}

        {/* ── 版本历史时间线 ── */}
        {showCheckpointTimeline && (
          <CheckpointTimeline onClose={() => setShowCheckpointTimeline(false)} />
        )}

        {/* ── 输入区 ── */}
        <div className="vscode-chat-input-container">
          <AttachmentsList files={attachedFiles} onRemove={handleRemoveFile} />

          {/* Slash 命令菜单 */}
          {showSlashMenu && (
            <div ref={slashMenuRef}>
              <SlashCommandPicker
                filter={slashFilter}
                onSelect={handleSlashSelect}
                onClose={() => setShowSlashMenu(false)}
              />
            </div>
          )}

          {/* 输入工具栏 */}
          <div className="vscode-chat-input-toolbar">
            {/* 左侧工具栏按钮 */}
            <div className="vscode-chat-input-actions">
              {/* 附加文件 */}
              <button
                className="vscode-chat-toolbar-btn"
                onClick={handleFilePick}
                title="附加文件"
              >
                <Plus size={16} />
              </button>

              {/* 工具选择 */}
              <button
                className={`vscode-chat-toolbar-btn ${tools.some(t => !t.enabled) ? 'partial' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowToolPicker(!showToolPicker);
                  setShowModePicker(false);
                  setShowAgentPicker(false);
                }}
                title="选择工具"
              >
                <Settings size={16} />
                {tools.some(t => !t.enabled) && <span className="vscode-chat-toolbar-badge" />}
              </button>

              {/* 模式选择 */}
              <button
                className="vscode-chat-toolbar-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModePicker(!showModePicker);
                  setShowToolPicker(false);
                  setShowAgentPicker(false);
                }}
                title="思考模式"
              >
                <Brain size={16} />
              </button>

              {/* Agent 选择 */}
              <button
                className="vscode-chat-toolbar-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAgentPicker(!showAgentPicker);
                  setShowToolPicker(false);
                  setShowModePicker(false);
                }}
                title="选择 Agent"
              >
                <Bot size={16} />
              </button>
            </div>

            {/* 浮层选择器 */}
            <div className="vscode-chat-picker-container">
              {showToolPicker && renderToolPicker()}
              {showModePicker && renderModePicker()}
              {showAgentPicker && renderAgentPicker()}
            </div>
          </div>

          {/* 输入框区域 */}
          <div className="vscode-chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="vscode-chat-input"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              spellCheck={false}
            />

            {/* 发送按钮 */}
            {isStreaming ? (
              <button
                className="vscode-chat-input-action stop"
                onClick={handleStop}
                title="停止生成"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                className="vscode-chat-input-action send"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() && attachedFiles.length === 0}
                title="发送消息"
              >
                <Send size={18} />
              </button>
            )}
          </div>

          <div className="vscode-chat-input-footer">
            <span className="vscode-chat-hint">
              <kbd>Enter</kbd> 发送 · <kbd>Shift+Enter</kbd> 换行 · <kbd>/</kbd> 命令
            </span>
          </div>
        </div>

        {/* ── Session Picker ── */}
        {showSessionPicker && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 300 }}>
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setShowSessionPicker(false)}
            />
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 400, maxHeight: '70vh' }}>
              <SessionPicker onClose={() => setShowSessionPicker(false)} />
            </div>
          </div>
        )}
      </div>
    </DragDropZone>
  );
}

export default VSCodeChat;
