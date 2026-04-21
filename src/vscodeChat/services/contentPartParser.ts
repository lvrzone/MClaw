/**
 * ContentPartParser - 消息内容 → ContentPart[] 解析器
 * 对齐 VS Code Chat part 解析 + MClaw 标准化流程
 *
 * 流程：RawMessage.content (string | ContentBlock[])
 *     → normalizeContentBlocks() (NormalizedBlock[])
 *     → parseNormalizedBlocks() (AnyPartData[])
 *     → renderParts() (React.ReactNode)
 */
import React from 'react';
import type {
  AnyPartData,
  TextPartData,
  MarkdownPartData,
  ThinkingPartData,
  TaskPartData,
  DiffPartData,
  CollapsiblePartData,
  ProgressPartData,
  ConfirmationPartData,
  AttachmentsPartData,
  ReferencesPartData,
  ErrorPartData,
  ToolUsePartData,
  ToolResultPartData,
  ImagePartData,
} from '../components/contentParts/ContentPart';
import type { RawMessage, NormalizedBlock } from '@/stores/chat/types';
import { ContentBlockType } from '@/stores/chat/types';
import { normalizeContentBlocks } from '@/pages/Chat/content-block-normalizer';

// ============ ID 生成 ============
let counter = 0;
const genId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

// ============ 核心解析入口 ============

/**
 * 将 RawMessage 解析为 ContentPart[]
 * 主入口：外部调用此函数即可
 */
export function parseMessageToParts(
  message: RawMessage,
  options?: {
    isStreaming?: boolean;
    isSessionActive?: boolean;
  }
): AnyPartData[] {
  const { isStreaming = false, isSessionActive = false } = options ?? {};
  const blocks = normalizeContentBlocks(message, isSessionActive);
  return parseNormalizedBlocks(blocks, { isStreaming });
}

/**
 * 将 NormalizedBlock[] 解析为 AnyPartData[]
 * 内部使用
 */
export function parseNormalizedBlocks(
  blocks: NormalizedBlock[],
  options?: { isStreaming?: boolean }
): AnyPartData[] {
  const parts: AnyPartData[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case ContentBlockType.TEXT:
        if (block.text?.trim()) {
          parts.push({
            id: genId('text'),
            type: 'text',
            text: block.text,
            isStreaming: options?.isStreaming && block.isLast,
          } as TextPartData);
        }
        break;

      case ContentBlockType.REASONING:
        if (block.text?.trim()) {
          parts.push({
            id: genId('thinking'),
            type: 'thinking',
            content: block.text,
            isStreaming: options?.isStreaming && block.isLast && !block.complete,
            isCollapsed: true,
          } as ThinkingPartData);
        }
        break;

      case ContentBlockType.TOOL_CALL:
        if (block.tool) {
          const { tool } = block;

          // Tool Use Part
          parts.push({
            id: genId('tool_use'),
            type: 'tool_use',
            toolId: tool.id,
            toolName: tool.name,
            input: (tool.args as Record<string, unknown>) || {},
            status: normalizeToolStatus(tool.status),
            isStreaming: options?.isStreaming && block.isLast,
          } as ToolUsePartData);

          // Tool Result Part（如果有结果）
          if (tool.result !== undefined && tool.result !== null) {
            parts.push({
              id: genId('tool_result'),
              type: 'tool_result',
              toolId: tool.id,
              toolName: tool.name,
              content: typeof tool.result === 'string'
                ? tool.result
                : JSON.stringify(tool.result, null, 2),
              isError: !!tool.error,
              isStreaming: false,
            } as ToolResultPartData);
          }
        }
        break;
    }
  }

  return parts;
}

/**
 * 规范化工具状态
 */
function normalizeToolStatus(
  raw: string | undefined
): 'running' | 'completed' | 'error' {
  switch (raw) {
    case 'running':
    case 'stream_executing':
    case 'executing':
      return 'running';
    case 'failed':
    case 'error':
    case 'executed':
      return 'error';
    default:
      return 'completed';
  }
}

// ============ 向下兼容的旧 API ============

/**
 * @deprecated 使用 parseMessageToParts 替代
 * 解析原始消息内容为 ContentPart[]
 * 支持多种输入格式
 */
export function parseContentToParts(
  content: string | unknown[],
  options?: { isStreaming?: boolean }
): AnyPartData[] {
  const parts: AnyPartData[] = [];

  if (!content) return parts;

  // 字符串格式
  if (typeof content === 'string') {
    if (content.trim()) {
      parts.push({
        id: genId('text'),
        type: 'text',
        text: content,
        isStreaming: options?.isStreaming,
      } as TextPartData);
    }
    return parts;
  }

  // 数组格式 — ContentBlock[]
  if (Array.isArray(content)) {
    for (const block of content as Record<string, unknown>[]) {
      if (!block || typeof block !== 'object') continue;

      switch (block.type as string) {
        case 'text':
          if (block.text) {
            parts.push({
              id: genId('markdown'),
              type: 'markdown',
              content: block.text as string,
              isStreaming: options?.isStreaming,
            } as MarkdownPartData);
          }
          break;

        case 'thinking':
        case 'reasoning':
          parts.push({
            id: genId('thinking'),
            type: 'thinking',
            content: ((block.thinking || block.reasoning || block.text) as string) || '',
            isStreaming: options?.isStreaming,
            isCollapsed: true,
          } as ThinkingPartData);
          break;

        case 'task':
          parts.push({
            id: genId('task'),
            type: 'task',
            title: (block.title as string) || undefined,
            items: (block.items as TaskPartData['items']) || [],
            isStreaming: options?.isStreaming,
          } as TaskPartData);
          break;

        case 'diff':
          parts.push({
            id: genId('diff'),
            type: 'diff',
            language: block.language as string,
            original: (block.original as string) || '',
            modified: (block.modified as string) || '',
            title: (block.title as string) || undefined,
            mode: 'unified',
          } as DiffPartData);
          break;

        case 'collapsible':
          parts.push({
            id: genId('collapsible'),
            type: 'collapsible',
            header: (block.header as string) || 'Details',
            headerIcon: block.headerIcon as string,
            content: block.content as React.ReactNode,
            defaultCollapsed: (block.defaultCollapsed as boolean) ?? true,
          } as CollapsiblePartData);
          break;

        case 'progress':
          parts.push({
            id: genId('progress'),
            type: 'progress',
            title: block.title as string,
            content: block.content as string,
            percent: block.percent as number,
            isStreaming: options?.isStreaming,
          } as ProgressPartData);
          break;

        case 'confirmation':
          parts.push({
            id: genId('confirmation'),
            type: 'confirmation',
            title: (block.title as string) || 'Confirm',
            message: (block.message as string) || '',
            options: block.options as ConfirmationPartData['options'],
          } as ConfirmationPartData);
          break;

        case 'attachments':
          parts.push({
            id: genId('attachments'),
            type: 'attachments',
            attachments: (block.attachments as AttachmentsPartData['attachments']) || [],
          } as AttachmentsPartData);
          break;

        case 'references':
          parts.push({
            id: genId('references'),
            type: 'references',
            references: (block.references as ReferencesPartData['references']) || [],
          } as ReferencesPartData);
          break;

        case 'error':
          parts.push({
            id: genId('error'),
            type: 'error',
            code: block.code as string,
            message: (block.message as string) || 'Unknown error',
            details: block.details as Record<string, unknown>,
          } as ErrorPartData);
          break;

        case 'tool_use':
        case 'toolCall':
        case 'tool-call':
          parts.push({
            id: genId('tool_use'),
            type: 'tool_use',
            toolId: (block.id as string) || genId('tool'),
            toolName: (block.name as string) || 'tool',
            input: ((block.input ?? block.arguments ?? block.params) as Record<string, unknown>) || {},
            status: 'running',
            isStreaming: options?.isStreaming,
          } as ToolUsePartData);
          break;

        case 'tool_result':
        case 'toolResult':
          parts.push({
            id: genId('tool_result'),
            type: 'tool_result',
            toolId: (block.id as string) || '',
            toolName: block.name as string,
            content: typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content),
            isError: false,
          } as ToolResultPartData);
          break;

        case 'image':
          parts.push({
            id: genId('image'),
            type: 'image',
            source: (block.source as ImagePartData['source']) || {
              type: 'url',
              url: (block.url as string) || '',
            },
            alt: block.alt as string,
          } as ImagePartData);
          break;

        default:
          // 未知类型 → 尝试 JSON 字符串化
          parts.push({
            id: genId('text'),
            type: 'text',
            text: typeof block === 'string' ? block : JSON.stringify(block),
          } as TextPartData);
      }
    }
  }

  return parts;
}

/**
 * 解析 tool_calls 数组为 ToolUsePart[]
 */
export function parseToolCalls(
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
  options?: { isStreaming?: boolean }
): ToolUsePartData[] {
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: 'tool_use' as const,
    toolId: tc.id,
    toolName: tc.function.name,
    input: (() => {
      try {
        return JSON.parse(tc.function.arguments);
      } catch {
        return { raw: tc.function.arguments };
      }
    })(),
    status: 'running' as const,
    isStreaming: options?.isStreaming,
  }));
}

/**
 * 流式增量追加 — 更新最后一个 part 的内容
 */
export function appendToLastPart(
  parts: AnyPartData[],
  delta: { type: string; content: string }
): AnyPartData[] {
  if (!parts.length) return parts;

  const updated = [...parts];
  const last = { ...updated[updated.length - 1] };

  switch (delta.type) {
    case 'text':
    case 'markdown':
      if ('content' in last) (last as MarkdownPartData).content += delta.content;
      else if ('text' in last) (last as TextPartData).text += delta.content;
      break;
    case 'thinking':
      (last as ThinkingPartData).content += delta.content;
      break;
    case 'progress':
      if ('content' in last) (last as ProgressPartData).content = delta.content;
      break;
    default:
      break;
  }

  updated[updated.length - 1] = last;
  return updated;
}
