/**
 * TaskPart - 任务进度展示
 * 对齐 VS Code chatTaskContentPart.ts (62行)
 */
import type { TaskPartData, TaskItem } from './ContentPart';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

interface Props extends TaskPartData {}

const statusIcon = (status: TaskItem['status'], size = 14) => {
  switch (status) {
    case 'completed': return <CheckCircle2 size={size} className="vscode-chat-task-icon-done" />;
    case 'in_progress': return <Loader2 size={size} className="vscode-chat-task-icon-progress vscode-spin" />;
    case 'failed': return <XCircle size={size} className="vscode-chat-task-icon-failed" />;
    default: return <Circle size={size} className="vscode-chat-task-icon-pending" />;
  }
};

function TaskItemRow({ item, depth = 0 }: { item: TaskItem; depth?: number }) {
  return (
    <div className="vscode-chat-task-item" data-status={item.status} style={{ paddingLeft: depth * 16 }}>
      {statusIcon(item.status)}
      <span className="vscode-chat-task-label">{item.label}</span>
      {item.progress !== undefined && (
        <span className="vscode-chat-task-progress-text">{item.progress}%</span>
      )}
      {item.description && (
        <span className="vscode-chat-task-desc">{item.description}</span>
      )}
      {item.children?.map((child) => (
        <TaskItemRow key={child.id} item={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function TaskPart({ title, items, isStreaming }: Props) {
  return (
    <div className="vscode-chat-task-part">
      {title && <div className="vscode-chat-task-title">{title}</div>}
      <div className="vscode-chat-task-list">
        {items.map((item) => (
          <TaskItemRow key={item.id} item={item} />
        ))}
      </div>
      {isStreaming && <span className="vscode-chat-streaming-cursor">▊</span>}
    </div>
  );
}
