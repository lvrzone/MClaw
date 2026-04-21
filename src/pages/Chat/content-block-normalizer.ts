/**
 * Content Block Normalizer
 * 将消息 content[] 统一归一化为 NormalizedBlock[] 用于渲染分发
 * 架构对齐 WorkBuddy yYe 枚举：TEXT / REASONING / TOOL_CALL
 */
import type { RawMessage, ContentBlock, NormalizedBlock } from '@/stores/chat/types';
import { ContentBlockType } from '@/stores/chat/types';

/**
 * 从 RawMessage 提取并归一化内容块数组
 * 按顺序遍历 content[]，将各种格式统一映射到三种类型
 */
export function normalizeContentBlocks(
  message: RawMessage,
  isSessionActive?: boolean,
): NormalizedBlock[] {
  const { content } = message;
  const blocks: NormalizedBlock[] = [];

  // 格式1: string content → 单个 TEXT 块
  if (typeof content === 'string') {
    if (content.trim()) {
      blocks.push({
        type: ContentBlockType.TEXT,
        text: content,
        complete: true,
        isLast: true,
      });
    }
    return blocks;
  }

  // 格式2: ContentBlock[] → 逐块归一化
  if (!Array.isArray(content)) return blocks;

  const contentArr = content as ContentBlock[];
  const lastIndex = contentArr.length - 1;

  for (let i = 0; i < contentArr.length; i++) {
    const block = contentArr[i];
    const isLast = i === lastIndex;

    // ── TEXT 块 ──
    if (block.type === 'text' && block.text?.trim()) {
      blocks.push({
        type: ContentBlockType.TEXT,
        text: block.text,
        complete: true,
        isLast,
        raw: block,
      });
      continue;
    }

    // ── REASONING / THINKING 块 ──
    if (block.type === 'thinking' || block.type === 'reasoning') {
      const blockAny = block as unknown as Record<string, unknown>;
      const rawText = block.thinking || block.reasoning || blockAny.text || '';
      const text = typeof rawText === 'string' ? rawText : String(rawText);
      if (!text.trim()) continue;

      // 位置感知自动折叠：非最后块时 complete=true（自动折叠）
      // 最后一块且会话活跃时 complete=false（还在思考）
      const complete = isLast ? !isSessionActive : true;

      blocks.push({
        type: ContentBlockType.REASONING,
        text,
        complete,
        isLast,
        raw: block,
      });
      continue;
    }

    // ── TOOL_CALL 块 ──
    if (
      block.type === 'tool_use' ||
      block.type === 'toolCall' ||
      block.type === 'tool-call'
    ) {
      const blockAny = block as unknown as Record<string, unknown>;
      
      // 提取工具信息 — 优先使用 block 上的直接字段，兼容多种格式
      const toolId = String(blockAny.id || block.id || '');
      const toolName = String(blockAny.name || block.name || '');
      const toolInput = blockAny.input ?? blockAny.arguments ?? blockAny.params ?? block.input ?? block.arguments;
      
      // 检查是否有嵌套 tool 对象（部分格式）
      const toolObj = blockAny.tool as NormalizedBlock['tool'] | undefined;
      
      // 构建 tool 数据
      const tool: NormalizedBlock['tool'] = toolObj
        ? {
            id: toolObj.id || toolId,
            name: toolObj.name || toolName,
            status: toolObj.status as NormalizedBlock['tool'] extends { status: infer S } ? S : never || 'completed',
            args: toolObj.args ?? toolInput,
            result: toolObj.result,
            error: toolObj.error,
            durationMs: toolObj.durationMs,
          }
        : {
            id: toolId,
            name: toolName || 'unknown',
            status: 'completed' as const,
            args: toolInput,
          };

      blocks.push({
        type: ContentBlockType.TOOL_CALL,
        tool,
        isLast,
        raw: block,
      });
      continue;
    }

    // ── TOOL_RESULT 块 → 合并到上一个 TOOL_CALL ──
    if (block.type === 'tool_result' || block.type === 'toolResult') {
      const blockAny = block as unknown as Record<string, unknown>;
      const lastToolBlock = blocks.length > 0
        ? blocks[blocks.length - 1]
        : null;

      if (lastToolBlock?.type === ContentBlockType.TOOL_CALL && lastToolBlock.tool) {
        // 合并结果到上一个工具调用块
        lastToolBlock.tool = {
          ...lastToolBlock.tool,
          status: 'executed',
          result: block.content ?? blockAny.result,
          error: blockAny.error as string | undefined,
        };
      }
      continue;
    }

    // ── IMAGE 块 → 跳过（由 extractImages 处理） ──
    if (block.type === 'image') continue;
  }

  // 标记最后一个块
  if (blocks.length > 0) {
    blocks[blocks.length - 1].isLast = true;
  }

  return blocks;
}

/**
 * 从归一化块中提取所有文本内容
 */
export function extractTextFromBlocks(blocks: NormalizedBlock[]): string {
  return blocks
    .filter(b => b.type === ContentBlockType.TEXT && b.text?.trim())
    .map(b => b.text!)
    .join('\n\n');
}

/**
 * 从归一化块中提取所有思考内容
 */
export function extractThinkingFromBlocks(blocks: NormalizedBlock[]): string | null {
  const parts = blocks
    .filter(b => b.type === ContentBlockType.REASONING && b.text?.trim())
    .map(b => b.text!);

  return parts.length > 0 ? parts.join('\n\n') : null;
}

/**
 * 从归一化块中提取所有工具调用
 */
export function extractToolCallsFromBlocks(blocks: NormalizedBlock[]): NormalizedBlock[] {
  return blocks.filter(b => b.type === ContentBlockType.TOOL_CALL);
}

/**
 * 检测是否包含 Plan 工具调用（plan_create / plan_update）
 */
export function hasPlanToolCall(blocks: NormalizedBlock[]): boolean {
  return blocks.some(
    b => b.type === ContentBlockType.TOOL_CALL &&
      b.tool &&
      (b.tool.name === 'plan_create' || b.tool.name === 'plan_update'),
  );
}
