/**
 * DiffPart - 代码对比展示
 * 对齐 VS Code chatDiffBlockPart.ts (207行)
 */
import {  useMemo  } from 'react';
import type { DiffPartData } from './ContentPart';
import { GitCompare, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface Props extends DiffPartData {}

export function DiffPart({ original, modified, mode: defaultMode = 'unified', title, originalUri, modifiedUri }: Props) {
  const [mode, setMode] = useState<'unified' | 'split'>(defaultMode);
  const [copied, setCopied] = useState(false);

  // 简单的行对比计算
  const diff = useMemo(() => {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const result: Array<{ type: 'same' | 'add' | 'remove'; origLine?: number; modLine?: number; content: string }> = [];

    const maxLen = Math.max(origLines.length, modLines.length);
    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const m = modLines[i];
      if (o === m) {
        result.push({ type: 'same', origLine: i + 1, modLine: i + 1, content: o ?? '' });
      } else {
        if (o !== undefined) result.push({ type: 'remove', origLine: i + 1, content: o });
        if (m !== undefined) result.push({ type: 'add', modLine: i + 1, content: m });
      }
    }
    return result;
  }, [original, modified]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const added = diff.filter((l) => l.type === 'add').length;
  const removed = diff.filter((l) => l.type === 'remove').length;

  return (
    <div className="vscode-chat-diff-part">
      {/* Header */}
      <div className="vscode-chat-diff-header">
        <div className="vscode-chat-diff-title">
          <GitCompare size={13} />
          {title && <span>{title}</span>}
          <span className="vscode-chat-diff-stats">
            <span className="vscode-chat-diff-add">+{added}</span>
            <span className="vscode-chat-diff-remove">-{removed}</span>
          </span>
        </div>
        <div className="vscode-chat-diff-actions">
          <button
            className={`vscode-chat-diff-mode-btn ${mode === 'unified' ? 'active' : ''}`}
            onClick={() => setMode('unified')}
          >Unified</button>
          <button
            className={`vscode-chat-diff-mode-btn ${mode === 'split' ? 'active' : ''}`}
            onClick={() => setMode('split')}
          >Split</button>
          <button className="vscode-chat-diff-copy-btn" onClick={() => handleCopy(modified)} title="Copy modified">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Unified Diff */}
      {mode === 'unified' && (
        <div className="vscode-chat-diff-unified">
          <pre className="vscode-chat-diff-pre">
            {diff.map((line, idx) => (
              <div key={idx} className={`vscode-chat-diff-line ${line.type}`}>
                <span className="vscode-chat-diff-line-num">{line.origLine ?? ''}</span>
                <span className="vscode-chat-diff-line-num">{line.modLine ?? ''}</span>
                <span className="vscode-chat-diff-line-prefix">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                <span className="vscode-chat-diff-line-content">{line.content}</span>
              </div>
            ))}
          </pre>
        </div>
      )}

      {/* Split Diff */}
      {mode === 'split' && (
        <div className="vscode-chat-diff-split">
          <div className="vscode-chat-diff-split-left">
            <div className="vscode-chat-diff-split-header">Original{originalUri && <span className="vscode-chat-diff-uri">{originalUri}</span>}</div>
            <pre className="vscode-chat-diff-pre">
              {original.split('\n').map((line, idx) => (
                <div key={idx} className="vscode-chat-diff-line same">
                  <span className="vscode-chat-diff-line-num">{idx + 1}</span>
                  <span className="vscode-chat-diff-line-content">{line}</span>
                </div>
              ))}
            </pre>
          </div>
          <div className="vscode-chat-diff-split-right">
            <div className="vscode-chat-diff-split-header">Modified{modifiedUri && <span className="vscode-chat-diff-uri">{modifiedUri}</span>}</div>
            <pre className="vscode-chat-diff-pre">
              {modified.split('\n').map((line, idx) => (
                <div key={idx} className="vscode-chat-diff-line same">
                  <span className="vscode-chat-diff-line-num">{idx + 1}</span>
                  <span className="vscode-chat-diff-line-content">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
