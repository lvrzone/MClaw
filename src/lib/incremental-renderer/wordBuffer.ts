import type { IIncrementalRenderingBuffer } from './types';

/**
 * WordBuffer - 按词分割的 Buffer 实现
 * 按空格/换行分词，攒满一个完整词才输出
 */
export class WordBuffer implements IIncrementalRenderingBuffer {
  private pending: string = '';

  /**
   * 追加文本到 buffer
   * 按空格和换行分割，返回完整的词
   */
  append(text: string): string {
    this.pending += text;
    return this.extractCompleteWords();
  }

  /**
   * 提取完整的词
   * 从 pending 中提取以空格或换行结尾的完整词
   */
  private extractCompleteWords(): string {
    // 找到最后一个分隔符（空格或换行）的位置
    const lastSeparatorIndex = this.findLastSeparatorIndex(this.pending);
    
    if (lastSeparatorIndex === -1) {
      // 没有完整词，返回空
      return '';
    }

    // 提取完整的部分
    const complete = this.pending.substring(0, lastSeparatorIndex + 1);
    // 剩余部分保留在 pending 中
    this.pending = this.pending.substring(lastSeparatorIndex + 1);
    
    return complete;
  }

  /**
   * 找到最后一个分隔符的位置
   * 分隔符包括：空格、制表符、换行符
   */
  private findLastSeparatorIndex(text: string): number {
    for (let i = text.length - 1; i >= 0; i--) {
      const char = text[i];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        return i;
      }
    }
    return -1;
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
