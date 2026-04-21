/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with unified content block dispatch:
 *   TEXT → Markdown text
 * 性能优化：使用 useMemo 缓存派生数据
 */
import { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { Copy, Check, Wrench, FileText, Film, Music, FileArchive, File, X, FolderOpen, ZoomIn, ChevronDown, ChevronRight, Brain, Terminal, FileEdit, FileSearch, Search, Globe, Code2 } from 'lucide-react';

import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import type { RawMessage, AttachedFileMeta, ContentBlock } from '@/stores/chat';
import type { NormalizedBlock } from '@/stores/chat/types';
import { ContentBlockType } from '@/stores/chat/types';
import { extractText, extractThinking, extractImages, extractToolUse, formatTimestamp } from './message-utils';
import { useCarousel, type CarouselImage } from '@/components/ImageCarousel';
import { normalizeContentBlocks } from './content-block-normalizer';
import { TaskCollapsibleContent } from '@/components/TaskCollapsibleContent';
import { TaskProgress } from '@/components/TaskProgress';

interface ChatMessageProps {
  message: RawMessage;
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
    input?: unknown;
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
  suppressToolCards = false,
  suppressProcessAttachments = false,
  isStreaming = false,
  streamingTools = [],
}: ChatMessageProps) {
  // Lightbox state for full-screen image preview
  const [lightboxImg, setLightboxImg] = useState<{
    src: string;
    fileName?: string;
    filePath?: string;
    base64?: string;
    mimeType: string;
  } | null>(null);

  const isUser = message.role === 'user';
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const isToolResult = role === 'toolresult' || role === 'tool_result';
  
  // ── 归一化内容块 ──
  const normalizedBlocks = useMemo(
    () => normalizeContentBlocks(message, isStreaming),
    [message.id, message.content, isStreaming],
  );

  // ── 合并所有来源的工具调用和思考内容到归一化块 ──
  const mergedBlocks = useMemo(() => {
    let result = normalizedBlocks;

    // 补充：如果归一化块中没有 TOOL_CALL，但消息 content 数组中有 tool_use 块，
    // 直接从 content 提取（不过滤 HIDDEN_TOOLS，所有工具都应该显示）
    const hasToolCallBlocks = normalizedBlocks.some(b => b.type === ContentBlockType.TOOL_CALL);
    if (!hasToolCallBlocks && !isUser) {
      const content = message.content;
      if (Array.isArray(content)) {
        const toolBlocks: NormalizedBlock[] = [];
        for (const block of content as ContentBlock[]) {
          if (block.type === 'tool_use' || block.type === 'toolCall' || block.type === 'tool-call') {
            const blockAny = block as unknown as Record<string, unknown>;
            toolBlocks.push({
              type: ContentBlockType.TOOL_CALL,
              tool: {
                id: String(blockAny.id || block.id || ''),
                name: String(blockAny.name || block.name || 'unknown'),
                status: 'executed' as const,
                args: blockAny.input ?? blockAny.arguments ?? blockAny.params,
              },
              isLast: false,
            });
          }
          // 处理 tool_result：合并到上一个 tool_use
          if ((block.type === 'tool_result' || block.type === 'toolResult') && toolBlocks.length > 0) {
            const lastTool = toolBlocks[toolBlocks.length - 1];
            if (lastTool.type === ContentBlockType.TOOL_CALL && lastTool.tool) {
              const blockAny = block as unknown as Record<string, unknown>;
              lastTool.tool = {
                ...lastTool.tool,
                result: block.content ?? blockAny.result,
                error: blockAny.error as string | undefined,
              };
            }
          }
        }
        if (toolBlocks.length > 0) {
          result = [...result, ...toolBlocks];
        }
      }
      // 也检查 OpenAI 格式的 tool_calls
      if (result === normalizedBlocks) {
        const msgAny = message as unknown as Record<string, unknown>;
        const toolCalls = msgAny.tool_calls ?? msgAny.toolCalls;
        if (Array.isArray(toolCalls)) {
          const oaiToolBlocks: NormalizedBlock[] = [];
          for (const tc of toolCalls as Array<Record<string, unknown>>) {
            const fn = (tc.function ?? tc) as Record<string, unknown>;
            const name = typeof fn.name === 'string' ? fn.name : '';
            if (!name) continue;
            let input: unknown;
            try {
              input = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments ?? fn.input;
            } catch {
              input = fn.arguments;
            }
            oaiToolBlocks.push({
              type: ContentBlockType.TOOL_CALL,
              tool: {
                id: String(tc.id || ''),
                name,
                status: 'executed' as const,
                args: input,
              },
              isLast: false,
            });
          }
          if (oaiToolBlocks.length > 0) {
            result = [...result, ...oaiToolBlocks];
          }
        }
      }
    }

    // 如果不是流式状态或没有流式工具，直接返回补充后的结果
    if (!isStreaming || streamingTools.length === 0) return result;

    // 收集已有工具 ID（只统计非空 ID）
    const existingToolIds = new Set(
      result
        .filter(b => b.type === ContentBlockType.TOOL_CALL && b.tool?.id)
        .map(b => b.tool!.id)
        .filter(id => id !== ''),
    );
    
    // 找出 streamingTools 中尚未在 content blocks 中出现的
    const newStreamingBlocks: NormalizedBlock[] = streamingTools
      .filter(st => {
        const id = st.id || st.toolCallId || '';
        // 只跳过有 ID 且已存在的工具；无 ID 的一律保留
        if (!id) return true;
        return !existingToolIds.has(id);
      })
      .map((st, idx) => ({
        type: ContentBlockType.TOOL_CALL,
        tool: {
          id: st.id || st.toolCallId || `stream-tool-${idx}`,
          name: st.name,
          status: st.status === 'error' ? 'failed' as const : st.status === 'completed' ? 'executed' as const : 'running' as const,
          args: st.input as unknown,
          durationMs: st.durationMs,
        },
        isLast: false,
      }));
    
    return [...result, ...newStreamingBlocks];
  }, [normalizedBlocks, streamingTools, isStreaming, message, isUser]);

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
  const processFallbackText = mergedBlocks
    .filter((b) => b.type !== ContentBlockType.TEXT)
    .map((block) => {
      if (block.type === ContentBlockType.REASONING) return block.text || '';
      if (block.type === ContentBlockType.TOOL_CALL && block.tool) {
        const args = typeof block.tool.args === 'string'
          ? block.tool.args
          : JSON.stringify(block.tool.args || {});
        return `${block.tool.name}${args ? `: ${args}` : ''}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  const displayText = hasText ? text : processFallbackText;
  const visibleTools = suppressToolCards ? [] : tools;
  const shouldHideProcessAttachments = suppressProcessAttachments
    && (hasText || !!thinking || images.length > 0 || visibleTools.length > 0);

  const attachedFiles = shouldHideProcessAttachments
    ? (message._attachedFiles || []).filter((file) => file.source !== 'tool-result')
    : (message._attachedFiles || []);
  const { open: openCarousel } = useCarousel();

  // Collect all images from the message for carousel
  const allMessageImages = useMemo<CarouselImage[]>(() => {
    const result: CarouselImage[] = [];
    
    // Add images from content blocks
    for (const img of images) {
      const src = imageSrc(img);
      if (src) {
        result.push({
          url: src,
          data: img.data,
          mimeType: img.mimeType,
          alt: 'Image',
        });
      }
    }
    
    // Add image attachments
    for (const file of attachedFiles) {
      if (file.mimeType.startsWith('image/') && file.preview) {
        result.push({
          url: file.preview,
          fileName: file.fileName,
          mimeType: file.mimeType,
        });
      }
    }
    
    return result;
  }, [images, attachedFiles]);

  const handleImageClick = useCallback((imageIndex: number) => {
    if (allMessageImages.length > 0) {
      openCarousel(allMessageImages, imageIndex);
    }
  }, [allMessageImages, openCarousel]);

  // Never render tool result messages in chat UI
  if (isToolResult) return null;

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;

  // 计算 AI 任务进度
  const completedToolsCount = streamingTools.filter(t => t.status === 'completed').length;
  const totalToolsCount = streamingTools.length;
  const taskProgress = totalToolsCount > 0 ? completedToolsCount : 0;
  const taskTotal = totalToolsCount > 0 ? totalToolsCount : 1;

  // 检查是否有实际需要渲染的内容（含归一化块）
  const hasImages = images.length > 0;
  const hasTools = visibleTools.length > 0;
  const hasAttachedFiles = attachedFiles.filter(f => f.fileName || f.preview).length > 0;
  const hasNormalizedContent = mergedBlocks.length > 0;
  const hasDisplayText = displayText.trim().length > 0;

  if (!hasDisplayText && !hasImages && !hasTools && !hasAttachedFiles && !hasStreamingToolStatus && !hasNormalizedContent) return null;

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

        {/* Tool use cards - 旧路径（仅在归一化路径没有 TOOL_CALL 时显示） */}
        {visibleTools.length > 0 && !mergedBlocks.some(b => b.type === ContentBlockType.TOOL_CALL) && (
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
                  onPreview={() => handleImageClick(i)}
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
                    onPreview={() => handleImageClick(images.length + i)}
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

        {/* 仅渲染助手纯文本回复，去除思考/工具调用卡片 */}
        {!isUser && hasDisplayText && (
          <div className={cn(
            "transition-all duration-200",
            isStreaming && "pt-1",
          )}>
            <MessageBubble text={displayText} isUser={false} isStreaming={isStreaming} />
          </div>
        )}

        {/* Fallback: 旧路径兜底（归一化块为空时使用） */}
        {!isUser && !hasDisplayText && mergedBlocks.length === 0 && hasText && (
          <div className={cn(isUser ? 'ml-auto' : '')}>
            <MessageBubble
              text={text}
              isUser={isUser}
              isStreaming={isStreaming}
            />
          </div>
        )}

        {/* User message bubble */}
        {isUser && hasText && (
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
          fileName={lightboxImg.fileName ?? ''}
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
    <div className="hover-toolbar flex items-center justify-between w-full select-none px-1">
      <span className="text-xs text-muted-foreground">
        {timestamp ? formatTimestamp(timestamp) : ''}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={copyContent}
          title="复制"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
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
