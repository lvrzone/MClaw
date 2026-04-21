/**
 * ChatModelPicker - 模型选择器组件
 * 移植自 VS Code Chat chatModelPicker
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Check, Bot, Loader2 } from 'lucide-react';

// 模型信息
export interface Model {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  contextLength?: number;
}

// ChatModelPicker Props
interface ChatModelPickerProps {
  models: Model[];
  selectedModel?: string;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
  showDescription?: boolean;
  className?: string;
}

// ChatModelPicker 组件
export function ChatModelPicker({
  models,
  selectedModel,
  onSelect,
  disabled = false,
  showDescription = false,
  className = '',
}: ChatModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 获取当前选中的模型
  const selectedModelData = models.find(m => m.id === selectedModel);
  
  // 过滤模型
  const filteredModels = models.filter(model => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      model.name.toLowerCase().includes(searchLower) ||
      model.id.toLowerCase().includes(searchLower) ||
      model.provider?.toLowerCase().includes(searchLower) ||
      model.description?.toLowerCase().includes(searchLower)
    );
  });
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // 打开时聚焦搜索框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  
  // 切换下拉
  const toggleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
      setSearch('');
    }
  }, [disabled]);
  
  // 选择模型
  const handleSelect = useCallback((modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
    setSearch('');
  }, [onSelect]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    if (e.key === 'Enter' && filteredModels.length > 0) {
      handleSelect(filteredModels[0].id);
    }
  }, [filteredModels, handleSelect]);
  
  return (
    <div 
      ref={containerRef}
      className={`vscode-chat-model-picker ${disabled ? 'disabled' : ''} ${className}`}
    >
      {/* 触发按钮 */}
      <button
        className="vscode-chat-model-picker-trigger"
        onClick={toggleOpen}
        disabled={disabled}
        type="button"
      >
        <Bot size={14} />
        <span className="vscode-chat-model-picker-name">
          {selectedModelData?.name || '选择模型'}
        </span>
        <ChevronDown size={14} className={`vscode-chat-model-picker-arrow ${isOpen ? 'open' : ''}`} />
      </button>
      
      {/* 下拉菜单 */}
      {isOpen && (
        <div className="vscode-chat-model-picker-dropdown">
          {/* 搜索框 */}
          <div className="vscode-chat-model-picker-search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索模型..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          {/* 模型列表 */}
          <div className="vscode-chat-model-picker-list">
            {filteredModels.length === 0 ? (
              <div className="vscode-chat-model-picker-empty">
                <Loader2 size={14} className="vscode-spin" />
                <span>没有找到匹配的模型</span>
              </div>
            ) : (
              filteredModels.map(model => (
                <button
                  key={model.id}
                  className={`vscode-chat-model-picker-item ${model.id === selectedModel ? 'selected' : ''}`}
                  onClick={() => handleSelect(model.id)}
                >
                  <div className="vscode-chat-model-picker-item-content">
                    <span className="vscode-chat-model-picker-item-name">{model.name}</span>
                    {model.provider && (
                      <span className="vscode-chat-model-picker-item-provider">{model.provider}</span>
                    )}
                    {showDescription && model.description && (
                      <span className="vscode-chat-model-picker-item-desc">{model.description}</span>
                    )}
                  </div>
                  {model.id === selectedModel && (
                    <Check size={14} className="vscode-chat-model-picker-item-check" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatModelPicker;
