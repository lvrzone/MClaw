/**
 * SessionPicker - 快速会话切换器
 * 对齐 VS Code agentSessionsPicker.ts
 */
import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chat';
import { Search, Bot, Users, Clock } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function SessionPicker({ onClose }: Props) {
  const { sessions, sessionLabels, sessionCustomLabels, sessionLastActivity, switchSession } = useChatStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const label = sessionLabels[s.key] || sessionCustomLabels[s.key] || s.displayName || '';
    return label.toLowerCase().includes(search.toLowerCase()) || s.key.includes(search);
  });

  const handleSelect = (key: string) => {
    switchSession(key);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { setSelected((s) => Math.min(s + 1, filtered.length - 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setSelected((s) => Math.max(s - 1, 0)); e.preventDefault(); }
    if (e.key === 'Enter') { if (filtered[selected]) handleSelect(filtered[selected].key); }
    if (e.key === 'Escape') onClose();
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="vscode-chat-session-picker">
      <div className="vscode-chat-session-picker-search">
        <Search size={14} />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(0); }}
          onKeyDown={handleKeyDown}
          placeholder="搜索或选择会话..."
          className="vscode-chat-session-picker-input"
        />
      </div>
      <div className="vscode-chat-session-picker-list">
        {filtered.map((s, idx) => {
          const label = sessionCustomLabels[s.key] || sessionLabels[s.key] || s.displayName || s.key.split(':').pop() || s.key;
          const activity = sessionLastActivity[s.key];
          return (
            <div
              key={s.key}
              className={`vscode-chat-session-picker-item ${idx === selected ? 'selected' : ''}`}
              onClick={() => handleSelect(s.key)}
              onMouseEnter={() => setSelected(idx)}
            >
              <div className="vscode-chat-session-picker-icon">
                {s.isGroupChat ? <Users size={13} /> : <Bot size={13} />}
              </div>
              <div className="vscode-chat-session-picker-info">
                <span className="vscode-chat-session-picker-label">{label}</span>
                {activity && (
                  <span className="vscode-chat-session-picker-time">
                    <Clock size={10} /> {formatTime(activity)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="vscode-chat-session-picker-empty">无匹配会话</div>
        )}
      </div>
    </div>
  );
}
