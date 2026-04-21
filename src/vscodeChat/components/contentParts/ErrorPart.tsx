/**
 * ErrorPart - 错误展示内容块
 */
import type { ErrorPartData } from './ContentPart';
import { XCircle } from 'lucide-react';

interface Props extends ErrorPartData {}

export function ErrorPart({ code, message, details }: Props) {
  return (
    <div className="vscode-chat-error-part">
      <div className="vscode-chat-error-icon">
        <XCircle size={16} />
      </div>
      <div className="vscode-chat-error-content">
        {code && <div className="vscode-chat-error-code">Error: {code}</div>}
        <div className="vscode-chat-error-message">{message}</div>
        {details && (
          <pre className="vscode-chat-error-details">
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
