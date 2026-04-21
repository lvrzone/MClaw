/**
 * Content Part - 内容块基类与类型定义
 * 对齐 VS Code Chat chatContentParts/chatContentParts.ts
 */

import React from 'react';

// ============ Part 类型枚举 ============
export type ContentPartType =
  // Phase 1-2: 核心 Parts
  | 'text'
  | 'markdown'
  | 'thinking'
  | 'task'
  | 'diff'
  | 'collapsible'
  | 'progress'
  | 'confirmation'
  | 'attachments'
  | 'command'
  | 'references'
  | 'error'
  | 'extensions'
  | 'tool_use'
  | 'tool_result'
  | 'image'
  | 'checkpoint'
  // Phase 3+: 补全 Parts
  | 'multi_diff'
  | 'code_citation'
  | 'text_edit'
  | 'subagent'
  | 'hook'
  | 'plan_review'
  | 'suggest_next'
  | 'question_carousel'
  | 'changes_summary';

// ============ Part 基础接口 ============
export interface IContentPart {
  /** Part 类型标识 */
  readonly type: ContentPartType;
  /** Part 唯一 ID */
  readonly id: string;
  /** 是否正在流式输出 */
  readonly isStreaming?: boolean;
  /** 渲染 Part */
  render(): React.ReactNode;
}

// ============ Text Part ============
export interface TextPartData {
  id: string;
  text: string;
  isStreaming?: boolean;
}

// ============ Markdown Part ============
export interface MarkdownPartData {
  id: string;
  content: string;
  isStreaming?: boolean;
}

// ============ Thinking Part ============
export interface ThinkingPartData {
  id: string;
  content: string;
  isStreaming?: boolean;
  isCollapsed?: boolean;
  tokenCount?: number;
  durationMs?: number;
}

// ============ Task Part ============
export interface TaskItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number; // 0-100
  children?: TaskItem[];
  description?: string;
  icon?: string;
}

export interface TaskPartData {
  id: string;
  title?: string;
  items: TaskItem[];
  isStreaming?: boolean;
}

// ============ Diff Part ============
export interface DiffPartData {
  id: string;
  language?: string;
  original: string;
  modified: string;
  originalUri?: string;
  modifiedUri?: string;
  mode?: 'unified' | 'split';
  title?: string;
  isStreaming?: boolean;
}

// ============ Collapsible Part ============
export interface CollapsiblePartData {
  id: string;
  header: string;
  headerIcon?: string;
  content: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  metadata?: Record<string, unknown>;
}

// ============ Progress Part ============
export interface ProgressPartData {
  id: string;
  title?: string;
  content?: string;
  percent?: number; // 0-100, undefined = indeterminate
  isStreaming?: boolean;
}

// ============ Confirmation Part ============
export interface ConfirmationPartData {
  id: string;
  title: string;
  message: string;
  options?: Array<{ label: string; value: string }>;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ============ Attachments Part ============
export interface AttachmentItem {
  id: string;
  name: string;
  url?: string;
  contentType?: string;
  size?: number;
  data?: string;
  icon?: string;
}

export interface AttachmentsPartData {
  id: string;
  attachments: AttachmentItem[];
}

// ============ Command Part ============
export interface CommandPartData {
  id: string;
  command: string;
  args?: string[];
  icon?: string;
  label?: string;
}

// ============ References Part ============
export interface ReferenceItem {
  uri?: string;
  url?: string;
  title?: string;
  snippet?: string;
  icon?: string;
  range?: { startLine: number; endLine: number };
}

export interface ReferencesPartData {
  id: string;
  references: ReferenceItem[];
}

// ============ Error Part ============
export interface ErrorPartData {
  id: string;
  code?: string;
  message: string;
  details?: Record<string, unknown>;
  isStreaming?: boolean;
}

// ============ Extensions Part ============
export interface ExtensionItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ExtensionsPartData {
  id: string;
  extensions: ExtensionItem[];
}

// ============ Tool Use Part ============
export interface ToolUsePartData {
  id: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  status?: 'running' | 'completed' | 'error';
  isStreaming?: boolean;
}

// ============ Tool Result Part ============
export interface ToolResultPartData {
  id: string;
  toolId: string;
  toolName?: string;
  content: string;
  isError?: boolean;
  isStreaming?: boolean;
}

// ============ Image Part ============
export interface ImagePartData {
  id: string;
  source: {
    type: 'url' | 'base64';
    url?: string;
    data?: string;
    mediaType?: string;
  };
  alt?: string;
}

// ============ Checkpoint Part ============
export interface CheckpointPartData {
  id: string;
  title: string;
  timestamp: number;
  icon?: string;
}

// ============ MultiDiff Part ============
export interface MultiDiffFile {
  uri: string;
  original?: string;
  modified?: string;
  language?: string;
  added?: number;
  removed?: number;
}

export interface MultiDiffPartData {
  id: string;
  type: 'multi_diff';
  title?: string;
  files: MultiDiffFile[];
  isStreaming?: boolean;
}

// ============ Code Citation Part ============
export interface CodeCitation {
  uri: string;
  license?: string;
  snippet?: string;
  range?: { startLine: number; endLine: number };
}

export interface CodeCitationPartData {
  id: string;
  type: 'code_citation';
  citations: CodeCitation[];
}

// ============ Text Edit Part ============
export interface TextEditOperation {
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  text: string;
}

export interface TextEditPartData {
  id: string;
  type: 'text_edit';
  uri: string;
  edits: TextEditOperation[];
  onAccept?: () => void;
  onReject?: () => void;
}

// ============ Subagent Part ============
export interface SubagentToolCall {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface SubagentPartData {
  id: string;
  type: 'subagent';
  title: string;
  agentId?: string;
  tools?: SubagentToolCall[];
  isWorking?: boolean;
  workingMessage?: string;
}

// ============ Hook Part ============
export type HookType = 'before_tool' | 'after_tool' | 'before_model' | 'after_model';

export interface HookPartData {
  id: string;
  type: 'hook';
  hookType: HookType;
  toolName?: string;
  isStopped?: boolean;
  systemMessage?: string;
  stopReason?: string;
}

// ============ Plan Review Part ============
export interface PlanStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  icon?: string;
}

export interface PlanReviewPartData {
  id: string;
  type: 'plan_review';
  title?: string;
  steps: PlanStep[];
  onApprove?: () => void;
  onReject?: () => void;
}

// ============ Suggest Next Part ============
export interface SuggestNextItem {
  label: string;
  value: string;
}

export interface SuggestNextPartData {
  id: string;
  type: 'suggest_next';
  suggestions: SuggestNextItem[];
  onSelect?: (value: string) => void;
}

// ============ Question Carousel Part ============
export interface CarouselQuestion {
  label: string;
  value: string;
}

export interface QuestionCarouselPartData {
  id: string;
  type: 'question_carousel';
  questions: CarouselQuestion[];
  currentIndex?: number;
  onSelect?: (value: string) => void;
}

// ============ Changes Summary Part ============
export interface FileChangeItem {
  uri: string;
  name: string;
  added: number;
  removed: number;
  type: 'created' | 'modified' | 'deleted';
}

export interface ChangesSummaryPartData {
  id: string;
  type: 'changes_summary';
  files: FileChangeItem[];
}

// ============ 联合类型 ============
export type AnyPartData =
  // Phase 1-2: 核心 Parts
  | TextPartData
  | MarkdownPartData
  | ThinkingPartData
  | TaskPartData
  | DiffPartData
  | CollapsiblePartData
  | ProgressPartData
  | ConfirmationPartData
  | AttachmentsPartData
  | CommandPartData
  | ReferencesPartData
  | ErrorPartData
  | ExtensionsPartData
  | ToolUsePartData
  | ToolResultPartData
  | ImagePartData
  | CheckpointPartData
  // Phase 3+: 补全 Parts
  | MultiDiffPartData
  | CodeCitationPartData
  | TextEditPartData
  | SubagentPartData
  | HookPartData
  | PlanReviewPartData
  | SuggestNextPartData
  | QuestionCarouselPartData
  | ChangesSummaryPartData;

// ============ Part 注册表接口 ============
export interface IContentPartRegistry {
  register<T extends IContentPart>(type: ContentPartType, factory: (data: unknown) => T): void;
  create(type: ContentPartType, data: unknown): IContentPart | null;
  getRenderer(type: ContentPartType): ((data: unknown) => React.ReactNode) | null;
}
