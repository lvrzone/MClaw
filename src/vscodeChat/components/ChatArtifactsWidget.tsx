/**
 * ChatArtifactsWidget - AI 产物展示面板
 * 对齐 VS Code chatArtifactsWidget.ts (549行，简化版)
 *
 * 功能：
 * - 显示 AI 生成的文件/截图/代码片段
 * - 树形分组展示
 * - 点击打开/预览
 * - 复制/下载操作
 */
import { useState, useCallback } from 'react';
import {
  FileText, Image, Globe, BookOpen, Copy, Download,
  ChevronRight, ChevronDown, X, ExternalLink, CheckCircle2
} from 'lucide-react';

// ============ Types ============
export type ArtifactType = 'file' | 'screenshot' | 'url' | 'plan' | 'devServer' | 'code' | 'image';

export interface ChatArtifact {
  id: string;
  type: ArtifactType;
  name: string;
  uri?: string;
  url?: string;
  content?: string;
  mimeType?: string;
  language?: string;
  added?: number;
  removed?: number;
  onCopy?: () => void;
  onDownload?: () => void;
  onOpen?: () => void;
  onPreview?: () => void;
}

export interface ArtifactGroup {
  id: string;
  name: string;
  artifacts: ChatArtifact[];
  onClear?: () => void;
}

export interface ChatArtifactsWidgetProps {
  groups: ArtifactGroup[];
  title?: string;
  onClose?: () => void;
}

// ============ Artifact Icon ============
const artifactIcons: Record<ArtifactType, React.ReactNode> = {
  file: <FileText size={14} />,
  screenshot: <Image size={14} />,
  image: <Image size={14} />,
  url: <Globe size={14} />,
  plan: <BookOpen size={14} />,
  devServer: <Globe size={14} />,
  code: <FileText size={14} />,
};

function getArtifactIcon(type: ArtifactType) {
  return artifactIcons[type] || <FileText size={14} />;
}

// ============ Actions Menu ============
function ArtifactActions({ artifact }: { artifact: ChatArtifact }) {

  const handleCopy = useCallback(async () => {
    if (artifact.content) {
      await navigator.clipboard.writeText(artifact.content);
      artifact.onCopy?.();
    }
  }, [artifact]);

  const handleOpen = useCallback(() => {
    if (artifact.uri) window.open(artifact.uri, '_blank');
    else if (artifact.url) window.open(artifact.url, '_blank');
    artifact.onOpen?.();
  }, [artifact]);

  return (
    <div className="vscode-chat-artifact-actions">
      <button className="vscode-chat-artifact-action" onClick={handleCopy} title="复制">
        <Copy size={12} />
      </button>
      {(artifact.uri || artifact.url) && (
        <button className="vscode-chat-artifact-action" onClick={handleOpen} title="打开">
          <ExternalLink size={12} />
        </button>
      )}
      {artifact.onDownload && (
        <button className="vscode-chat-artifact-action" onClick={artifact.onDownload} title="下载">
          <Download size={12} />
        </button>
      )}
    </div>
  );
}

// ============ Single Artifact Row ============
function ArtifactLeaf({ artifact }: { artifact: ChatArtifact }) {
  const handleClick = useCallback(() => {
    if (artifact.onPreview) artifact.onPreview();
    else if (artifact.uri) window.open(artifact.uri, '_blank');
    else if (artifact.url) window.open(artifact.url, '_blank');
  }, [artifact]);

  return (
    <div className="vscode-chat-artifact-leaf" onClick={handleClick}>
      <span className="vscode-chat-artifact-leaf-icon">{getArtifactIcon(artifact.type)}</span>
      <span className="vscode-chat-artifact-leaf-name">{artifact.name}</span>
      {(artifact.added !== undefined || artifact.removed !== undefined) && (
        <span className="vscode-chat-artifact-leaf-stats">
          {artifact.added !== undefined && <span className="vscode-chat-diff-add">+{artifact.added}</span>}
          {artifact.removed !== undefined && <span className="vscode-chat-diff-remove">-{artifact.removed}</span>}
        </span>
      )}
      <ArtifactActions artifact={artifact} />
    </div>
  );
}

// ============ Group ============
function ArtifactGroupRow({ group, defaultExpanded = true }: { group: ArtifactGroup; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="vscode-chat-artifact-group">
      <div
        className="vscode-chat-artifact-group-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="vscode-chat-artifact-group-toggle">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="vscode-chat-artifact-group-name">{group.name}</span>
        <span className="vscode-chat-artifact-group-count">{group.artifacts.length}</span>
        {group.onClear && (
          <button
            className="vscode-chat-artifact-group-clear"
            onClick={(e) => { e.stopPropagation(); group.onClear?.(); }}
            title="清除"
          >
            <X size={11} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="vscode-chat-artifact-group-leaves">
          {group.artifacts.map((artifact) => (
            <ArtifactLeaf key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Main Widget ============
export function ChatArtifactsWidget({ groups, title = 'Artifacts', onClose }: ChatArtifactsWidgetProps) {
  const totalArtifacts = groups.reduce((s, g) => s + g.artifacts.length, 0);
  if (totalArtifacts === 0) return null;

  return (
    <div className="vscode-chat-artifacts-widget">
      <div className="vscode-chat-artifacts-header">
        <span className="vscode-chat-artifacts-title">
          <CheckCircle2 size={13} />
          {title}
        </span>
        <span className="vscode-chat-artifacts-count">{totalArtifacts} items</span>
        {onClose && (
          <button className="vscode-chat-artifacts-close" onClick={onClose}>
            <X size={13} />
          </button>
        )}
      </div>
      <div className="vscode-chat-artifacts-body">
        {groups.map((group) => (
          <ArtifactGroupRow key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}

export default ChatArtifactsWidget;
