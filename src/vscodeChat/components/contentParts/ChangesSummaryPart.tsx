/**
 * ChangesSummaryPart - 变更摘要
 */
import { GitBranch } from 'lucide-react';

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

interface Props extends ChangesSummaryPartData {}

export function ChangesSummaryPart({ files }: Props) {
  const totalAdded = files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="vscode-chat-changes-summary-part">
      <div className="vscode-chat-changes-summary-header">
        <GitBranch size={14} />
        <span className="vscode-chat-changes-summary-title">{files.length} files changed</span>
        <span className="vscode-chat-diff-stats">
          <span className="vscode-chat-diff-add">+{totalAdded}</span>
          <span className="vscode-chat-diff-remove">-{totalRemoved}</span>
        </span>
      </div>
      <div className="vscode-chat-changes-summary-list">
        {files.map((f, i) => (
          <div key={i} className="vscode-chat-changes-summary-file" data-type={f.type}>
            <span className="vscode-chat-changes-summary-name">{f.name}</span>
            <span className="vscode-chat-diff-stats">
              {f.added > 0 && <span className="vscode-chat-diff-add">+{f.added}</span>}
              {f.removed > 0 && <span className="vscode-chat-diff-remove">-{f.removed}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}