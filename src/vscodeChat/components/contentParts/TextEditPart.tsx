/**
 * TextEditPart - 文本编辑展示
 * 对齐 VS Code chatTextEditContentPart.ts (209行)
 */
import { useState } from 'react';
import { FilePen, ChevronDown, ChevronRight, Check, X } from 'lucide-react';

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

interface Props extends TextEditPartData {}

export function TextEditPart({ uri, edits, onAccept, onReject }: Props) {
  const [expanded, setExpanded] = useState(true);
  const fileName = uri.split('/').pop() || uri;

  return (
    <div className="vscode-chat-textedit-part">
      <div className="vscode-chat-textedit-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-textedit-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <FilePen size={13} />
        <span className="vscode-chat-textedit-filename">{fileName}</span>
        <span className="vscode-chat-textedit-path">{uri}</span>
        <span className="vscode-chat-textedit-count">{edits.length} edit{edits.length !== 1 ? 's' : ''}</span>
      </div>
      {expanded && (
        <div className="vscode-chat-textedit-body">
          {edits.map((edit, i) => (
            <div key={i} className="vscode-chat-textedit-edit">
              <span className="vscode-chat-textedit-range">
                L{edit.range.startLine}:{edit.range.startCol} → L{edit.range.endLine}:{edit.range.endCol}
              </span>
              <pre className="vscode-chat-textedit-text">{edit.text || '(delete)'}</pre>
            </div>
          ))}
          {(onAccept || onReject) && (
            <div className="vscode-chat-textedit-actions">
              {onAccept && (
                <button className="vscode-chat-textedit-accept" onClick={onAccept}>
                  <Check size={12} /> Accept
                </button>
              )}
              {onReject && (
                <button className="vscode-chat-textedit-reject" onClick={onReject}>
                  <X size={12} /> Reject
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
