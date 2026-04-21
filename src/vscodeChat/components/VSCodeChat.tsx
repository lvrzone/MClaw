/**
 * VSCodeChat - VS Code 风格聊天主组件
 * 移植自 VS Code Chat
 * 完整支持：思考内容(闪烁动画)、工具调用(状态机)、代码引用、拖拽上传、确认对话框
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  MoreVertical, MessageSquarePlus, User, Bot, Send, Square, Plus, Loader2, 
  ChevronDown, ChevronRight, Check, X, Paperclip, FileText, AlertTriangle,
  Copy, Trash2, ExternalLink, Clock, Sparkles, Terminal,
  Upload, File
} from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import type { ContentBlock } from '@/stores/chat';
import '../styles/chat.css';

// ==================== 类型定义 ====================

interface ToolUseBlock {
  type: 'tool_use' | 'toolCall' | 'tool-call';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  arguments?: unknown;
}

type ToolStatus = 'pending' | 'waiting_confirmation' | 'confirmed' | 'running' | 'completed' | 'error' | 'cancelled';


interface VSCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  name: string;
  status: ToolStatus;
  arguments?: string;
  result?: string;
  error?: string;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
}

interface SlashCommand {
  name: string;
  description: string;
  icon?: React.ReactNode;
}

const defaultSlashCommands: SlashCommand[] = [
  { name: 'help', description: '获取帮助和命令列表', icon: <Sparkles size={14} /> },
  { name: 'clear', description: '清空当前对话', icon: <Trash2 size={14} /> },
  { name: 'export', description: '导出会话记录', icon: <FileText size={14} /> },
  { name: 'terminal', description: '执行终端命令', icon: <Terminal size={14} /> },
];

interface DraggedFile {
  name: string;
  type: string;
  size: number;
  uri?: string;
}

// ==================== 工具函数 ====================

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getToolIcon(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name.includes('read') || name.includes('file')) return '📄';
  if (name.includes('write') || name.includes('edit')) return '✏️';
  if (name.includes('search') || name.includes('grep')) return '🔍';
  if (name.includes('run') || name.includes('exec')) return '⚡';
  if (name.includes('terminal') || name.includes('shell')) return '💻';
  if (name.includes('web') || name.includes('fetch')) return '🌐';
  if (name.includes('git')) return '📦';
  return '🔧';
}

function getToolDisplayName(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name.includes('read') || name.includes('file')) return '读取文件';
  if (name.includes('write') || name.includes('edit')) return '编辑文件';
  if (name.includes('search') || name.includes('grep')) return '搜索代码';
  if (name.includes('run') || name.includes('exec')) return '执行命令';
  if (name.includes('terminal') || name.includes('shell')) return '终端';
  return toolName;
}

// ==================== Markdown 渲染 ====================

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = '';
  let key = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeContent = '';
      } else {
        inCodeBlock = false;
        result.push(
          <div key={key++} className="vscode-chat-code-block">
            <div className="vscode-chat-code-header">
              <span className="vscode-chat-code-language">{codeLang || 'code'}</span>
              <button 
                className="vscode-chat-code-copy" 
                onClick={() => navigator.clipboard.writeText(codeContent)}
                title="复制代码"
              >
                <Copy size={12} />
              </button>
            </div>
            <pre className="vscode-chat-code-pre"><code>{codeContent}</code></pre>
          </div>
        );
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }
    
    if (line.startsWith('# ')) {
      result.push(<h1 key={key++} className="vscode-chat-h1">{line.slice(2)}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(<h2 key={key++} className="vscode-chat-h2">{line.slice(3)}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      result.push(<h3 key={key++} className="vscode-chat-h3">{line.slice(4)}</h3>);
      continue;
    }
    
    if (line.match(/^[\-\*]\s/)) {
      result.push(<li key={key++} className="vscode-chat-li">{renderInline(line.slice(2))}</li>);
      continue;
    }
    
    if (line.startsWith('> ')) {
      result.push(<blockquote key={key++} className="vscode-chat-blockquote">{renderInline(line.slice(2))}</blockquote>);
      continue;
    }
    
    if (line.match(/^[\-\*]{3,}$/)) {
      result.push(<hr key={key++} className="vscode-chat-hr" />);
      continue;
    }
    
    if (!line.trim()) {
      result.push(<div key={key++} className="vscode-chat-empty-line">&nbsp;</div>);
      continue;
    }
    
    result.push(<p key={key++} className="vscode-chat-p">{renderInline(line)}</p>);
  }
  
  return result;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const part = match[0];
    if (part.startsWith('`') && part.endsWith('`')) {
      parts.push(<code key={key++} className="vscode-inline-code">{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**')) {
      parts.push(<strong key={key++}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('*') && part.endsWith('*')) {
      parts.push(<em key={key++}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith('[') && part.includes('](')) {
      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} className="vscode-chat-link" target="_blank" rel="noopener">
            {linkMatch[1]}
            <ExternalLink size={10} />
          </a>
        );
      }
    }
    lastIndex = match.index + part.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

// ==================== 思考内容组件 (增强版 - 闪烁动画) ====================

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  title?: string;
}

function ThinkingBlock({ content, isStreaming = false, title }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(!isStreaming);
  const [showShimmer, setShowShimmer] = useState(isStreaming);
  
  useEffect(() => {
    if (isStreaming) {
      setShowShimmer(true);
    } else {
      const timer = setTimeout(() => setShowShimmer(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);
  
  return (
    <div className={`vscode-chat-thinking ${expanded ? 'expanded' : 'collapsed'} ${showShimmer ? 'shimmering' : ''}`}>
      <div className="vscode-chat-thinking-connector" />
      <div className="vscode-chat-thinking-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-thinking-expand">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="vscode-chat-thinking-icon">🤔</span>
        <span className="vscode-chat-thinking-label">
          {showShimmer ? (
            <span className="vscode-chat-thinking-shimmer-text">
              {title || '正在思考...'}
            </span>
          ) : (
            title || '思考内容'
          )}
        </span>
        {isStreaming && (
          <span className="vscode-chat-thinking-spinner">
            <Loader2 size={12} className="vscode-spin" />
          </span>
        )}
      </div>
      {expanded && (
        <div className="vscode-chat-thinking-content">
          <pre className="vscode-chat-thinking-pre">{content}</pre>
        </div>
      )}
    </div>
  );
}

// ==================== 工具调用组件 (完整状态机) ====================

interface ToolCallItemProps {
  tool: ToolCall;
}

function ToolCallItem({ tool }: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(true);
  
  const getStatusIcon = () => {
    switch (tool.status) {
      case 'pending':
        return <Clock size={14} className="vscode-chat-tool-status-icon pending" />;
      case 'waiting_confirmation':
        return <AlertTriangle size={14} className="vscode-chat-tool-status-icon waiting" />;
      case 'confirmed':
      case 'running':
        return <Loader2 size={14} className="vscode-spin vscode-chat-tool-status-icon running" />;
      case 'completed':
        return <Check size={14} className="vscode-chat-tool-status-icon completed" />;
      case 'error':
        return <X size={14} className="vscode-chat-tool-status-icon error" />;
      case 'cancelled':
        return <X size={14} className="vscode-chat-tool-status-icon cancelled" />;
      default:
        return null;
    }
  };
  
  const getStatusText = () => {
    switch (tool.status) {
      case 'pending': return '等待中';
      case 'waiting_confirmation': return '等待确认';
      case 'confirmed': return '已确认';
      case 'running': return '执行中';
      case 'completed': return '已完成';
      case 'error': return '错误';
      case 'cancelled': return '已取消';
      default: return tool.status;
    }
  };
  
  const getDuration = () => {
    if (tool.startedAt && tool.completedAt) {
      return formatDuration(tool.completedAt - tool.startedAt);
    }
    if (tool.startedAt) {
      return formatDuration(Date.now() - tool.startedAt);
    }
    return null;
  };
  
  let argsObj: Record<string, unknown> | null = null;
  try {
    if (tool.arguments) {
      argsObj = JSON.parse(tool.arguments);
    }
  } catch {}
  
  const hasResult = tool.result || tool.error;
  
  return (
    <div className={`vscode-chat-tool-call ${tool.status}`}>
      <div className="vscode-chat-tool-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-tool-expand">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="vscode-chat-tool-icon">{getToolIcon(tool.name)}</span>
        <span className="vscode-chat-tool-name">{getToolDisplayName(tool.name)}</span>
        <span className="vscode-chat-tool-status">{getStatusText()}</span>
        {getStatusIcon()}
      </div>
      
      {tool.status === 'running' && tool.progress !== undefined && (
        <div className="vscode-chat-tool-progress-bar">
          <div 
            className="vscode-chat-tool-progress-fill" 
            style={{ width: `${Math.min(tool.progress * 100, 100)}%` }}
          />
        </div>
      )}
      
      {expanded && (
        <div className="vscode-chat-tool-content">
          {argsObj && (
            <div className="vscode-chat-tool-section">
              <div className="vscode-chat-tool-section-header">
                <span>输入</span>
                <button 
                  className="vscode-chat-tool-copy-btn"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(argsObj, null, 2))}
                  title="复制"
                >
                  <Copy size={12} />
                </button>
              </div>
              <div className="vscode-chat-tool-args">
                <pre className="vscode-chat-tool-args-pre">
                  <code>{JSON.stringify(argsObj, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}
          
          {hasResult && (
            <div className="vscode-chat-tool-section">
              <div className={`vscode-chat-tool-section-header ${tool.error ? 'error' : ''}`}>
                <span>{tool.error ? '错误' : '输出'}</span>
                <span className="vscode-chat-tool-duration">{getDuration()}</span>
              </div>
              <div className={tool.error ? 'vscode-chat-tool-error' : 'vscode-chat-tool-result'}>
                <pre>{tool.error || (typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2))}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 拖拽上传组件 ====================

interface DragDropZoneProps {
  onFilesDropped: (files: DraggedFile[]) => void;
  children: React.ReactNode;
}

function DragDropZone({ onFilesDropped, children }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<DraggedFile[]>([]);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const files = Array.from(e.dataTransfer.files).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      uri: undefined
    }));
    setDraggedFiles(files);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
    setDraggedFiles([]);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      uri: undefined
    }));
    
    if (files.length > 0) {
      onFilesDropped(files);
    }
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
              {draggedFiles.map((file, index) => (
                <div key={index} className="vscode-chat-drag-drop-file">
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

// ==================== 附件列表组件 ====================

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
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

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
  const storeMessages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const sending = useChatStore((s) => s.sending);
  const loading = useChatStore((s) => s.loading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  
  const [inputValue, setInputValue] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<DraggedFile[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  
  const isStreaming = sending || loading;
  
  const transformMessage = useCallback((msg: typeof storeMessages[number]): VSCodeMessage => {
    let textContent = '';
    let thinkingContent = '';
    const toolCalls: ToolCall[] = [];
    
    const content = msg.content;
    
    if (typeof content === 'string') {
      textContent = content;
    } else if (Array.isArray(content)) {
      for (const block of content as ContentBlock[]) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        }
        if ((block.type === 'thinking' || block.type === 'reasoning') && (block as { thinking?: string }).thinking) {
          thinkingContent += (block as { thinking?: string }).thinking || (block as { reasoning?: string }).reasoning || '';
        }
        if ((block.type === 'tool_use' || block.type === 'toolCall' || block.type === 'tool-call') && (block as ToolUseBlock).name) {
          const tb = block as ToolUseBlock;
          toolCalls.push({
            id: tb.id || `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: tb.name || 'unknown',
            status: 'completed',
            arguments: JSON.stringify(tb.input || tb.arguments || {}),
            startedAt: Date.now(),
            completedAt: Date.now()
          });
        }
      }
    }
    
    return {
      id: msg.id || `msg-${msg.timestamp || Date.now()}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: textContent,
      thinking: thinkingContent,
      timestamp: msg.timestamp || Date.now(),
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }, []);
  
  const messages = useMemo(() => storeMessages.map(transformMessage), [storeMessages, transformMessage]);
  
  const streamData = useMemo(() => {
    let text = '';
    let thinking = '';
    const tools: ToolCall[] = [];
    
    if (streamingMessage) {
      if (typeof streamingMessage === 'string') {
        text = streamingMessage;
      } else if (typeof streamingMessage === 'object') {
        const sm = streamingMessage as { content?: unknown };
        if (typeof sm.content === 'string') {
          text = sm.content;
        } else if (Array.isArray(sm.content)) {
          for (const block of sm.content as ContentBlock[]) {
            if (block.type === 'text' && block.text) text += block.text;
            if ((block.type === 'thinking' || block.type === 'reasoning') && (block as { thinking?: string }).thinking) {
              thinking += (block as { thinking?: string }).thinking || '';
            }
            if ((block.type === 'tool_use' || block.type === 'toolCall' || block.type === 'tool-call') && (block as ToolUseBlock).name) {
              const tb = block as ToolUseBlock;
              tools.push({
                id: tb.id || `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: tb.name || 'unknown',
                status: 'running',
                arguments: JSON.stringify(tb.input || {}),
                startedAt: Date.now()
              });
            }
          }
        }
      }
    }
    
    return { text, thinking, tools };
  }, [streamingMessage]);
  
  const scrollToBottom = useCallback((force = false) => {
    if (!listRef.current) return;
    const shouldScroll = force || isAtBottomRef.current || isStreaming;
    if (!shouldScroll) return;
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, [isStreaming]);
  
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);
  
  useEffect(() => {
    scrollToBottom(messages.length === 1);
  }, [messages, scrollToBottom]);
  
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => scrollToBottom(true), 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming, scrollToBottom]);
  
  const handleFilesDrop = useCallback((files: DraggedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  }, []);
  
  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const handleSend = useCallback(async (content?: string) => {
    const text = content || inputValue.trim();
    if (!text && attachedFiles.length === 0) return;
    
    setInputValue('');
    setShowSlashMenu(false);
    setAttachedFiles([]);
    
    const messageWithFiles = attachedFiles.length > 0 
      ? `${text}\n\n[附件: ${attachedFiles.map(f => f.name).join(', ')}]`
      : text;
    
    await sendMessage(messageWithFiles);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [inputValue, attachedFiles, sendMessage]);
  
  const handleStop = useCallback(() => {
    abortRun?.();
  }, [abortRun]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(value.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  }, []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && showSlashMenu) {
      setShowSlashMenu(false);
    }
  }, [handleSend, showSlashMenu]);
  
  const handleClear = useCallback(() => {
    setShowHeaderMenu(false);
  }, []);
  
  const handleExport = useCallback(() => {
    const exportText = messages.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}:\n${m.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(exportText);
    setShowHeaderMenu(false);
  }, [messages]);
  
  const handleNewChat = useCallback(() => {
    setInputValue('');
    setShowHeaderMenu(false);
  }, []);
  
  const filteredCommands = slashFilter
    ? defaultSlashCommands.filter(cmd => cmd.name.toLowerCase().includes(slashFilter))
    : defaultSlashCommands;
  
  const renderMessages = () => {
    if (messages.length === 0 && !streamData.text && !streamData.thinking) {
      return (
        <div className="vscode-chat-empty-state">
          <div className="vscode-chat-empty-icon">💬</div>
          <div className="vscode-chat-empty-title">开始新对话</div>
          <div className="vscode-chat-empty-subtitle">输入消息开始聊天，或使用 <code>/</code> 查看可用命令</div>
          <div className="vscode-chat-empty-hint">
            <Paperclip size={14} />
            <span>也可以拖放文件到此处</span>
          </div>
        </div>
      );
    }
    
    return (
      <>
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          const showStreaming = isLast && isStreaming;
          
          return (
            <div key={message.id} className={`vscode-chat-message ${message.role} ${showStreaming ? 'streaming' : ''}`}>
              <div className="vscode-chat-avatar">
                {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="vscode-chat-message-content">
                <div className="vscode-chat-message-meta">
                  <span className="vscode-chat-sender-name">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <span className="vscode-chat-timestamp">{formatTime(message.timestamp)}</span>
                  {showStreaming && (
                    <span className="vscode-chat-streaming-indicator">
                      <Loader2 size={12} className="vscode-spin" />
                      <span>生成中...</span>
                    </span>
                  )}
                </div>
                
                <div className="vscode-chat-message-body">
                  {message.thinking && (
                    <ThinkingBlock content={message.thinking} isStreaming={showStreaming} />
                  )}
                  
                  {message.tool_calls?.map((tc) => (
                    <ToolCallItem key={tc.id} tool={tc} />
                  ))}
                  
                  {message.content && (
                    <div className="vscode-chat-markdown">
                      {renderMarkdown(message.content)}
                    </div>
                  )}
                  
                  {showStreaming && streamData.text && (
                    <div className="vscode-chat-markdown vscode-chat-streaming">
                      {renderMarkdown(streamData.text)}
                      <span className="vscode-chat-streaming-cursor">▊</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  };
  
  return (
    <DragDropZone onFilesDropped={handleFilesDrop}>
      <div className={`vscode-chat ${className}`}>
        <div className="vscode-chat-header">
          <div className="vscode-chat-header-title">
            <MessageSquarePlus size={18} />
            <span>{title}</span>
          </div>
          
          <div className="vscode-chat-header-actions">
            <div style={{ position: 'relative' }}>
              <button className="vscode-chat-header-button" onClick={() => setShowHeaderMenu(!showHeaderMenu)} title="更多选项">
                <MoreVertical size={18} />
              </button>
              
              {showHeaderMenu && (
                <div className="vscode-chat-slash-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 160, zIndex: 100 }}>
                  <button className="vscode-chat-slash-menu-item" onClick={handleNewChat}>
                    <span className="vscode-chat-slash-command-name">新建对话</span>
                  </button>
                  <button className="vscode-chat-slash-menu-item" onClick={handleExport}>
                    <span className="vscode-chat-slash-command-name">复制对话</span>
                  </button>
                  <div style={{ borderTop: '1px solid var(--vscode-chat-border-subtle)', margin: '4px 0' }} />
                  <button className="vscode-chat-slash-menu-item" onClick={handleClear}>
                    <span className="vscode-chat-slash-command-name" style={{ color: 'var(--vscode-chat-error)' }}>清空对话</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div ref={listRef} className="vscode-chat-response-list" onScroll={handleScroll}>
          {renderMessages()}
        </div>
        
        <div className="vscode-chat-input-container">
          <AttachmentsList files={attachedFiles} onRemove={handleRemoveFile} />
          
          {showSlashMenu && filteredCommands.length > 0 && (
            <div className="vscode-chat-slash-menu">
              <div className="vscode-chat-slash-menu-header">命令</div>
              <div className="vscode-chat-slash-menu-list">
                {filteredCommands.map(cmd => (
                  <button
                    key={cmd.name}
                    className="vscode-chat-slash-menu-item"
                    onClick={() => {
                      setInputValue(`/${cmd.name} `);
                      setShowSlashMenu(false);
                      textareaRef.current?.focus();
                    }}
                  >
                    {cmd.icon && <span className="vscode-chat-slash-command-icon">{cmd.icon}</span>}
                    <span className="vscode-chat-slash-command-name">/{cmd.name}</span>
                    <span className="vscode-chat-slash-command-desc">{cmd.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="vscode-chat-input-wrapper">
            <button className="vscode-chat-input-action" title="附加文件">
              <Plus size={18} />
            </button>
            
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
            
            {isStreaming ? (
              <button className="vscode-chat-input-action send stop" onClick={handleStop} title="停止生成">
                <Square size={18} />
              </button>
            ) : (
              <button className="vscode-chat-input-action send" onClick={() => handleSend()} disabled={!inputValue.trim() && attachedFiles.length === 0} title="发送消息">
                <Send size={18} />
              </button>
            )}
          </div>
          
          <div className="vscode-chat-input-footer">
            <span className="vscode-chat-hint">
              <kbd>Enter</kbd> 发送 · <kbd>Shift+Enter</kbd> 换行 · <kbd>/</kbd> 命令 · 拖放文件上传
            </span>
          </div>
        </div>
        
        {showHeaderMenu && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowHeaderMenu(false)} />
        )}
      </div>
    </DragDropZone>
  );
}

export default VSCodeChat;
