/**
 * CommandPart - 命令展示内容块
 */
import {  useState  } from 'react';
import type { CommandPartData } from './ContentPart';
import { Terminal, Copy, Check } from 'lucide-react';

interface Props extends CommandPartData {}

export function CommandPart({ command, args, icon, label }: Props) {
  const [copied, setCopied] = useState(false);
  const fullCommand = args ? `${command} ${args.join(' ')}` : command;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="vscode-chat-command-part">
      <div className="vscode-chat-command-label">
        {icon && <span className="vscode-chat-command-icon">{icon}</span>}
        <Terminal size={13} />
        <span>{label || 'Command'}</span>
      </div>
      <div className="vscode-chat-command-block">
        <pre className="vscode-chat-command-pre">{fullCommand}</pre>
        <button className="vscode-chat-command-copy" onClick={handleCopy} title="Copy">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}
