/**
 * MultiDiffPart - 多文件 Diff 展示
 * 对齐 VS Code chatMultiDiffContentPart.ts (323行)
 */
import { useState } from 'react';
import { GitCompare, ChevronDown, ChevronRight, FileText } from 'lucide-react';

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

interface Props extends MultiDiffPartData {}

function FileDiffRow({ file }: { file: MultiDiffFile }) {
  const [expanded, setExpanded] = useState(false);
  const fileName = file.uri.split('/').pop() || file.uri;
  const added = file.added ?? (file.modified?.split('\n').length ?? 0);
  const removed = file.removed ?? (file.original?.split('\n').length ?? 0);

  return (
    <div className="vscode-chat-multidiff-file">
      <div
        className="vscode-chat-multidiff-file-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="vscode-chat-multidiff-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <FileText size={13} className="vscode-chat-multidiff-file-icon" />
        <span className="vscode-chat-multidiff-file-name">{fileName}</span>
        <span className="vscode-chat-multidiff-file-path">{file.uri}</span>
        <span className="vscode-chat-diff-stats">
          {added > 0 && <span className="vscode-chat-diff-add">+{added}</span>}
          {removed > 0 && <span className="vscode-chat-diff-remove">-{removed}</span>}
        </span>
      </div>
      {expanded && file.original !== undefined && file.modified !== undefined && (
        <div className="vscode-chat-multidiff-file-body">
          <pre className="vscode-chat-diff-pre">
            {file.original.split('\n').map((line, i) => {
              const modLine = file.modified!.split('\n')[i];
              const type = line === modLine ? 'same' : 'remove';
              return (
                <div key={`o-${i}`} className={`vscode-chat-diff-line ${type}`}>
                  <span className="vscode-chat-diff-line-num">{i + 1}</span>
                  <span className="vscode-chat-diff-line-prefix">{type === 'remove' ? '-' : ' '}</span>
                  <span className="vscode-chat-diff-line-content">{line}</span>
                </div>
              );
            })}
            {file.modified!.split('\n').map((line, i) => {
              const origLine = file.original!.split('\n')[i];
              if (line === origLine) return null;
              return (
                <div key={`m-${i}`} className="vscode-chat-diff-line add">
                  <span className="vscode-chat-diff-line-num">{i + 1}</span>
                  <span className="vscode-chat-diff-line-prefix">+</span>
                  <span className="vscode-chat-diff-line-content">{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MultiDiffPart({ title, files, isStreaming }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const totalAdded = files.reduce((s, f) => s + (f.added ?? 0), 0);
  const totalRemoved = files.reduce((s, f) => s + (f.removed ?? 0), 0);

  return (
    <div className="vscode-chat-multidiff-part">
      <div className="vscode-chat-multidiff-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="vscode-chat-multidiff-toggle">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <GitCompare size={14} />
        <span className="vscode-chat-multidiff-title">{title || `${files.length} files changed`}</span>
        <span className="vscode-chat-diff-stats">
          <span className="vscode-chat-diff-add">+{totalAdded}</span>
          <span className="vscode-chat-diff-remove">-{totalRemoved}</span>
        </span>
      </div>
      {!collapsed && (
        <div className="vscode-chat-multidiff-list">
          {files.map((file) => (
            <FileDiffRow key={file.uri} file={file} />
          ))}
        </div>
      )}
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
