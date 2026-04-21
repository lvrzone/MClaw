/**
 * CollapsiblePart - 可折叠内容块
 * 对齐 VS Code chatCollapsibleContentPart.ts (195行)
 */
import {  useState  } from 'react';
import type { CollapsiblePartData } from './ContentPart';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Props extends CollapsiblePartData {}

export function CollapsiblePart({ header, headerIcon, content, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="vscode-chat-collapsible-part">
      <div
        className="vscode-chat-collapsible-header"
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed(!collapsed)}
      >
        <span className="vscode-chat-collapsible-toggle">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        {headerIcon && <span className="vscode-chat-collapsible-icon">{headerIcon}</span>}
        <span className="vscode-chat-collapsible-title">{header}</span>
      </div>
      <div className={`vscode-chat-collapsible-content ${collapsed ? 'collapsed' : 'expanded'}`}>
        <div className="vscode-chat-collapsible-body">
          {content}
        </div>
      </div>
    </div>
  );
}
