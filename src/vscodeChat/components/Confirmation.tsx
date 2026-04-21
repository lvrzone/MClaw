/**
 * Confirmation - 确认对话框组件
 * 移植自 VS Code Chat chatConfirmation
 */
import { useState, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// 确认选项
interface ConfirmationOption {
  label: string;
  value: string;
}

// Confirmation Props
interface ConfirmationProps {
  message: string;
  options?: ConfirmationOption[];
  onConfirm: (value: string) => void;
  onDismiss?: () => void;
  isWarning?: boolean;
}

// 默认选项
const defaultOptions: ConfirmationOption[] = [
  { label: '是', value: 'yes' },
  { label: '否', value: 'no' },
  { label: '不再提示', value: 'dontAskAgain' },
];

export function Confirmation({
  message,
  options = defaultOptions,
  onConfirm,
  onDismiss,
  isWarning = false,
}: ConfirmationProps) {
  const [selectedValue, setSelectedValue] = useState<string>('');
  
  const handleSelect = useCallback((value: string) => {
    setSelectedValue(value);
    onConfirm(value);
  }, [onConfirm]);
  
  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);
  
  return (
    <div className={`vscode-chat-confirmation ${isWarning ? 'warning' : ''}`}>
      {/* 图标 */}
      <div className="vscode-chat-confirmation-icon">
        {isWarning ? (
          <AlertTriangle size={16} />
        ) : (
          <span className="vscode-chat-confirmation-default-icon">?</span>
        )}
      </div>
      
      {/* 消息 */}
      <div className="vscode-chat-confirmation-message">
        {message}
      </div>
      
      {/* 选项 */}
      <div className="vscode-chat-confirmation-options">
        {options.map((option) => (
          <button
            key={option.value}
            className={`vscode-chat-confirmation-option ${selectedValue === option.value ? 'selected' : ''}`}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
        
        {/* 取消按钮 */}
        {onDismiss && (
          <button
            className="vscode-chat-confirmation-dismiss"
            onClick={handleDismiss}
            title="关闭"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default Confirmation;
