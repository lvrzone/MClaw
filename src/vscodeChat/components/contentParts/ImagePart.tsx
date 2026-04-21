/**
 * ImagePart - 图片展示
 */
import { useState } from 'react';
import type { ImagePartData } from './ContentPart';

interface Props extends ImagePartData {}

export function ImagePart({ source, alt = 'Image' }: Props) {
  const [preview, setPreview] = useState(false);

  const src = source.type === 'base64' ? `data:${source.mediaType};base64,${source.data}` : source.url;

  if (!src) return null;

  return (
    <div className="vscode-chat-image-part">
      <img
        src={src}
        alt={alt}
        className="vscode-chat-image"
        onClick={() => setPreview(true)}
        loading="lazy"
      />
      {preview && (
        <div className="vscode-chat-image-preview-overlay" onClick={() => setPreview(false)}>
          <img src={src} alt={alt} className="vscode-chat-image-preview" />
        </div>
      )}
    </div>
  );
}
