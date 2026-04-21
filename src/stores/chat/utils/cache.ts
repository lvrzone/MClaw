/**
 * 图片缓存管理工具
 * 管理工具结果中的图片缓存
 */

import { TIME } from '@/constants';
import type { AttachedFileMeta } from '../types';

// 图片数据缓存
interface CacheEntry {
  data: string;
  mimeType: string;
  timestamp: number;
}

const imageDataCache = new Map<string, CacheEntry>();
const imageUrlCache = new Map<string, { url: string; timestamp: number }>();

/**
 * 生成缓存键
 */
export function generateCacheKey(data: string, mimeType: string): string {
  // 使用数据的前100字符 + mimeType 生成简单哈希
  const prefix = data.slice(0, 100);
  return `${mimeType}:${prefix.length}:${prefix}`;
}

/**
 * 获取缓存的图片数据
 */
export function getCachedImageData(
  cacheKey: string
): { data: string; mimeType: string } | null {
  const entry = imageDataCache.get(cacheKey);
  if (!entry) return null;

  // 检查是否过期
  if (Date.now() - entry.timestamp > TIME.IMAGE_CACHE_EXPIRY_MS) {
    imageDataCache.delete(cacheKey);
    return null;
  }

  return { data: entry.data, mimeType: entry.mimeType };
}

/**
 * 缓存图片数据
 */
export function cacheImageData(
  cacheKey: string,
  data: string,
  mimeType: string
): void {
  // 限制缓存大小
  if (imageDataCache.size > 100) {
    // 删除最旧的条目
    const oldestKey = imageDataCache.keys().next().value;
    if (oldestKey) {
      imageDataCache.delete(oldestKey);
    }
  }

  imageDataCache.set(cacheKey, {
    data,
    mimeType,
    timestamp: Date.now(),
  });
}

/**
 * 从工具结果中提取并缓存图片
 */
export function extractAndCacheImages(
  content: unknown
): AttachedFileMeta[] {
  const images: AttachedFileMeta[] = [];

  if (!content || typeof content !== 'object') return images;

  const contentArray = Array.isArray(content) ? content : [content];

  for (const item of contentArray) {
    if (!item || typeof item !== 'object') continue;

    const block = item as Record<string, unknown>;
    const blockSource = block.source as Record<string, unknown> | undefined;

    // 检查是否为图片类型
    if (block.type === 'image' || block.mimeType?.toString().startsWith('image/')) {
      const imageData = block.data || blockSource?.data;
      const mimeType =
        block.mimeType || blockSource?.media_type || 'image/png';

      if (typeof imageData === 'string') {
        const cacheKey = generateCacheKey(imageData, mimeType as string);
        cacheImageData(cacheKey, imageData, mimeType as string);

        images.push({
          fileName: `image-${Date.now()}.png`,
          mimeType: mimeType as string,
          fileSize: Math.ceil(imageData.length * 0.75), // Base64 估算
          preview: `data:${mimeType};base64,${imageData}`,
          source: 'tool-result',
        });
      }
    }
  }

  return images;
}

/**
 * 创建图片URL（带缓存）
 */
export function createImageUrl(
  data: string,
  mimeType: string
): string {
  const cacheKey = generateCacheKey(data, mimeType);

  // 检查URL缓存
  const urlCache = imageUrlCache.get(cacheKey);
  if (urlCache && Date.now() - urlCache.timestamp < TIME.IMAGE_URL_CACHE_EXPIRY_MS) {
    return urlCache.url;
  }

  // 创建新的Blob URL
  try {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 缓存URL
    imageUrlCache.set(cacheKey, { url, timestamp: Date.now() });

    return url;
  } catch (error) {
    console.error('Failed to create image URL:', error);
    return `data:${mimeType};base64,${data}`;
  }
}

/**
 * 清理过期的URL缓存
 */
export function cleanupImageUrlCache(): void {
  const now = Date.now();
  for (const [key, entry] of imageUrlCache.entries()) {
    if (now - entry.timestamp > TIME.IMAGE_URL_CACHE_EXPIRY_MS) {
      URL.revokeObjectURL(entry.url);
      imageUrlCache.delete(key);
    }
  }
}

/**
 * 清除所有图片缓存
 */
export function clearImageCache(): void {
  // 释放所有Blob URL
  for (const entry of imageUrlCache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  imageUrlCache.clear();
  imageDataCache.clear();
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  dataCacheSize: number;
  urlCacheSize: number;
} {
  return {
    dataCacheSize: imageDataCache.size,
    urlCacheSize: imageUrlCache.size,
  };
}
