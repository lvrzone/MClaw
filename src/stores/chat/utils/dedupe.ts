/**
 * 聊天事件去重工具
 * 防止重复处理相同的聊天事件
 */

import { TIME } from '@/constants';

// 事件去重缓存
const eventDedupeCache = new Map<string, number>();

/**
 * 清理过期的事件缓存
 */
export function pruneEventDedupeCache(now: number = Date.now()): void {
  for (const [key, timestamp] of eventDedupeCache.entries()) {
    if (now - timestamp > TIME.CHAT_EVENT_DEDUPE_TTL_MS) {
      eventDedupeCache.delete(key);
    }
  }
}

/**
 * 构建事件去重键
 */
export function buildEventDedupeKey(
  eventState: string,
  event: Record<string, unknown>
): string | null {
  const runId = event.runId != null ? String(event.runId) : '';
  const sessionKey = event.sessionKey != null ? String(event.sessionKey) : '';
  const seq = event.seq != null ? String(event.seq) : '';

  if (runId || sessionKey || seq || eventState) {
    return [runId, sessionKey, seq, eventState].join('|');
  }

  const msg =
    event.message && typeof event.message === 'object'
      ? (event.message as Record<string, unknown>)
      : null;

  if (msg) {
    const messageId = msg.id != null ? String(msg.id) : '';
    const stopReason = msg.stopReason ?? msg.stop_reason;
    if (messageId || stopReason) {
      return `msg|${messageId}|${String(stopReason ?? '')}|${eventState}`;
    }
  }

  return null;
}

/**
 * 检查事件是否重复
 */
export function isDuplicateEvent(
  eventState: string,
  event: Record<string, unknown>
): boolean {
  const key = buildEventDedupeKey(eventState, event);
  if (!key) return false;

  const now = Date.now();
  pruneEventDedupeCache(now);

  if (eventDedupeCache.has(key)) {
    return true;
  }

  eventDedupeCache.set(key, now);
  return false;
}

/**
 * 清除所有去重缓存
 */
export function clearDedupeCache(): void {
  eventDedupeCache.clear();
}

/**
 * 获取缓存大小（用于调试）
 */
export function getDedupeCacheSize(): number {
  return eventDedupeCache.size;
}
