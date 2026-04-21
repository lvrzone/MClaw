import type { BufferModeName, AnimationStyleName, IIncrementalRenderingBuffer, IIncrementalRenderingAnimation } from './types';
import { WordBuffer } from './wordBuffer';
import { ParagraphBuffer } from './paragraphBuffer';
import { createAnimation } from './animations';

// 简单的 markdown 渲染器占位
// 实际项目中应该使用如 marked、markdown-it 等库
function renderMarkdownToHTML(markdown: string): string {
  // 这里使用一个简单的实现，实际应该替换为真正的 markdown 渲染器
  let html = markdown;
  
  // 转义 HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 粗体和斜体
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 换行转段落（简单处理）
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // 包装在段落中
  if (!html.startsWith('<h') && !html.startsWith('<pre')) {
    html = '<p>' + html + '</p>';
  }
  
  return html;
}

/**
 * IncrementalRenderer - 增量渲染器核心类
 * 支持流式 markdown 渲染，只更新新增的部分
 */
export class IncrementalRenderer {
  private domNode: HTMLElement;
  private buffer: IIncrementalRenderingBuffer;
  private animation: IIncrementalRenderingAnimation;
  
  private _lastMarkdown: string = '';
  private _renderedMarkdown: string = '';
  private pendingRaf: number | null = null;
  private disposed: boolean = false;

  constructor(
    domNode: HTMLElement,
    options?: {
      bufferMode?: BufferModeName;
      animationStyle?: AnimationStyleName;
    }
  ) {
    this.domNode = domNode;
    
    // 创建 buffer
    const bufferMode = options?.bufferMode ?? 'word';
    this.buffer = this.createBuffer(bufferMode);
    
    // 创建 animation
    const animationStyle = options?.animationStyle ?? 'fade';
    this.animation = createAnimation(animationStyle);
  }

  /**
   * 创建 buffer 实例
   */
  private createBuffer(mode: BufferModeName): IIncrementalRenderingBuffer {
    switch (mode) {
      case 'word':
        return new WordBuffer();
      case 'paragraph':
        return new ParagraphBuffer();
      default:
        return new WordBuffer();
    }
  }

  /**
   * 追加新的 markdown 内容
   */
  append(newMarkdown: string): void {
    if (this.disposed) return;

    // 将新文本追加到 buffer
    const output = this.buffer.append(newMarkdown);
    
    // 如果 buffer 有新内容可输出，调度一个 rAF
    if (output) {
      this.scheduleRender(output);
    }

    // 更新 _lastMarkdown
    this._lastMarkdown += newMarkdown;
  }

  /**
   * 调度渲染
   */
  private scheduleRender(content: string): void {
    if (this.pendingRaf !== null) {
      return; // 已经有待处理的 rAF
    }

    this.pendingRaf = requestAnimationFrame(() => {
      this.pendingRaf = null;
      this.renderContent(content);
    });
  }

  /**
   * 渲染内容
   */
  private renderContent(content: string): void {
    if (this.disposed) return;

    const newFullMarkdown = this._renderedMarkdown + content;
    
    // 检查是否是纯追加
    if (this._renderedMarkdown.length > 0 && newFullMarkdown.startsWith(this._renderedMarkdown)) {
      // 是纯追加：只渲染新增部分
      this.incrementalRender(content);
    } else {
      // 不是纯追加：全量重渲染
      this.fullRender(newFullMarkdown);
    }

    // 更新已渲染的内容
    this._renderedMarkdown = newFullMarkdown;
  }

  /**
   * 增量渲染
   * 只渲染新增的部分，并应用动画
   */
  private incrementalRender(newContent: string): void {
    const html = renderMarkdownToHTML(newContent);
    
    // 创建临时容器
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = html;
    
    // 记录添加前的子节点数量
    const beforeCount = this.domNode.children.length;
    
    // 添加新的子节点
    while (tempContainer.firstChild) {
      this.domNode.appendChild(tempContainer.firstChild);
    }
    
    // 对新增的节点应用动画
    const afterCount = this.domNode.children.length;
    for (let i = beforeCount; i < afterCount; i++) {
      const child = this.domNode.children[i] as HTMLElement;
      this.animation.apply(child, true);
    }
  }

  /**
   * 全量渲染
   */
  private fullRender(markdown: string): void {
    const html = renderMarkdownToHTML(markdown);
    
    // 清空容器
    this.domNode.innerHTML = html;
    
    // 对所有子节点应用动画
    Array.from(this.domNode.children).forEach(child => {
      this.animation.apply(child as HTMLElement, true);
    });
  }

  /**
   * 销毁渲染器
   */
  dispose(): void {
    this.disposed = true;
    
    // 取消待处理的 rAF
    if (this.pendingRaf !== null) {
      cancelAnimationFrame(this.pendingRaf);
      this.pendingRaf = null;
    }
    
    // 销毁动画
    this.animation.dispose();
    
    // 清空状态
    this._lastMarkdown = '';
    this._renderedMarkdown = '';
    this.buffer.reset();
  }

  /**
   * 重置渲染器
   */
  reset(): void {
    // 取消待处理的 rAF
    if (this.pendingRaf !== null) {
      cancelAnimationFrame(this.pendingRaf);
      this.pendingRaf = null;
    }
    
    // 清空状态
    this._lastMarkdown = '';
    this._renderedMarkdown = '';
    this.buffer.reset();
    this.animation.reset();
    
    // 清空 DOM
    this.domNode.innerHTML = '';
  }

  /**
   * 获取已渲染内容的长度
   */
  getRenderedLength(): number {
    return this._renderedMarkdown.length;
  }
}

// 导出类型和类
export { type IIncrementalRenderingBuffer, type IIncrementalRenderingAnimation, type BufferModeName, type AnimationStyleName } from './types';
export { WordBuffer } from './wordBuffer';
export { ParagraphBuffer } from './paragraphBuffer';
export { FadeAnimation, SlideAnimation, NoneAnimation, createAnimation as createAnimationInstance } from './animations';
