/**
 * CodeCitationPart - 代码引用展示
 * 对齐 VS Code chatCodeCitationContentPart.ts (61行)
 */
import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

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

interface Props extends CodeCitationPartData {}

export function CodeCitationPart({ citations }: Props) {
  const [expanded, setExpanded] = useState(false);
  const label = citations.length === 1
    ? '1 code citation'
    : `${citations.length} code citations`;

  return (
    <div className="vscode-chat-code-citation-part">
      <div
        className="vscode-chat-code-citation-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="vscode-chat-code-citation-toggle">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <BookOpen size={13} />
        <span className="vscode-chat-code-citation-label">{label}</span>
      </div>
      {expanded && (
        <div className="vscode-chat-code-citation-list">
          {citations.map((c, i) => (
            <div key={i} className="vscode-chat-code-citation-item">
              <div className="vscode-chat-code-citation-file">
                <span className="vscode-chat-code-citation-path">{c.uri.split('/').pop()}</span>
                {c.range && (
                  <span className="vscode-chat-code-citation-range">
                    L{c.range.startLine}–{c.range.endLine}
                  </span>
                )}
                {c.license && (
                  <span className="vscode-chat-code-citation-license">{c.license}</span>
                )}
                <a
                  href={c.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vscode-chat-code-citation-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={11} />
                </a>
              </div>
              {c.snippet && (
                <pre className="vscode-chat-code-citation-snippet">{c.snippet}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
