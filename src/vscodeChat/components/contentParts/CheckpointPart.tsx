/**
 * CheckpointPart - 检查点标记
 */
import type { CheckpointPartData } from './ContentPart';
import { Flag } from 'lucide-react';

interface Props extends CheckpointPartData {}

export function CheckpointPart({ title, timestamp }: Props) {
  const time = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="vscode-chat-checkpoint-part">
      <Flag size={12} />
      <span className="vscode-chat-checkpoint-title">{title}</span>
      <span className="vscode-chat-checkpoint-time">{time}</span>
    </div>
  );
}
