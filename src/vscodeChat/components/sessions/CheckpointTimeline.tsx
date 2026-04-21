/**
 * CheckpointTimeline - 版本历史时间线组件
 * 对齐 VS Code Chat 的版本历史功能
 */
import { useState, useCallback } from 'react';
import { Clock, RotateCcw, Plus } from 'lucide-react';
import { useChatStore } from '@/stores/chat';

interface Props {
  onClose: () => void;
}

export function CheckpointTimeline({ onClose }: Props) {
  const checkpoints = useChatStore((s) => s.checkpoints);
  const currentCheckpointId = useChatStore((s) => s.currentCheckpointId);
  const createCheckpoint = useChatStore((s) => s.createCheckpoint);
  const restoreCheckpoint = useChatStore((s) => s.restoreCheckpoint);

  const [newLabel, setNewLabel] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = useCallback(() => {
    if (newLabel.trim()) {
      createCheckpoint(newLabel.trim());
      setNewLabel('');
      setShowCreate(false);
    }
  }, [newLabel, createCheckpoint]);

  const handleRestore = useCallback((id: string) => {
    restoreCheckpoint(id);
    onClose();
  }, [restoreCheckpoint, onClose]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="vscode-chat-timeline-overlay" onClick={onClose}>
      <div className="vscode-chat-timeline-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vscode-chat-timeline-header">
          <div className="vscode-chat-timeline-title">
            <Clock size={16} />
            <span>版本历史</span>
          </div>
          <button className="vscode-chat-timeline-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Create new checkpoint */}
        <div className="vscode-chat-timeline-create">
          {showCreate ? (
            <div className="vscode-chat-timeline-create-form">
              <input
                type="text"
                className="vscode-chat-timeline-input"
                placeholder="输入版本名称..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button className="vscode-chat-timeline-btn primary" onClick={handleCreate}>
                创建
              </button>
              <button className="vscode-chat-timeline-btn" onClick={() => setShowCreate(false)}>
                取消
              </button>
            </div>
          ) : (
            <button className="vscode-chat-timeline-new-btn" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              <span>创建新版本</span>
            </button>
          )}
        </div>

        {/* Timeline list */}
        <div className="vscode-chat-timeline-list">
          {checkpoints.length === 0 ? (
            <div className="vscode-chat-timeline-empty">
              <Clock size={24} />
              <span>暂无版本历史</span>
              <span className="vscode-chat-timeline-empty-hint">创建第一个版本以保存当前状态</span>
            </div>
          ) : (
            [...checkpoints].reverse().map((checkpoint, index) => (
              <div
                key={checkpoint.id}
                className={`vscode-chat-timeline-item ${checkpoint.id === currentCheckpointId ? 'current' : ''}`}
              >
                <div className="vscode-chat-timeline-marker">
                  <div className="vscode-chat-timeline-dot" />
                  {index < checkpoints.length - 1 && <div className="vscode-chat-timeline-line" />}
                </div>
                <div className="vscode-chat-timeline-content">
                  <div className="vscode-chat-timeline-label">{checkpoint.label}</div>
                  <div className="vscode-chat-timeline-time">{formatTime(checkpoint.timestamp)}</div>
                </div>
                <button
                  className="vscode-chat-timeline-restore"
                  onClick={() => handleRestore(checkpoint.id)}
                  title="恢复到此版本"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckpointTimeline;
