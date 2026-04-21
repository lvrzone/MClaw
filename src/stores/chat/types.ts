/**
 * Unified content block type enum — mirrors WorkBuddy's yYe architecture
 * All message rendering dispatches through these three types.
 */
export enum ContentBlockType {
  TEXT = 'text',
  REASONING = 'reasoning',
  TOOL_CALL = 'tool-call',
}

/** Normalized content block for rendering dispatch */
export interface NormalizedBlock {
  /** Unified type */
  type: ContentBlockType;
  /** TEXT: markdown text; REASONING: thinking text */
  text?: string;
  /** REASONING: is the thinking complete? */
  complete?: boolean;
  /** REASONING: is this the last block in the message? */
  isLast?: boolean;
  /** TOOL_CALL: tool data */
  tool?: {
    id: string;
    name: string;
    status: 'running' | 'stream_executing' | 'completed' | 'failed' | 'executed';
    args?: unknown;
    result?: unknown;
    error?: string;
    durationMs?: number;
  };
  /** Original block reference */
  raw?: ContentBlock;
}

/** Metadata for locally-attached files (not from Gateway) */
export interface AttachedFileMeta {
  fileName: string;
  mimeType: string;
  fileSize: number;
  preview: string | null;
  filePath?: string;
  source?: 'user-upload' | 'tool-result' | 'message-ref';
}

/** Raw message from OpenClaw chat.history */
export interface RawMessage {
  role: 'user' | 'assistant' | 'system' | 'toolresult';
  content: unknown; // string | ContentBlock[]
  timestamp?: number;
  id?: string;
  toolCallId?: string;
  toolName?: string;
  details?: unknown;
  isError?: boolean;
  /** Local-only: file metadata for user-uploaded attachments (not sent to/from Gateway) */
  _attachedFiles?: AttachedFileMeta[];
}

/** Content block inside a message */
export interface ContentBlock {
  type: 'text' | 'image' | 'thinking' | 'reasoning' | 'tool_use' | 'tool_result' | 'toolCall' | 'toolResult' | 'tool-call';
  text?: string;
  thinking?: string;
  reasoning?: string;
  source?: { type: string; media_type?: string; data?: string; url?: string };
  /** Flat image format from Gateway tool results (no source wrapper) */
  data?: string;
  mimeType?: string;
  id?: string;
  name?: string;
  input?: unknown;
  arguments?: unknown;
  params?: unknown;
  content?: unknown;
  /** TOOL_CALL: tool object with status */
  tool?: {
    id: string;
    name: string;
    status?: string;
    args?: unknown;
    result?: unknown;
    error?: string;
  };
}

/** Session from sessions.list */
export interface ChatSession {
  key: string;
  label?: string;
  displayName?: string;
  thinkingLevel?: string;
  model?: string;
  updatedAt?: number;
  /** 群聊参与者 Agent IDs */
  participantAgents?: string[];
  /** 是否为群聊会话 */
  isGroupChat?: boolean;
}

export interface ToolStatus {
  id?: string;
  toolCallId?: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  summary?: string;
  updatedAt: number;
  input?: unknown; // 工具调用的输入参数
}

/** 需要用户确认的工具调用 */
export interface ToolConfirmation {
  toolCallId: string;
  toolName: string;
  description: string;
  args?: unknown;
}

export interface ChatState {
  // Messages
  messages: RawMessage[];
  loading: boolean;
  error: string | null;
  /** 滚动到指定消息 ID（用于历史提问点击跳转） */
  scrollToMessageId: string | null;

  // Streaming
  sending: boolean;
  activeRunId: string | null;
  streamingText: string;
  streamingMessage: unknown | null;
  streamingTools: ToolStatus[];
  pendingFinal: boolean;
  lastUserMessageAt: number | null;
  /** Images collected from tool results, attached to the next assistant message */
  pendingToolImages: AttachedFileMeta[];

  // Sessions
  sessions: ChatSession[];
  currentSessionKey: string;
  currentAgentId: string;
  /** First user message text per session key, used as display label */
  sessionLabels: Record<string, string>;
  /** User-defined custom labels (remarks) per session key - takes precedence over auto-generated labels */
  sessionCustomLabels: Record<string, string>;
  /** Last message timestamp (ms) per session key, used for sorting */
  sessionLastActivity: Record<string, number>;
  /** Unread message counts per session key */
  sessionUnreadCounts: Record<string, number>;

  // Thinking
  showThinking: boolean;
  thinkingLevel: string | null;
  /** 保存上一次思考内容，用于在输入框上方显示（持久化到下一次会话） */
  lastThinking: string | null;

  // Checkpoints
  checkpoints: Array<{ id: string; timestamp: number; label: string }>;
  currentCheckpointId: string | null;

  // Tool Confirmation
  toolConfirm: ToolConfirmation | null;
  requestToolConfirm: (toolCallId: string, toolName: string, description: string, args?: unknown) => void;
  resolveToolConfirm: (approved: boolean) => void;

  // Agent
  switchAgent: (agentId: string) => void;

  // Actions
  loadSessions: () => Promise<void>;
  switchSession: (key: string) => void;
  newSession: () => void;
  createGroupChat: (agentIds: string[]) => void;
  deleteSession: (key: string) => Promise<void>;
  cleanupEmptySession: () => void;
  loadHistory: (quiet?: boolean) => Promise<void>;
  sendMessage: (
    text: string,
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      fileSize: number;
      stagedPath: string;
      preview: string | null;
    }>,
    targetAgentId?: string | null,
  ) => Promise<void>;
  abortRun: () => Promise<void>;
  handleChatEvent: (event: Record<string, unknown>) => void;
  toggleThinking: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  /** Scroll to a specific message by ID (used for history click jump) */
  scrollToMessage: (messageId: string) => void;
  /** Clear scroll target after scrolling is done */
  clearScrollTarget: () => void;
  /** Clear unread count for a specific session */
  clearUnreadCount: (key: string) => void;
  /** Restore a checkpoint */
  restoreCheckpoint: (id: string) => void;
  /** Create a new checkpoint */
  createCheckpoint: (label?: string) => void;
}

export const DEFAULT_CANONICAL_PREFIX = 'agent:main';
export const DEFAULT_SESSION_KEY = `${DEFAULT_CANONICAL_PREFIX}:main`;
