/**
 * ReferencesPart - 引用资料展示
 * 对齐 VS Code chatReferencesContentPart.ts
 */
import type { ReferencesPartData, ReferenceItem } from './ContentPart';
import { FileText, ExternalLink, Hash } from 'lucide-react';

interface Props extends ReferencesPartData {}

function ReferenceCard({ ref: item }: { ref: ReferenceItem }) {
  const handleClick = () => {
    if (item.url) window.open(item.url, '_blank');
    else if (item.uri) window.open(item.uri, '_blank');
  };

  return (
    <div className="vscode-chat-reference-card" onClick={handleClick} role="button" tabIndex={0}>
      <div className="vscode-chat-reference-icon">
        <FileText size={13} />
      </div>
      <div className="vscode-chat-reference-info">
        <span className="vscode-chat-reference-title">{item.title || item.uri || item.url}</span>
        {item.snippet && <span className="vscode-chat-reference-snippet">{item.snippet}</span>}
        {item.range && (
          <span className="vscode-chat-reference-range">
            <Hash size={10} /> L{item.range.startLine}–L{item.range.endLine}
          </span>
        )}
      </div>
      {(item.url || item.uri) && (
        <ExternalLink size={12} className="vscode-chat-reference-link" />
      )}
    </div>
  );
}

export function ReferencesPart({ references }: Props) {
  if (!references.length) return null;

  return (
    <div className="vscode-chat-references-part">
      <div className="vscode-chat-references-label">References ({references.length})</div>
      <div className="vscode-chat-references-list">
        {references.map((ref, idx) => (
          <ReferenceCard key={idx} ref={ref} />
        ))}
      </div>
    </div>
  );
}
