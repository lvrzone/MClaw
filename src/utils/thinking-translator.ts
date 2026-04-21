/**
 * thinking-translator.ts — 思考内容实时翻译工具
 * 当思考内容为英文时，自动翻译为中文
 * 
 * 使用场景：Claude extended thinking / GPT o1 等模型内部推理
 * 输出英文时，前端自动翻译为中文展示
 * 
 * 实现方式：
 * 1. 快速检测：英文占比 > 70% → 需要翻译
 * 2. 翻译策略：分段翻译，保留代码块/公式不翻译
 * 3. 缓存：已翻译内容缓存，避免重复翻译
 */

// 英文检测
function isEnglish(text: string): boolean {
  const stripped = text.replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]*`/g, '') // 移除行内代码
    .replace(/\$[^$]+\$/g, '') // 移除 LaTeX
    .replace(/https?:\/\/\S+/g, ''); // 移除 URL
  
  const latin = (stripped.match(/[a-zA-Z]/g) || []).length;
  const cjk = (stripped.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const totalAlpha = latin + cjk;
  if (totalAlpha < 10) return false; // 太短不判断
  return latin / totalAlpha > 0.7;
}

// 翻译缓存
const translationCache = new Map<string, string>();

/**
 * 翻译思考内容（如果需要）
 * 当前实现：简单规则翻译，后续可接入翻译 API
 */
export function translateThinking(text: string): string {
  if (!text || !isEnglish(text)) return text;
  
  // 缓存命中
  const cached = translationCache.get(text);
  if (cached) return cached;
  
  // ★ 当前方案：标记为英文，UI 显示"英文思考"提示
  // ★ 进阶方案：接入翻译 API（如 DeepL / 腾讯翻译君）
  // 暂不自动翻译，只在 UI 层加提示
  return text;
}

/**
 * 检测思考内容是否为英文
 */
export function isThinkingEnglish(text: string): boolean {
  return isEnglish(text);
}

/**
 * 简单的英→中关键词替换（可扩展）
 * 仅用于 UI 层面的快速提示
 */
const quickTranslations: Record<string, string> = {
  'I need to': '我需要',
  'Let me': '让我',
  'The user': '用户',
  'Looking at': '查看',
  'I should': '我应该',
  'First,': '首先，',
  'Then,': '然后，',
  'Next,': '接下来，',
  'Finally,': '最后，',
  'However,': '但是，',
  'Therefore,': '因此，',
  'Based on': '基于',
  'According to': '根据',
  'It seems': '看起来',
  'I think': '我认为',
  'I notice': '我注意到',
};

/**
 * 快速部分翻译（只翻译开头的常见短语）
 */
export function quickPartialTranslate(text: string): string {
  if (!isEnglish(text)) return text;
  
  let result = text;
  for (const [en, zh] of Object.entries(quickTranslations)) {
    if (result.startsWith(en)) {
      result = zh + result.slice(en.length);
      break; // 只翻译开头第一个匹配
    }
  }
  return result;
}
