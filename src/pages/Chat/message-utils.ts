/**
 * Message content extraction helpers
 * Ported from OpenClaw's message-extract.ts to handle the various
 * message content formats returned by the Gateway.
 */
import type { RawMessage, ContentBlock } from '@/stores/chat';

/**
 * Clean Gateway metadata from user message text for display.
 * Strips: [media attached: ... | ...], [message_id: ...],
 * and the timestamp prefix [Day Date Time Timezone].
 */
function cleanUserText(text: string): string {
  return text
    // Remove [media attached: path (mime) | path] references
    .replace(/\s*\[media attached:[^\]]*\]/g, '')
    // Remove [message_id: uuid]
    .replace(/\s*\[message_id:\s*[^\]]+\]/g, '')
    // Remove Gateway-injected "Conversation info (untrusted metadata): ```json...```" block
    .replace(/^Conversation info\s*\([^)]*\):\s*```[a-z]*\n[\s\S]*?```\s*/i, '')
    // Fallback: remove "Conversation info (...): {...}" without code block wrapper
    .replace(/^Conversation info\s*\([^)]*\):\s*\{[\s\S]*?\}\s*/i, '')
    // Remove Gateway timestamp prefix like [Fri 2026-02-13 22:39 GMT+8]
    .replace(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+[^\]]+\]\s*/i, '')
    .trim();
}

/**
 * Extract displayable text from a message's content field.
 * Handles both string content and array-of-blocks content.
 * For user messages, strips Gateway-injected metadata.
 */
export function extractText(message: RawMessage | unknown): string {
  if (!message || typeof message !== 'object') return '';
  const msg = message as Record<string, unknown>;
  const content = msg.content;
  const isUser = msg.role === 'user';

  let result = '';

  if (typeof content === 'string') {
    result = content.trim().length > 0 ? content : '';
  } else if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content as ContentBlock[]) {
      if (block.type === 'text' && block.text) {
        if (block.text.trim().length > 0) {
          parts.push(block.text);
        }
      }
    }
    const combined = parts.join('\n\n');
    result = combined.trim().length > 0 ? combined : '';
  } else if (typeof msg.text === 'string') {
    // Fallback: try .text field
    result = msg.text.trim().length > 0 ? msg.text : '';
  }

  // Strip Gateway metadata from user messages for clean display
  if (isUser && result) {
    result = cleanUserText(result);
  }

  return result;
}

/**
 * Extract thinking/reasoning content from a message.
 * Supports multiple formats:
 * - ContentBlock[] with type: 'thinking' and thinking field
 * - Direct reasoning_content field
 * - Reasoning blocks from various model formats
 * Returns null if no thinking content found.
 */
export function extractThinking(message: RawMessage | unknown): string | null {
  if (!message || typeof message !== 'object') return null;
  const msg = message as Record<string, unknown>;
  const content = msg.content;

  // Format 1: ContentBlock array with thinking blocks
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content as ContentBlock[]) {
      // type: 'thinking' with thinking field (Claude/Anthropic format)
      if (block.type === 'thinking') {
        const thinkingText = (block as Record<string, unknown>).thinking as string | undefined
          || (block as Record<string, unknown>).text as string | undefined;
        if (thinkingText && thinkingText.trim()) {
          parts.push(thinkingText.trim());
        }
      }
      // type: 'reasoning' with reasoning/text field (some models)
      if (block.type === 'reasoning') {
        const reasoningText = (block as Record<string, unknown>).reasoning as string | undefined
          || (block as Record<string, unknown>).text as string | undefined;
        if (reasoningText && reasoningText.trim()) {
          parts.push(reasoningText.trim());
        }
      }
    }
    const combined = parts.join('\n\n').trim();
    if (combined.length > 0) return combined;
  }

  // Format 2: Direct reasoning_content field (some models use this)
  const reasoningContent = msg.reasoning_content as string | undefined;
  if (reasoningContent && reasoningContent.trim()) {
    return reasoningContent.trim();
  }

  // Format 3: Reasoning block within content array (alternative format)
  if (Array.isArray(content)) {
    for (const block of content as ContentBlock[]) {
      // Check for reasoning field (some models use this)
      const reasoning = (block as Record<string, unknown>).reasoning as string | undefined;
      if (reasoning && typeof reasoning === 'string' && reasoning.trim()) {
        return reasoning.trim();
      }
      // Check for text block that might contain thinking
      if (block.type === 'text' && block.text) {
        // Some models embed thinking in text with special markers
        const text = block.text as string;
        // Look for thinking markers
        const thinkMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        if (thinkMatch) {
          return thinkMatch[1].trim();
        }
        // Look for analysis/reasoning sections
        const analysisMatch = text.match(/分析[:：]\s*([\s\S]*?)(?:\n\n|$)/i);
        if (analysisMatch) {
          return analysisMatch[1].trim();
        }
      }
    }
  }

  // Format 4: Check for thinking/reasoning at message level
  const thinking = msg.thinking as string | undefined;
  if (thinking && typeof thinking === 'string' && thinking.trim()) {
    return thinking.trim();
  }

  const reasoning = msg.reasoning as string | undefined;
  if (reasoning && typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning.trim();
  }

  // Format 5: Check for thinking_chunk (used in some streaming formats)
  const thinkingChunk = (msg as Record<string, unknown>).thinking_chunk as string | undefined;
  if (thinkingChunk && typeof thinkingChunk === 'string' && thinkingChunk.trim()) {
    return thinkingChunk.trim();
  }

  // Format 6: Check for thinking_text (alternative field name)
  const thinkingText = (msg as Record<string, unknown>).thinking_text as string | undefined;
  if (thinkingText && typeof thinkingText === 'string' && thinkingText.trim()) {
    return thinkingText.trim();
  }

  // Format 7: Check for reasoning_text (alternative field name)
  const reasoningText = (msg as Record<string, unknown>).reasoning_text as string | undefined;
  if (reasoningText && typeof reasoningText === 'string' && reasoningText.trim()) {
    return reasoningText.trim();
  }

  // Format 8: Check for chain_of_thought or cot field
  const cot = (msg as Record<string, unknown>).chain_of_thought as string | undefined;
  if (cot && typeof cot === 'string' && cot.trim()) {
    return cot.trim();
  }

  const cotField = (msg as Record<string, unknown>).cot as string | undefined;
  if (cotField && typeof cotField === 'string' && cotField.trim()) {
    return cotField.trim();
  }

  // Format 9: Check for meta.thinking or meta.reasoning
  const meta = msg.meta as Record<string, unknown> | undefined;
  if (meta) {
    const metaThinking = meta.thinking as string | undefined;
    if (metaThinking && typeof metaThinking === 'string' && metaThinking.trim()) {
      return metaThinking.trim();
    }
    const metaReasoning = meta.reasoning as string | undefined;
    if (metaReasoning && typeof metaReasoning === 'string' && metaReasoning.trim()) {
      return metaReasoning.trim();
    }
  }

  return null;
}

/**
 * Extract media file references from Gateway-formatted user message text.
 * Returns array of { filePath, mimeType } from [media attached: path (mime) | path] patterns.
 */
export function extractMediaRefs(message: RawMessage | unknown): Array<{ filePath: string; mimeType: string }> {
  if (!message || typeof message !== 'object') return [];
  const msg = message as Record<string, unknown>;
  if (msg.role !== 'user') return [];
  const content = msg.content;

  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = (content as ContentBlock[])
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('\n');
  }

  const refs: Array<{ filePath: string; mimeType: string }> = [];
  const regex = /\[media attached:\s*([^\s(]+)\s*\(([^)]+)\)\s*\|[^\]]*\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    refs.push({ filePath: match[1], mimeType: match[2] });
  }
  return refs;
}

/**
 * Extract image attachments from a message.
 * Returns array of { mimeType, data } for base64 images.
 */
export function extractImages(message: RawMessage | unknown): Array<{ mimeType: string; data: string }> {
  if (!message || typeof message !== 'object') return [];
  const msg = message as Record<string, unknown>;
  const content = msg.content;

  if (!Array.isArray(content)) return [];

  const images: Array<{ mimeType: string; data: string }> = [];
  for (const block of content as ContentBlock[]) {
    if (block.type === 'image') {
      // Path 1: Anthropic source-wrapped format
      if (block.source) {
        const src = block.source;
        if (src.type === 'base64' && src.media_type && src.data) {
          images.push({ mimeType: src.media_type, data: src.data });
        }
      }
      // Path 2: Flat format from Gateway tool results {data, mimeType}
      else if (block.data) {
        images.push({ mimeType: block.mimeType || 'image/jpeg', data: block.data });
      }
    }
  }

  return images;
}

/**
 * Extract tool use blocks from a message.
 * Handles both Anthropic format (tool_use in content array) and
 * OpenAI format (tool_calls array on the message object).
 */
// 需要过滤掉的内置工具名称
const HIDDEN_TOOLS = ['thinking', 'write', 'exec', 'bash', 'str_replace_editor'];

export function extractToolUse(message: RawMessage | unknown): Array<{ id: string; name: string; input: unknown }> {
  if (!message || typeof message !== 'object') return [];
  const msg = message as Record<string, unknown>;
  const tools: Array<{ id: string; name: string; input: unknown }> = [];

  // Path 1: Anthropic/normalized format — tool_use / toolCall blocks inside content array
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const block of content as ContentBlock[]) {
      if ((block.type === 'tool_use' || block.type === 'toolCall') && block.name) {
        // 过滤掉内置工具
        if (HIDDEN_TOOLS.includes(block.name.toLowerCase())) continue;
        tools.push({
          id: block.id || '',
          name: block.name,
          input: block.input ?? block.arguments,
        });
      }
    }
  }

  // Path 2: OpenAI format — tool_calls array on the message itself
  // Real-time streaming events from OpenAI-compatible models (DeepSeek, etc.)
  // use this format; the Gateway normalizes to Path 1 when storing history.
  if (tools.length === 0) {
    const toolCalls = msg.tool_calls ?? msg.toolCalls;
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls as Array<Record<string, unknown>>) {
        const fn = (tc.function ?? tc) as Record<string, unknown>;
        const name = typeof fn.name === 'string' ? fn.name : '';
        if (!name) continue;
        // 过滤掉内置工具
        if (HIDDEN_TOOLS.includes(name.toLowerCase())) continue;
        let input: unknown;
        try {
          input = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments ?? fn.input;
        } catch {
          input = fn.arguments;
        }
        tools.push({
          id: typeof tc.id === 'string' ? tc.id : '',
          name,
          input,
        });
      }
    }
  }

  return tools;
}

/**
 * Format a Unix timestamp (seconds) to relative time string.
 */
export function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return '';
  const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  if (!ts || isNaN(ts)) return '';

  // OpenClaw timestamps can be in seconds or milliseconds
  const ms = ts > 1e12 ? ts : ts * 1000;
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
