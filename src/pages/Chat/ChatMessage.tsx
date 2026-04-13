/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with markdown, thinking sections, images, and tool cards.
 * 性能优化：使用 useMemo 缓存派生数据
 */
import { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { Copy, Check, Wrench, FileText, Film, Music, FileArchive, File, X, FolderOpen, ZoomIn, ChevronDown, ChevronRight, Brain, Terminal, FileEdit, FileSearch, Search, Globe, Code2 } from 'lucide-react';

import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import type { RawMessage, AttachedFileMeta } from '@/stores/chat';
import { extractText, extractThinking, extractImages, extractToolUse, formatTimestamp } from './message-utils';
import { TaskCollapsibleContent } from '@/components/TaskCollapsibleContent';
import { TaskProgress } from '@/components/TaskProgress';

interface ChatMessageProps {
  message: RawMessage;
  showThinking: boolean;
  suppressToolCards?: boolean;
  suppressProcessAttachments?: boolean;
  isStreaming?: boolean;
  streamingTools?: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
}

interface ExtractedImage { url?: string; data?: string; mimeType: string; }

/** Resolve an ExtractedImage to a displayable src string, or null if not possible. */
function imageSrc(img: ExtractedImage): string | null {
  if (img.url) return img.url;
  if (img.data) return `data:${img.mimeType};base64,${img.data}`;
  return null;
}


export const ChatMessage = memo(function ChatMessage({
  message,
  showThinking,
  suppressToolCards = false,
  suppressProcessAttachments = false,
  isStreaming = false,
  streamingTools = [],
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const isToolResult = role === 'toolresult' || role === 'tool_result';
  
  // 使用 useMemo 缓存派生数据，避免重复计算
  const extractedData = useMemo(() => {
    const text = extractText(message);
    const thinking = extractThinking(message);
    const images = extractImages(message);
    const tools = extractToolUse(message);
    
    return {
      text,
      hasText: text.trim().length > 0,
      thinking,
      images,
      tools,
    };
  }, [message.id, message.content, message._attachedFiles]);
  
  const { text, hasText, thinking, images, tools } = extractedData;
  const visibleThinking = showThinking ? thinking : null;
  const visibleTools = suppressToolCards ? [] : tools;
  const shouldHideProcessAttachments = suppressProcessAttachments
    && (hasText || !!visibleThinking || images.length > 0 || visibleTools.length > 0);

  const attachedFiles = shouldHideProcessAttachments
    ? (message._attachedFiles || []).filter((file) => file.source !== 'tool-result')
    : (message._attachedFiles || []);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; fileName: string; filePath?: string; base64?: string; mimeType?: string } | null>(null);

  // Never render tool result messages in chat UI
  if (isToolResult) return null;

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;

  // 计算 AI 任务进度
  const completedToolsCount = streamingTools.filter(t => t.status === 'completed').length;
  const totalToolsCount = streamingTools.length;
  const taskProgress = totalToolsCount > 0 ? completedToolsCount : 0;
  const taskTotal = totalToolsCount > 0 ? totalToolsCount : 1;

  // 检查是否有实际需要渲染的内容
  const hasImages = images.length > 0;
  const hasTools = visibleTools.length > 0;
  const hasAttachedFiles = attachedFiles.filter(f => f.fileName || f.preview).length > 0;

  if (!hasText && !visibleThinking && !hasImages && !hasTools && !hasAttachedFiles && !hasStreamingToolStatus) return null;

  return (
    <div
      className={cn(
        'flex gap-2 group py-1',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0 space-y-1">
        {/* AI 任务进度条 */}
        {hasStreamingToolStatus && totalToolsCount > 1 && (
          <div className="mb-2">
            <TaskProgress step={taskProgress} total={taskTotal} />
            <p className="text-xs text-muted-foreground mt-1">
              正在执行: {streamingTools.find(t => t.status === 'running')?.name || 'AI 任务'} ({completedToolsCount}/{totalToolsCount})
            </p>
          </div>
        )}

        {/* Tool use cards - 保留完成的工具卡片 */}
        {visibleTools.length > 0 && (
          <div className="space-y-1">
            {visibleTools.map((tool, i) => (
              <ToolCard key={tool.id || i} name={tool.name} input={tool.input} />
            ))}
          </div>
        )}

        {/* Images — rendered ABOVE text bubble for user messages */}
        {/* Images from content blocks (Gateway session data / channel push photos) */}
        {isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImageThumbnail
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — images above text for user, file cards below */}
        {isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              // Skip image attachments if we already have images from content blocks
              if (isImage && images.length > 0) return null;
              if (isImage) {
                return file.preview ? (
                  <ImageThumbnail
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                ) : (
                  <div
                    key={`local-${i}`}
                    className="w-36 h-36 rounded-xl  bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center text-muted-foreground"
                  >
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              // Non-image files → file card
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Main text bubble */}
        {hasText && (
          <div className={cn(isUser ? 'ml-auto' : '')}>
            <MessageBubble
              text={text}
              isUser={isUser}
              isStreaming={isStreaming}
            />
          </div>
        )}

        {/* Images from content blocks — assistant messages (below text) */}
        {!isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImagePreviewCard
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — assistant messages (below text) */}
        {!isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              if (isImage && images.length > 0) return null;
              if (isImage && file.preview) {
                return (
                  <ImagePreviewCard
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                );
              }
              if (isImage && !file.preview) {
                return (
                  <div key={`local-${i}`} className="w-36 h-36 rounded-xl  bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center text-muted-foreground">
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Hover row for user messages — timestamp only */}
        {isUser && message.timestamp && (
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
            {formatTimestamp(message.timestamp)}
          </span>
        )}

        {/* Hover row for assistant messages — only when there is real text content */}
        {!isUser && hasText && (
          <AssistantHoverBar text={text} timestamp={message.timestamp} />
        )}
      </div>

      {/* Image lightbox portal */}
      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          fileName={lightboxImg.fileName}
          filePath={lightboxImg.filePath}
          base64={lightboxImg.base64}
          mimeType={lightboxImg.mimeType}
          onClose={() => setLightboxImg(null)}
        />
      )}
    </div>
  );
});

// ── Assistant hover bar (timestamp + copy, shown on group hover) ─

const AssistantHoverBar = memo(function AssistantHoverBar({ text, timestamp }: { text: string; timestamp?: number }) {
  const [copied, setCopied] = useState(false);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="flex items-center justify-between w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none px-1">
      <span className="text-xs text-muted-foreground">
        {timestamp ? formatTimestamp(timestamp) : ''}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={copyContent}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
});

// ── Message Bubble ──────────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  text,
  isUser,
  isStreaming,
}: {
  text: string;
  isUser: boolean;
  isStreaming: boolean;
}) {
  // Agent 消息不使用气泡样式，直接渲染内容
  if (!isUser) {
    return (
      <div className="py-1 pr-4">
        <TaskCollapsibleContent text={text} defaultExpandCount={1} isStreaming={isStreaming} />
      </div>
    );
  }

  // 用户消息保持气泡样式
  return (
    <div
      className={cn(
        'relative px-3 py-1.5 rounded-lg inline-block gpu-accelerated',
        'bg-[#0a84ff]/15 text-[var(--text-primary)] rounded-tr-sm'
      )}
      style={{ 
        maxWidth: 'fit-content',
        textAlign: 'right'
      }}
    >
      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{text}</p>
    </div>
  );
});

// ── File Card (for user-uploaded non-image files) ───────────────

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

const FileCard = memo(function FileCard({ file }: { file: AttachedFileMeta }) {
  const handleOpen = useCallback(() => {
    if (file.filePath) {
      invokeIpc('shell:openPath', file.filePath);
    }
  }, [file.filePath]);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 rounded-xl  px-3 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] max-w-[220px]",
        file.filePath && "cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
      )}
      onClick={handleOpen}
      title={file.filePath ? "Open file" : undefined}
    >
      <FileIcon mimeType={file.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 overflow-hidden">
        <p className="text-xs font-medium truncate">{file.fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {file.fileSize > 0 ? formatFileSize(file.fileSize) : 'File'}
        </p>
      </div>
    </div>
  );
});

// ── Image Thumbnail (user bubble — square crop with zoom hint) ──

const ImageThumbnail = memo(function ImageThumbnail({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative w-36 h-36 rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] group/img cursor-zoom-in gpu-accelerated"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
});

// ── Image Preview Card (assistant bubble — natural size with overlay actions) ──

const ImagePreviewCard = memo(function ImagePreviewCard({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative max-w-xs rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] group/img cursor-zoom-in gpu-accelerated"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="block w-full" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
});

// ── Image Lightbox ───────────────────────────────────────────────

function ImageLightbox({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onClose,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onClose: () => void;
}) {
  void src; void base64; void mimeType; void fileName;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShowInFolder = useCallback(() => {
    if (filePath) {
      invokeIpc('shell:showItemInFolder', filePath);
    }
  }, [filePath]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Image + buttons stacked */}
      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={fileName}
          className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
        />

        {/* Action buttons below image */}
        <div className="flex items-center gap-2">
          {filePath && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
              onClick={handleShowInFolder}
              title="在文件夹中显示"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Tool Card ───────────────────────────────────────────────────

// 工具图标映射
const toolIcons: Record<string, React.ElementType> = {
  thinking: Brain,
  think: Brain,
  exec: Terminal,
  execute: Terminal,
  write: FileEdit,
  writetofile: FileEdit,
  read: FileSearch,
  readfile: FileSearch,
  search: Search,
  web_search: Globe,
  browser: Globe,
  bash: Terminal,
  python: Code2,
  javascript: Code2,
  typescript: Code2,
};

// 工具颜色映射
const toolColors: Record<string, string> = {
  thinking: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  think: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  exec: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  execute: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  write: 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  writetofile: 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  read: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  readfile: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  search: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  web_search: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  browser: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  bash: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
  python: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  javascript: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  typescript: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
};

// 获取工具显示名称
function getToolDisplayName(name: string): string {
  const nameMap: Record<string, string> = {
    thinking: '思考',
    think: '思考',
    exec: '执行命令',
    execute: '执行命令',
    write: '写入文件',
    writetofile: '写入文件',
    read: '读取文件',
    readfile: '读取文件',
    search: '搜索',
    web_search: '网页搜索',
    browser: '浏览器',
    bash: 'Bash',
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  };
  return nameMap[name.toLowerCase()] || name;
}

// 格式化工具输入
function formatToolInput(name: string, input: unknown): string {
  if (!input) return '';
  
  const inputObj = typeof input === 'string' ? JSON.parse(input) : input;
  
  // 针对不同工具的格式化
  if (name.toLowerCase().includes('write')) {
    const filePath = inputObj.file_path || inputObj.path || '';
    return filePath ? `→ ${filePath}` : '';
  }
  
  if (name.toLowerCase().includes('read')) {
    const filePath = inputObj.file_path || inputObj.path || '';
    return filePath ? `← ${filePath}` : '';
  }
  
  if (name.toLowerCase().includes('exec') || name.toLowerCase() === 'bash') {
    const command = inputObj.command || inputObj.cmd || '';
    return command ? `$ ${command.slice(0, 50)}${command.length > 50 ? '...' : ''}` : '';
  }
  
  if (name.toLowerCase().includes('search')) {
    const query = inputObj.query || inputObj.q || '';
    return query ? `🔍 ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}` : '';
  }
  
  if (name.toLowerCase().includes('thinking') || name.toLowerCase() === 'think') {
    const thought = inputObj.thought || inputObj.thinking || inputObj.content || '';
    return thought ? `💭 ${thought.slice(0, 60)}${thought.length > 60 ? '...' : ''}` : '';
  }
  
  return JSON.stringify(inputObj, null, 2);
}

const ToolCard = memo(function ToolCard({ name, input }: { name: string; input: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const lowerName = name.toLowerCase();
  const Icon = toolIcons[lowerName] || Wrench;
  const colorClass = toolColors[lowerName] || 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
  const displayName = getToolDisplayName(name);
  const summary = formatToolInput(name, input);

  return (
    <div className={cn(
      "rounded-xl border text-[13px] overflow-hidden transition-all duration-200",
      colorClass
    )}>
      <button
        className="flex items-center gap-2 w-full px-3 py-2 hover:opacity-80 transition-opacity"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-medium">{displayName}</span>
        {summary && !expanded && (
          <span className="text-xs opacity-60 truncate flex-1 ml-2 text-left">
            {summary}
          </span>
        )}
        {expanded ? <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0" />}
      </button>
      {expanded && input != null && (
        <div className="px-3 pb-3 border-t border-current/10">
          <pre className="pt-2 text-xs overflow-x-auto whitespace-pre-wrap break-all opacity-80">
            {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
});
