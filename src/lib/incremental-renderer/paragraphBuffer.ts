import type { IIncrementalRenderingBuffer } from './types';

/**
 * ParagraphBuffer - 按段落分割的 Buffer 实现
 * 按双换行分割，攒满一个完整段落才输出
 */
export class ParagraphBuffer implements IIncrementalRenderingBuffer {
  private pending: string = '';

  /**
   * 追加文本到 buffer
   * 按双换行分割，返回完整的段落
   */
  append(text: string): string {
    this.pending += text;
    return this.extractCompleteParagraphs();
  }

  /**
   * 提取完整的段落
   * 从 pending 中提取以双换行结尾的完整段落
   */
  private extractCompleteParagraphs(): string {
    // 段落分隔符：\n\n 或 \r\n\r\n
    const doubleNewlinePatterns = ['\n\n', '\r\n\r\n'];
    
    let lastEndIndex = -1;
    
    for (const pattern of doubleNewlinePatterns) {
      let searchPos = 0;
      while (true) {
        const index = this.pending.indexOf(pattern, searchPos);
        if (index === -1) break;
        // 更新最后一个段落结束位置（包含分隔符）
        const endIndex = index + pattern.length;
        if (endIndex > lastEndIndex) {
          lastEndIndex = endIndex;
        }
        searchPos = endIndex;
      }
    }

    if (lastEndIndex === -1) {
      // 没有完整段落，返回空
      return '';
    }

    // 提取完整的部分
    const complete = this.pending.substring(0, lastEndIndex);
    // 剩余部分保留在 pending 中
    this.pending = this.pending.substring(lastEndIndex);
    
    return complete;
  }

  /**
   * 刷新 buffer，输出所有 pending 内容
   */
  flush(): string {
    const result = this.pending;
    this.pending = '';
    return result;
  }

  /**
   * 重置 buffer，清空 pending
   */
  reset(): void {
    this.pending = '';
  }

  /**
   * 获取 pending 内容
   */
  getPending(): string {
    return this.pending;
  }

  /**
   * 检查是否有 pending 内容
   */
  hasContent(): boolean {
    return this.pending.length > 0;
  }
}
