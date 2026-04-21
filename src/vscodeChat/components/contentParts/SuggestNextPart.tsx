/**
 * SuggestNextPart - 建议下一个问题
 * 对齐 VS Code chatSuggestNextWidget.ts (300行)
 */
import { Lightbulb, ChevronRight } from 'lucide-react';

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

interface Props extends SuggestNextPartData {}

export function SuggestNextPart({ suggestions, onSelect }: Props) {
  if (!suggestions.length) return null;

  return (
    <div className="vscode-chat-suggestnext-part">
      <div className="vscode-chat-suggestnext-header">
        <Lightbulb size={13} />
        <span>Suggested next</span>
      </div>
      <div className="vscode-chat-suggestnext-list">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="vscode-chat-suggestnext-item"
            onClick={() => onSelect?.(s.value)}
          >
            <ChevronRight size={11} className="vscode-chat-suggestnext-arrow" />
            <span className="vscode-chat-suggestnext-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}