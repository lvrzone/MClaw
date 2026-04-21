/**
 * ChatAttachments - 附件显示组件
 * 移植自 VS Code Chat attachments
 */
import { useCallback } from 'react';
import { FileText, Image, File, X, Link } from 'lucide-react';

// 附件类型
export type AttachmentType = 'file' | 'image' | 'link' | 'text';

// 附件项
export interface Attachment {
  id: string;
  type: AttachmentType;
  name?: string;
  uri?: string;
  content?: string;
  size?: number;
}

// AttachmentItem Props
interface AttachmentItemProps {
  attachment: Attachment;
  onRemove?: (id: string) => void;
  onClick?: (attachment: Attachment) => void;
}

// 获取文件图标
function getFileIcon(type: AttachmentType, name?: string): React.ReactNode {
  if (type === 'image') {
    return <Image size={14} />;
  }
  if (type === 'link') {
    return <Link size={14} />;
  }
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext || '')) {
      return <FileText size={14} />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext || '')) {
      return <Image size={14} />;
    }
  }
  return <File size={14} />;
}

// 格式化文件大小
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// AttachmentItem 组件
function AttachmentItem({ attachment, onRemove, onClick }: AttachmentItemProps) {
  const handleClick = useCallback(() => {
    onClick?.(attachment);
  }, [attachment, onClick]);
  
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(attachment.id);
  }, [attachment.id, onRemove]);
  
  return (
    <div 
      className="vscode-chat-attachment-item"
      onClick={handleClick}
    >
      <span className="vscode-chat-attachment-icon">
        {getFileIcon(attachment.type, attachment.name)}
      </span>
      
      <span className="vscode-chat-attachment-name">
        {attachment.name || (attachment.type === 'link' ? attachment.uri : '文件')}
      </span>
      
      {attachment.size && (
        <span className="vscode-chat-attachment-size">
          {formatSize(attachment.size)}
        </span>
      )}
      
      {onRemove && (
        <button 
          className="vscode-chat-attachment-remove"
          onClick={handleRemove}
          title="移除"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ChatAttachments Props
interface ChatAttachmentsProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  onClick?: (attachment: Attachment) => void;
  maxDisplay?: number;
  className?: string;
}

// ChatAttachments 组件
export function ChatAttachments({
  attachments,
  onRemove,
  onClick,
  maxDisplay = 5,
  className = '',
}: ChatAttachmentsProps) {
  if (!attachments.length) return null;
  
  const displayAttachments = attachments.slice(0, maxDisplay);
  const remainingCount = attachments.length - maxDisplay;
  
  return (
    <div className={`vscode-chat-attachments ${className}`}>
      <div className="vscode-chat-attachments-header">
        <span className="vscode-chat-attachments-count">
          {attachments.length} 个附件
        </span>
      </div>
      
      <div className="vscode-chat-attachments-list">
        {displayAttachments.map(attachment => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
            onClick={onClick}
          />
        ))}
        
        {remainingCount > 0 && (
          <div className="vscode-chat-attachment-more">
            +{remainingCount} 更多
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatAttachments;
