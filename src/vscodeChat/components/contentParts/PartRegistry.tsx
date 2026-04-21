/**
 * ContentPartRegistry - Part 类型注册表
 * 对齐 VS Code Chat PartRegistry 模式
 */

import React from 'react';
import type {
  ContentPartType,
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
  CommandPartData,
  ReferencesPartData,
  ErrorPartData,
  ExtensionsPartData,
  ToolUsePartData,
  ToolResultPartData,
  ImagePartData,
  CheckpointPartData,
} from './ContentPart';

import { TextPart } from './TextPart';
import { MarkdownPart } from './MarkdownPart';
import { ThinkingPart } from './ThinkingPart';
import { TaskPart } from './TaskPart';
import { DiffPart } from './DiffPart';
import { CollapsiblePart } from './CollapsiblePart';
import { ProgressPart } from './ProgressPart';
import { ConfirmationPart } from './ConfirmationPart';
import { AttachmentsPart } from './AttachmentsPart';
import { CommandPart } from './CommandPart';
import { ReferencesPart } from './ReferencesPart';
import { ErrorPart } from './ErrorPart';
import { ToolUsePart } from './ToolUsePart';
import { ToolResultPart } from './ToolResultPart';
import { ImagePart } from './ImagePart';
import { CheckpointPart } from './CheckpointPart';
import { MultiDiffPart } from './MultiDiffPart';
import { CodeCitationPart } from './CodeCitationPart';
import { TextEditPart } from './TextEditPart';
import { SubagentPart } from './SubagentPart';
import { HookPart } from './HookPart';
import { PlanReviewPart } from './PlanReviewPart';
import { SuggestNextPart } from './SuggestNextPart';
import { QuestionCarouselPart } from './QuestionCarouselPart';
import { ChangesSummaryPart } from './ChangesSummaryPart';

// Part 渲染器类型
type PartRenderer = (data: AnyPartData) => React.ReactNode;

// 注册表 Map
const registry = new Map<ContentPartType, PartRenderer>();

// 注册所有 Part
function registerAll() {
  // Phase 1-2: 核心 Parts
  registry.set('text', (data) => <TextPart {...(data as TextPartData)} />);
  registry.set('markdown', (data) => <MarkdownPart {...(data as MarkdownPartData)} />);
  registry.set('thinking', (data) => <ThinkingPart {...(data as ThinkingPartData)} />);
  registry.set('task', (data) => <TaskPart {...(data as TaskPartData)} />);
  registry.set('diff', (data) => <DiffPart {...(data as DiffPartData)} />);
  registry.set('collapsible', (data) => <CollapsiblePart {...(data as CollapsiblePartData)} />);
  registry.set('progress', (data) => <ProgressPart {...(data as ProgressPartData)} />);
  registry.set('confirmation', (data) => <ConfirmationPart {...(data as ConfirmationPartData)} />);
  registry.set('attachments', (data) => <AttachmentsPart {...(data as AttachmentsPartData)} />);
  registry.set('command', (data) => <CommandPart {...(data as CommandPartData)} />);
  registry.set('references', (data) => <ReferencesPart {...(data as ReferencesPartData)} />);
  registry.set('error', (data) => <ErrorPart {...(data as ErrorPartData)} />);
  registry.set('extensions', (data) => <ExtensionsPartInner {...(data as ExtensionsPartData)} />);
  registry.set('tool_use', (data) => <ToolUsePart {...(data as ToolUsePartData)} />);
  registry.set('tool_result', (data) => <ToolResultPart {...(data as ToolResultPartData)} />);
  registry.set('image', (data) => <ImagePart {...(data as ImagePartData)} />);
  registry.set('checkpoint', (data) => <CheckpointPart {...(data as CheckpointPartData)} />);

  // Phase 3+: 补全 Parts
  registry.set('multi_diff', (data) => <MultiDiffPart {...(data as unknown as Parameters<typeof MultiDiffPart>[0])} />);
  registry.set('code_citation', (data) => <CodeCitationPart {...(data as unknown as Parameters<typeof CodeCitationPart>[0])} />);
  registry.set('text_edit', (data) => <TextEditPart {...(data as unknown as Parameters<typeof TextEditPart>[0])} />);
  registry.set('subagent', (data) => <SubagentPart {...(data as unknown as Parameters<typeof SubagentPart>[0])} />);
  registry.set('hook', (data) => <HookPart {...(data as unknown as Parameters<typeof HookPart>[0])} />);
  registry.set('plan_review', (data) => <PlanReviewPart {...(data as unknown as Parameters<typeof PlanReviewPart>[0])} />);
  registry.set('suggest_next', (data) => <SuggestNextPart {...(data as unknown as Parameters<typeof SuggestNextPart>[0])} />);
  registry.set('question_carousel', (data) => <QuestionCarouselPart {...(data as unknown as Parameters<typeof QuestionCarouselPart>[0])} />);
  registry.set('changes_summary', (data) => <ChangesSummaryPart {...(data as unknown as Parameters<typeof ChangesSummaryPart>[0])} />);
}

// 初始化注册
registerAll();

/**
 * 获取 Part 渲染器
 */
export function getPartRenderer(type: ContentPartType): PartRenderer | null {
  return registry.get(type) ?? null;
}

/**
 * 渲染单个 Part
 */
export function renderPart(data: AnyPartData): React.ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const part = data as any;
  const renderer = getPartRenderer(part.type as ContentPartType);
  if (!renderer) {
    return (
      <div className="vscode-chat-unknown-part" data-type={part.type}>
        Unknown part type: {part.type}
      </div>
    );
  }
  return renderer(data);
}

/**
 * 渲染多个 Parts
 */
export function renderParts(parts: AnyPartData[]): React.ReactNode[] {
  return parts.map((part) => (
    <React.Fragment key={part.id}>
      {renderPart(part)}
    </React.Fragment>
  ));
}

/**
 * 动态注册自定义 Part
 */
export function registerPart(type: ContentPartType, renderer: PartRenderer): void {
  registry.set(type, renderer);
}

/**
 * 获取所有已注册的 Part 类型
 */
export function getRegisteredTypes(): ContentPartType[] {
  return Array.from(registry.keys());
}

// Extensions 占位实现
function ExtensionsPartInner({ id, extensions }: ExtensionsPartData) {
  return (
    <div className="vscode-chat-extensions-part" data-id={id}>
      {extensions.map((ext, idx) => (
        <div key={idx} className="vscode-chat-extension-item">
          <span className="vscode-chat-extension-icon">{ext.icon || '🔌'}</span>
          <span className="vscode-chat-extension-name">{ext.name}</span>
          {ext.description && (
            <span className="vscode-chat-extension-desc">{ext.description}</span>
          )}
        </div>
      ))}
    </div>
  );
}