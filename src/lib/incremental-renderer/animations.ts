import type { IIncrementalRenderingAnimation } from './types';

/**
 * FadeAnimation - 渐显动画
 * 新元素从 opacity 0 渐变到 1
 */
export class FadeAnimation implements IIncrementalRenderingAnimation {
  private static readonly DURATION = 200; // 动画持续时间 ms

  apply(element: HTMLElement, isNewChild: boolean): void {
    if (!isNewChild) return;

    // 设置初始状态
    element.style.opacity = '0';
    element.style.transition = `opacity ${FadeAnimation.DURATION}ms ease-in-out`;

    // 强制重排，确保初始状态生效
    void element.offsetHeight;

    // 应用最终状态
    requestAnimationFrame(() => {
      element.style.opacity = '1';
    });
  }

  reset(): void {
    // FadeAnimation 不需要重置状态
  }

  dispose(): void {
    // FadeAnimation 不需要清理资源
  }
}

/**
 * SlideAnimation - 滑入动画
 * 新元素从下方滑入
 */
export class SlideAnimation implements IIncrementalRenderingAnimation {
  private static readonly DURATION = 200; // 动画持续时间 ms
  private static readonly SLIDE_DISTANCE = '10px'; // 滑动距离

  apply(element: HTMLElement, isNewChild: boolean): void {
    if (!isNewChild) return;

    // 设置初始状态
    element.style.opacity = '0';
    element.style.transform = `translateY(${SlideAnimation.SLIDE_DISTANCE})`;
    element.style.transition = `opacity ${SlideAnimation.DURATION}ms ease-out, transform ${SlideAnimation.DURATION}ms ease-out`;

    // 强制重排，确保初始状态生效
    void element.offsetHeight;

    // 应用最终状态
    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  reset(): void {
    // SlideAnimation 不需要重置状态
  }

  dispose(): void {
    // SlideAnimation 不需要清理资源
  }
}

/**
 * NoneAnimation - 无动画
 * 空操作实现
 */
export class NoneAnimation implements IIncrementalRenderingAnimation {
  apply(_element: HTMLElement, _isNewChild: boolean): void {
    // 无操作
  }

  reset(): void {
    // 无操作
  }

  dispose(): void {
    // 无操作
  }
}

/**
 * 创建动画实例的工厂函数
 */
export function createAnimation(style: 'fade' | 'slide' | 'none'): IIncrementalRenderingAnimation {
  switch (style) {
    case 'fade':
      return new FadeAnimation();
    case 'slide':
      return new SlideAnimation();
    case 'none':
    default:
      return new NoneAnimation();
  }
}
