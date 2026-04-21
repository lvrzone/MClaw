/**
 * AttachmentsPart - 附件展示内容块
 * 对齐 VS Code chatAttachmentsContentPart.ts
 */
import type { AttachmentsPartData, AttachmentItem } from './ContentPart';
import { FileText, Image, File, Download, Eye } from 'lucide-react';

interface Props extends AttachmentsPartData {}

const fileIcon = (item: AttachmentItem) => {
  const ct = item.contentType ?? '';
  if (ct.startsWith('image/')) return <Image size={16} />;
  if (ct.includes('pdf')) return <File size={16} />;
  return <FileText size={16} />;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentCard({ item }: { item: AttachmentItem }) {
  const handleDownload = () => {
    if (item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.name;
      a.click();
    }
  };

  const handlePreview = () => {
    if (item.url) window.open(item.url, '_blank');
  };

  const isImage = item.contentType?.startsWith('image/');

  return (
    <div className="vscode-chat-attachment-card">
      <div className="vscode-chat-attachment-icon">
        {fileIcon(item)}
      </div>
      <div className="vscode-chat-attachment-info">
        <span className="vscode-chat-attachment-name">{item.name}</span>
        {item.size && (
          <span className="vscode-chat-attachment-size">{formatSize(item.size)}</span>
        )}
      </div>
      <div className="vscode-chat-attachment-actions">
        {isImage && item.url && (
          <button className="vscode-chat-attachment-action" onClick={handlePreview} title="预览">
            <Eye size={13} />
          </button>
        )}
        {item.url && (
          <button className="vscode-chat-attachment-action" onClick={handleDownload} title="下载">
            <Download size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AttachmentsPart({ attachments }: Props) {
  if (!attachments.length) return null;

  return (
    <div className="vscode-chat-attachments-part">
      <div className="vscode-chat-attachments-label">附件 ({attachments.length})</div>
      <div className="vscode-chat-attachments-list">
        {attachments.map((item) => (
          <AttachmentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
