/**
 * 全局常量管理模块
 * 集中管理所有魔法数字和配置常量
 */

// ===== 时间相关常量 =====
export const TIME = {
  /** 会话加载最小间隔 (ms) */
  SESSION_LOAD_MIN_INTERVAL_MS: 1_200,
  /** 历史记录加载最小间隔 (ms) */
  HISTORY_LOAD_MIN_INTERVAL_MS: 800,
  /** 历史轮询静默窗口 (ms) */
  HISTORY_POLL_SILENCE_WINDOW_MS: 2_500,
  /** 聊天事件去重TTL (ms) */
  CHAT_EVENT_DEDUPE_TTL_MS: 30_000,
  /** 错误恢复等待时间 (ms) */
  ERROR_RECOVERY_WAIT_MS: 1_500,
  /** 消息发送超时时间 (ms) */
  MESSAGE_SEND_TIMEOUT_MS: 30_000,
  /** 流式响应超时时间 (ms) */
  STREAMING_TIMEOUT_MS: 120_000,
  /** 图片缓存过期时间 (ms) - 7天 */
  IMAGE_CACHE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  /** 图片URL缓存过期时间 (ms) - 30分钟 */
  IMAGE_URL_CACHE_EXPIRY_MS: 30 * 60 * 1000,
  /** 会话列表刷新间隔 (ms) - 5分钟 */
  SESSION_LIST_REFRESH_INTERVAL_MS: 5 * 60 * 1000,
  /** 自动保存防抖时间 (ms) */
  AUTO_SAVE_DEBOUNCE_MS: 500,
  /** 重连基础延迟 (ms) */
  RECONNECT_BASE_DELAY_MS: 1_000,
  /** 重连最大延迟 (ms) */
  RECONNECT_MAX_DELAY_MS: 30_000,
} as const;

// ===== 会话相关常量 =====
export const SESSION = {
  /** 默认会话键 */
  DEFAULT_SESSION_KEY: 'default',
  /** 默认规范前缀 */
  DEFAULT_CANONICAL_PREFIX: 'default',
  /** 会话ID分隔符 */
  SESSION_ID_SEPARATOR: '/',
  /** 最大会话标题长度 */
  MAX_SESSION_TITLE_LENGTH: 100,
  /** 最大消息数量 */
  MAX_MESSAGES_PER_SESSION: 1000,
  /** 最大附件数量 */
  MAX_ATTACHMENTS_PER_MESSAGE: 10,
  /** 附件最大大小 (MB) */
  MAX_ATTACHMENT_SIZE_MB: 10,
} as const;

// ===== API相关常量 =====
export const API = {
  /** 默认API超时时间 (ms) */
  DEFAULT_TIMEOUT_MS: 30_000,
  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,
  /** 重试延迟基础值 (ms) */
  RETRY_DELAY_MS: 1_000,
  /** 批量请求大小 */
  BATCH_SIZE: 50,
  /** 分页默认大小 */
  DEFAULT_PAGE_SIZE: 20,
  /** 分页最大大小 */
  MAX_PAGE_SIZE: 100,
} as const;

// ===== UI相关常量 =====
export const UI = {
  /** 侧边栏默认宽度 (px) */
  SIDEBAR_DEFAULT_WIDTH: 280,
  /** 侧边栏最小宽度 (px) */
  SIDEBAR_MIN_WIDTH: 200,
  /** 侧边栏最大宽度 (px) */
  SIDEBAR_MAX_WIDTH: 400,
  /** 消息输入框最大高度 (px) */
  INPUT_MAX_HEIGHT: 200,
  /** 消息气泡最大宽度比例 */
  MESSAGE_MAX_WIDTH_RATIO: 0.85,
  /** 打字指示器延迟 (ms) */
  TYPING_INDICATOR_DELAY_MS: 500,
  /** 滚动到底部阈值 (px) */
  SCROLL_TO_BOTTOM_THRESHOLD_PX: 100,
  /** 虚拟列表项高度 (px) */
  VIRTUAL_LIST_ITEM_HEIGHT: 80,
  /** 虚拟列表缓冲区大小 */
  VIRTUAL_LIST_OVERSCAN: 5,
} as const;

// ===== 存储相关常量 =====
export const STORAGE = {
  /** 本地存储前缀 */
  STORAGE_KEY_PREFIX: 'mclaw:',
  /** 设置存储键 */
  SETTINGS_KEY: 'settings',
  /** 主题存储键 */
  THEME_KEY: 'theme',
  /** 语言存储键 */
  LANGUAGE_KEY: 'language',
  /** 最近会话存储键 */
  RECENT_SESSIONS_KEY: 'recent-sessions',
  /** 最大最近会话数 */
  MAX_RECENT_SESSIONS: 10,
  /** 存储版本号 */
  STORAGE_VERSION: '1.0.0',
} as const;

// ===== 错误代码常量 =====
export const ERROR_CODES = {
  /** 网络错误 */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** 超时错误 */
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  /** 认证错误 */
  AUTH_ERROR: 'AUTH_ERROR',
  /** 权限错误 */
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  /** 未找到 */
  NOT_FOUND: 'NOT_FOUND',
  /** 服务器错误 */
  SERVER_ERROR: 'SERVER_ERROR',
  /** 流式错误 */
  STREAMING_ERROR: 'STREAMING_ERROR',
  /** 网关错误 */
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  /** 未知错误 */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// ===== 事件类型常量 =====
export const EVENT_TYPES = {
  /** 消息接收 */
  MESSAGE_RECEIVED: 'message:received',
  /** 消息发送 */
  MESSAGE_SENT: 'message:sent',
  /** 流式开始 */
  STREAMING_START: 'streaming:start',
  /** 流式更新 */
  STREAMING_UPDATE: 'streaming:update',
  /** 流式结束 */
  STREAMING_END: 'streaming:end',
  /** 流式错误 */
  STREAMING_ERROR: 'streaming:error',
  /** 会话创建 */
  SESSION_CREATED: 'session:created',
  /** 会话更新 */
  SESSION_UPDATED: 'session:updated',
  /** 会话删除 */
  SESSION_DELETED: 'session:deleted',
  /** 设置变更 */
  SETTINGS_CHANGED: 'settings:changed',
  /** 主题变更 */
  THEME_CHANGED: 'theme:changed',
  /** 连接状态变更 */
  CONNECTION_STATUS_CHANGED: 'connection:status:changed',
} as const;

// ===== 正则表达式常量 =====
export const REGEX = {
  /** URL匹配 */
  URL: /https?:\/\/[^\s]+/g,
  /** 邮箱匹配 */
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /** 代码块匹配 */
  CODE_BLOCK: /```[\s\S]*?```/g,
  /** 行内代码匹配 */
  INLINE_CODE: /`[^`]+`/g,
  /** Markdown标题匹配 */
  MARKDOWN_HEADER: /^#{1,6}\s+/gm,
  /** 会话ID格式 */
  SESSION_ID: /^[a-zA-Z0-9_-]+$/,
  /** Cron会话键 */
  CRON_SESSION_KEY: /^cron:/,
} as const;

// ===== 文件类型常量 =====
export const FILE_TYPES = {
  /** 支持的图片类型 */
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  /** 支持的文档类型 */
  DOCUMENT: ['application/pdf', 'text/plain', 'text/markdown'],
  /** 支持的代码文件 */
  CODE: [
    'text/javascript',
    'text/typescript',
    'application/json',
    'text/html',
    'text/css',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-cpp',
    'text/x-go',
    'text/x-rust',
  ],
  /** 最大图片尺寸 (px) */
  MAX_IMAGE_DIMENSION: 4096,
  /** 图片预览质量 */
  IMAGE_PREVIEW_QUALITY: 0.8,
} as const;

// ===== Provider相关常量 =====
export const PROVIDER = {
  /** 默认Provider */
  DEFAULT_PROVIDER: 'openai',
  /** 默认模型 */
  DEFAULT_MODEL: 'gpt-4',
  /** 最大Token数 */
  MAX_TOKENS: 4096,
  /** 温度默认值 */
  DEFAULT_TEMPERATURE: 0.7,
  /** Top P默认值 */
  DEFAULT_TOP_P: 1.0,
  /** 频率惩罚默认值 */
  DEFAULT_FREQUENCY_PENALTY: 0,
  /** 存在惩罚默认值 */
  DEFAULT_PRESENCE_PENALTY: 0,
} as const;

// ===== 性能相关常量 =====
export const PERFORMANCE = {
  /** 防抖延迟 (ms) */
  DEBOUNCE_DELAY_MS: 300,
  /** 节流延迟 (ms) */
  THROTTLE_DELAY_MS: 100,
  /** 长任务阈值 (ms) */
  LONG_TASK_THRESHOLD_MS: 50,
  /** 内存警告阈值 (MB) */
  MEMORY_WARNING_THRESHOLD_MB: 500,
  /** 最大并发请求数 */
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// ===== 开发调试常量 =====
export const DEBUG = {
  /** 是否启用详细日志 */
  VERBOSE_LOGGING: process.env.NODE_ENV === 'development',
  /** 是否启用性能监控 */
  PERFORMANCE_MONITORING: process.env.NODE_ENV === 'development',
  /** 日志级别 */
  LOG_LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  /** 模拟延迟 (ms) - 仅开发环境 */
  MOCK_DELAY_MS: 500,
} as const;

// ===== 工具函数 =====

/**
 * 获取带前缀的存储键
 */
export function getStorageKey(key: string): string {
  return `${STORAGE.STORAGE_KEY_PREFIX}${key}`;
}

/**
 * 检查是否为Cron会话键
 */
export function isCronSessionKey(sessionKey: string): boolean {
  return sessionKey.startsWith('cron:');
}

/**
 * 构建Cron会话历史路径
 */
export function buildCronSessionHistoryPath(sessionKey: string): string {
  if (!isCronSessionKey(sessionKey)) {
    throw new Error(`Invalid cron session key: ${sessionKey}`);
  }
  return `/cron/sessions/${sessionKey.slice(5)}/history`;
}

/**
 * 规范化时间戳为毫秒
 * 处理秒级和毫秒级时间戳
 */
export function normalizeTimestamp(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn(...args);
    }
  };
}
