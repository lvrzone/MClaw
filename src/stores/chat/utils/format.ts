/**
 * 消息格式化工具
 * 处理消息内容的格式化和转换
 */

import type { ContentBlock, RawMessage } from '../types';

/**
 * 规范化消息内容
 * 将各种格式的内容统一转换为 ContentBlock[]
 */
export function normalizeMessageContent(
  content: unknown
): ContentBlock[] {
  if (!content) return [];

  // 已经是数组格式
  if (Array.isArray(content)) {
    return content.map(normalizeContentBlock).filter(Boolean) as ContentBlock[];
  }

  // 字符串格式
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  // 对象格式
  if (typeof content === 'object') {
    const block = normalizeContentBlock(content);
    return block ? [block] : [];
  }

  return [];
}

/**
 * 规范化单个内容块
 */
function normalizeContentBlock(block: unknown): ContentBlock | null {
  if (!block || typeof block !== 'object') return null;

  const b = block as Record<string, unknown>;

  // 确保有类型字段
  const type = (b.type as string) || 'text';

  const normalized: ContentBlock = { type: type as ContentBlock['type'] };

  // 复制已知字段
  if (b.text) normalized.text = String(b.text);
  if (b.thinking) normalized.thinking = String(b.thinking);
  if (b.id) normalized.id = String(b.id);
  if (b.name) normalized.name = String(b.name);
  if (b.input) normalized.input = b.input;
  if (b.arguments) normalized.arguments = b.arguments;
  if (b.content) normalized.content = b.content;
  if (b.data) normalized.data = String(b.data);
  if (b.mimeType) normalized.mimeType = String(b.mimeType);

  // 处理 source 字段
  if (b.source && typeof b.source === 'object') {
    const s = b.source as Record<string, unknown>;
    normalized.source = {
      type: String(s.type || 'base64'),
      media_type: s.media_type ? String(s.media_type) : undefined,
      data: s.data ? String(s.data) : undefined,
      url: s.url ? String(s.url) : undefined,
    };
  }

  return normalized;
}

/**
 * 提取消息中的纯文本内容
 */
export function extractTextContent(message: RawMessage): string {
  if (!message.content) return '';

  const blocks = normalizeMessageContent(message.content);
  return blocks
    .filter((b): b is ContentBlock & { text: string } => b.type === 'text' && !!b.text)
    .map(b => b.text)
    .join('\n');
}

/**
 * 提取消息中的思考内容
 */
export function extractThinkingContent(message: RawMessage): string {
  if (!message.content) return '';

  const blocks = normalizeMessageContent(message.content);
  return blocks
    .filter((b): b is ContentBlock & { thinking: string } => b.type === 'thinking' && !!b.thinking)
    .map(b => b.thinking)
    .join('\n');
}

/**
 * 检查消息是否包含工具调用
 */
export function hasToolCalls(message: RawMessage): boolean {
  if (!message.content) return false;

  const blocks = normalizeMessageContent(message.content);
  return blocks.some(
    b => b.type === 'tool_use' || b.type === 'toolCall'
  );
}

/**
 * 获取消息摘要（用于会话列表显示）
 */
export function getMessagePreview(
  message: RawMessage,
  maxLength: number = 50
): string {
  const text = extractTextContent(message);
  if (!text) return '[无内容]';

  // 移除多余空白
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * 格式化会话标题
 */
export function formatSessionTitle(
  firstMessage: string | undefined,
  maxLength: number = 30
): string {
  if (!firstMessage) return '新会话';

  // 移除换行和多余空格
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * 解析Markdown代码块
 */
export function parseCodeBlocks(text: string): Array<{
  language?: string;
  code: string;
  isCode: boolean;
  text: string;
}> {
  const result: Array<{
    language?: string;
    code: string;
    isCode: boolean;
    text: string;
  }> = [];

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 添加代码块前的文本
    if (match.index > lastIndex) {
      result.push({
        isCode: false,
        text: text.slice(lastIndex, match.index),
        code: '',
      });
    }

    // 添加代码块
    result.push({
      isCode: true,
      language: match[1],
      code: match[2].trim(),
      text: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    result.push({
      isCode: false,
      text: text.slice(lastIndex),
      code: '',
    });
  }

  return result;
}

/**
 * 转义HTML特殊字符
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

/**
 * 将URL转换为可点击链接
 */
export function linkifyUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

/**
 * 计算文本的近似token数（简单估算）
 */
export function estimateTokenCount(text: string): number {
  // 粗略估算：英文约4字符/token，中文约1.5字符/token
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - englishChars - chineseChars;

  return Math.ceil(englishChars / 4 + chineseChars / 1.5 + otherChars / 4);
}

/**
 * 截断文本到指定token数
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimated = estimateTokenCount(text);
  if (estimated <= maxTokens) return text;

  // 按比例截断
  const ratio = maxTokens / estimated;
  const targetLength = Math.floor(text.length * ratio);
  return text.slice(0, targetLength) + '...';
}
