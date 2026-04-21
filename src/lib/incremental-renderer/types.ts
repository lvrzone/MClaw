/**
 * Incremental Rendering Types
 * 增量流式渲染核心接口定义
 */

/**
 * Buffer 模式名称
 * - word: 按词分割，攒满一个完整词才输出
 * - paragraph: 按段落分割，攒满一个完整段落才输出
 */
export type BufferModeName = 'word' | 'paragraph';

/**
 * 动画样式名称
 * - fade: 渐显动画
 * - slide: 滑入动画
 * - none: 无动画
 */
export type AnimationStyleName = 'fade' | 'slide' | 'none';

/**
 * 增量渲染 Buffer 接口
 * 用于缓存和分批输出文本内容
 */
export interface IIncrementalRenderingBuffer {
  /**
   * 追加文本到 buffer
   * @param text 新追加的文本
   * @returns 当前可输出的完整内容（按 buffer 模式分割后）
   */
  append(text: string): string;

  /**
   * 刷新 buffer，输出所有 pending 内容
   * @returns buffer 中剩余的所有内容
   */
  flush(): string;

  /**
   * 重置 buffer，清空所有 pending 内容
   */
  reset(): void;

  /**
   * 获取 buffer 中待处理的内容
   * @returns pending 内容
   */
  getPending(): string;

  /**
   * 检查 buffer 中是否有待处理内容
   * @returns 是否有内容
   */
  hasContent(): boolean;
}

/**
 * 增量渲染动画接口
 * 用于对新渲染的 DOM 节点应用动画效果
 */
export interface IIncrementalRenderingAnimation {
  /**
   * 应用动画到元素
   * @param element 目标 DOM 元素
   * @param isNewChild 是否是新添加的子元素
   */
  apply(element: HTMLElement, isNewChild: boolean): void;

  /**
   * 重置动画状态
   */
  reset(): void;

  /**
   * 销毁动画，清理资源
   */
  dispose(): void;
}
