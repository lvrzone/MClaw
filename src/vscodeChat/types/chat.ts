/**
 * VS Code Chat 类型定义 - 完整版
 * 移植自 VS Code Chat
 */

// ============ 角色 ============
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

// ============ 内容块类型 ============
export type ContentBlockType = 
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'toolCall'
  | 'toolResult'
  | 'image'
  | 'markdown'
  | 'code'
  | 'confirmation'
  | 'progress'
  | 'task'
  | 'tree'
  | 'warning'
  | 'error'
  | 'thinking'
  | 'mentions'
  | 'attachments'
  | 'references'
  | 'citation'
  | 'diff'
  | 'edited_file'
  | 'checkpoint';

// ============ 文本块 ============
export interface TextContentBlock {
  type: 'text';
  text: string;
}

// ============ 工具调用块 ============
export interface ToolUseContentBlock {
  type: 'tool_use' | 'toolCall';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ============ 工具结果块 ============
export interface ToolResultContentBlock {
  type: 'tool_result' | 'toolResult';
  id?: string;
  name?: string;
  content?: string | ContentBlock[];
}

// ============ 图片块 ============
export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'url' | 'base64';
    url?: string;
    data?: string;
    media_type?: string;
  };
}

// ============ Markdown 块 ============
export interface MarkdownContentBlock {
  type: 'markdown';
  content: string;
}

// ============ 代码块 ============
export interface CodeContentBlock {
  type: 'code';
  language?: string;
  code: string;
  uri?: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

// ============ 确认块 ============
export interface ConfirmationContentBlock {
  type: 'confirmation';
  title: string;
  message: string;
  options?: { label: string; value: string }[];
}

// ============ 进度块 ============
export interface ProgressContentBlock {
  type: 'progress';
  content: string;
}

// ============ 任务块 ============
export interface TaskContentBlock {
  type: 'task';
  title: string;
  status: 'in_progress' | 'completed' | 'failed';
  steps?: TaskStep[];
}

export interface TaskStep {
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ============ 树块 ============
export interface TreeContentBlock {
  type: 'tree';
  data: TreeNode[];
}

export interface TreeNode {
  label: string;
  icon?: string;
  children?: TreeNode[];
  expanded?: boolean;
}

// ============ Diff 块 ============
export interface DiffContentBlock {
  type: 'diff';
  uri: string;
  original?: string;
  modified?: string;
  language?: string;
}

// ============ 思考块 ============
export interface ThinkingContentBlock {
  type: 'thinking';
  content: string;
}

// ============ 引用块 ============
export interface ReferencesContentBlock {
  type: 'references';
  references: Reference[];
}

export interface Reference {
  uri?: string;
  url?: string;
  title?: string;
  snippet?: string;
}

// ============ 统一内容块类型 ============
export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ImageContentBlock
  | MarkdownContentBlock
  | CodeContentBlock
  | ConfirmationContentBlock
  | ProgressContentBlock
  | TaskContentBlock
  | TreeContentBlock
  | DiffContentBlock
  | ThinkingContentBlock
  | ReferencesContentBlock;

// ============ 聊天消息 ============
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string | ContentBlock[];
  timestamp: number;
  name?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  agentId?: string;
  sessionId?: string;
}

// ============ 快捷回复 ============
export interface ChatQuickReply {
  label: string;
  value: string;
  icon?: string;
}

// ============ 工具调用状态 ============
export interface ToolCallStatus {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  progress?: string;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

// ============ 附件 ============
export interface ChatAttachment {
  id: string;
  name: string;
  url?: string;
  contentType?: string;
  size?: number;
  data?: string;
}

// ============ 变量 ============
export interface ChatVariable {
  id: string;
  name: string;
  value: string;
  range?: { start: number; end: number };
  kind?: 'text' | 'file' | 'url' | 'symbol';
}

// ============ 会话 ============
export interface ChatSession {
  id: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  agentId?: string;
}

// ============ 模型信息 ============
export interface LanguageModel {
  id: string;
  vendor: string;
  name: string;
  family?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsToolCalling?: boolean;
  isDefault?: boolean;
}

// ============ Slash 命令 ============
export interface SlashCommand {
  name: string;
  description: string;
  provider?: string;
}

// ============ 快捷操作 ============
export interface ChatAction {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  enabled?: boolean;
}

// ============ 搜索结果 ============
export interface ChatSearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type?: 'file' | 'web' | 'symbol';
}

// ============ 代码块信息 ============
export interface CodeBlock {
  language: string;
  code: string;
  uri?: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

// ============ Widget 配置 ============
export interface ChatWidgetConfig {
  location: 'panel' | 'sidebar' | 'inline' | 'quick';
  renderInputOnTop?: boolean;
  renderFollowups?: boolean;
  supportsFileReferences?: boolean;
  supportsAgentSelector?: boolean;
  renderStyle?: 'default' | 'minimal';
}

// ============ 错误信息 ============
export interface ChatError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============ 流式内容 ============
export type StreamingContent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string }
  | { type: 'tool_result'; id: string; name: string; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'progress'; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string };
