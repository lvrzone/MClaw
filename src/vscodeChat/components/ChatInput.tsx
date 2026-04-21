/**
 * ChatInput - 聊天输入框组件
 * 移植自 VS Code Chat chatInputPart
 */
import { useState, useRef, useCallback, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Square, Plus, Command } from 'lucide-react';

// Slash 命令类型
interface SlashCommand {
  name: string;
  description: string;
}

// 快捷回复选项
interface QuickReply {
  label: string;
  value: string;
}

// ChatInput Props
interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  slashCommands?: SlashCommand[];
  quickReplies?: QuickReply[];
  onQuickReply?: (value: string) => void;
  onSlashCommand?: (command: string) => void;
}

// 主要组件
export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  sending = false,
  placeholder = '输入消息或 / 查看命令...',
  slashCommands = [],
  quickReplies = [],
  onQuickReply,
  onSlashCommand,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);
  
  // 处理输入变化
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // 检查是否显示 slash 菜单
    if (value.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(value.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  }, []);
  
  // 处理发送
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || disabled || sending) return;
    
    onSend(trimmed);
    setInputValue('');
    setShowSlashMenu(false);
    
    // 重新聚焦
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [inputValue, disabled, sending, onSend]);
  
  // 处理停止
  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送 (不带 Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    
    // Escape 关闭菜单
    if (e.key === 'Escape' && showSlashMenu) {
      setShowSlashMenu(false);
      e.preventDefault();
      return;
    }
    
    // 上箭头选择上一个命令
    if (e.key === 'ArrowUp' && showSlashMenu) {
      e.preventDefault();
      const filteredCommands = getFilteredCommands();
      const currentIndex = filteredCommands.findIndex(c => c.name === slashFilter);
      if (currentIndex > 0) {
        setSlashFilter(filteredCommands[currentIndex - 1].name);
      }
      return;
    }
    
    // 下箭头选择下一个命令
    if (e.key === 'ArrowDown' && showSlashMenu) {
      e.preventDefault();
      const filteredCommands = getFilteredCommands();
      const currentIndex = filteredCommands.findIndex(c => c.name === slashFilter);
      if (currentIndex < filteredCommands.length - 1) {
        setSlashFilter(filteredCommands[currentIndex + 1].name);
      }
      return;
    }
    
    // Tab 补全命令
    if (e.key === 'Tab' && showSlashMenu) {
      e.preventDefault();
      const filteredCommands = getFilteredCommands();
      if (filteredCommands.length > 0) {
        setInputValue(`/${filteredCommands[0].name} `);
        setShowSlashMenu(false);
      }
      return;
    }
  }, [handleSend, showSlashMenu, slashFilter]);
  
  // 获取过滤后的命令
  const getFilteredCommands = useCallback(() => {
    if (!slashFilter) return slashCommands;
    return slashCommands.filter(cmd => 
      cmd.name.toLowerCase().includes(slashFilter)
    );
  }, [slashCommands, slashFilter]);
  
  // 处理 slash 命令选择
  const handleSlashCommandSelect = useCallback((command: SlashCommand) => {
    setInputValue(`/${command.name} `);
    setShowSlashMenu(false);
    onSlashCommand?.(command.name);
    textareaRef.current?.focus();
  }, [onSlashCommand]);
  
  // 处理快捷回复
  const handleQuickReplyClick = useCallback((reply: QuickReply) => {
    onQuickReply?.(reply.value);
  }, [onQuickReply]);
  
  // 过滤命令
  const filteredCommands = getFilteredCommands();
  
  return (
    <div className="vscode-chat-input-container">
      {/* Slash 命令菜单 */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div ref={menuRef} className="vscode-chat-slash-menu">
          <div className="vscode-chat-slash-menu-header">
            <Command size={12} />
            <span>命令</span>
          </div>
          <div className="vscode-chat-slash-menu-list">
            {filteredCommands.map(cmd => (
              <button
                key={cmd.name}
                className="vscode-chat-slash-menu-item"
                onClick={() => handleSlashCommandSelect(cmd)}
              >
                <span className="vscode-chat-slash-command-name">/{cmd.name}</span>
                <span className="vscode-chat-slash-command-desc">{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 快捷回复 */}
      {quickReplies.length > 0 && !inputValue && (
        <div className="vscode-chat-quick-replies">
          {quickReplies.map((reply, idx) => (
            <button
              key={idx}
              className="vscode-chat-quick-reply"
              onClick={() => handleQuickReplyClick(reply)}
            >
              {reply.label}
            </button>
          ))}
        </div>
      )}
      
      {/* 输入区域 */}
      <div className={`vscode-chat-input-wrapper ${disabled ? 'disabled' : ''}`}>
        {/* 附件按钮 */}
        <button 
          className="vscode-chat-input-action"
          title="附加文件"
          disabled={disabled}
        >
          <Plus size={18} />
        </button>
        
        {/* 文本输入框 */}
        <textarea
          ref={textareaRef}
          className="vscode-chat-input"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          spellCheck={false}
        />
        
        {/* 发送/停止按钮 */}
        {sending ? (
          <button
            className="vscode-chat-input-action send stop"
            onClick={handleStop}
            title="停止生成"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            className="vscode-chat-input-action send"
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
            title="发送消息"
          >
            <Send size={18} />
          </button>
        )}
      </div>
      
      {/* 底部提示 */}
      <div className="vscode-chat-input-footer">
        <span className="vscode-chat-hint">
          <kbd>Enter</kbd> 发送 · <kbd>Shift+Enter</kbd> 换行 · <kbd>/</kbd> 命令
        </span>
      </div>
    </div>
  );
}

export default ChatInput;
