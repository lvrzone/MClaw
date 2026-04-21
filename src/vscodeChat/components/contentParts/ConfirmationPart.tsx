/**
 * ConfirmationPart - 确认弹窗内容块
 * 对齐 VS Code chatConfirmationContentPart.ts (76行)
 */
import type { ConfirmationPartData } from './ContentPart';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Props extends ConfirmationPartData {}

export function ConfirmationPart({ title, message, options, onConfirm, onCancel }: Props) {
  const handleConfirm = () => onConfirm?.();
  const handleCancel = () => onCancel?.();

  return (
    <div className="vscode-chat-confirmation-part">
      <div className="vscode-chat-confirmation-icon">
        <AlertTriangle size={18} />
      </div>
      <div className="vscode-chat-confirmation-content">
        <div className="vscode-chat-confirmation-title">{title}</div>
        <div className="vscode-chat-confirmation-message">{message}</div>
        {options && options.length > 0 && (
          <div className="vscode-chat-confirmation-options">
            {options.map((opt) => (
              <button
                key={opt.value}
                className="vscode-chat-confirmation-option"
                onClick={() => opt.value === 'confirm' ? handleConfirm() : handleCancel()}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {!options && (
          <div className="vscode-chat-confirmation-actions">
            <button className="vscode-chat-confirmation-confirm" onClick={handleConfirm}>
              <CheckCircle size={13} /> 确认
            </button>
            <button className="vscode-chat-confirmation-cancel" onClick={handleCancel}>
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
