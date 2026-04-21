/**
 * ChatLayoutService - 聊天布局管理服务
 * 对齐 VS Code chatLayoutService.ts
 *
 * 职责：
 * - 管理 chat widget 的尺寸、位置、可见性
 * - 响应 resize / scroll 事件
 * - 协调各子组件的布局状态
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChatLayoutState {
  width: number;
  height: number;
  isExpanded: boolean;
  isVisible: boolean;
  scrollTop: number;
  scrollHeight: number;
  inputHeight: number;
  listHeight: number;
}

export interface ChatLayoutServiceOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  inputMinHeight?: number;
  inputMaxHeight?: number;
}

const DEFAULT_OPTIONS: Required<ChatLayoutServiceOptions> = {
  defaultWidth: 400,
  defaultHeight: 500,
  minWidth: 300,
  minHeight: 200,
  maxWidth: 800,
  maxHeight: 800,
  inputMinHeight: 38,
  inputMaxHeight: 200,
};

export function useChatLayout(options: ChatLayoutServiceOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const containerRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<ChatLayoutState>({
    width: opts.defaultWidth,
    height: opts.defaultHeight,
    isExpanded: true,
    isVisible: true,
    scrollTop: 0,
    scrollHeight: 0,
    inputHeight: opts.inputMinHeight,
    listHeight: opts.defaultHeight - opts.inputMinHeight,
  });

  // 更新容器尺寸
  const updateContainerSize = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setLayout((prev) => ({
      ...prev,
      width: rect.width,
      height: rect.height,
      listHeight: rect.height - prev.inputHeight,
    }));
  }, []);

  // 监听 resize
  useEffect(() => {
    const ro = new ResizeObserver(() => updateContainerSize());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateContainerSize]);

  // 设置可见性
  const setVisible = useCallback((visible: boolean) => {
    setLayout((prev) => ({ ...prev, isVisible: visible }));
  }, []);

  // 设置展开/折叠
  const setExpanded = useCallback((expanded: boolean) => {
    setLayout((prev) => ({ ...prev, isExpanded: expanded }));
  }, []);

  // 更新输入框高度
  const setInputHeight = useCallback((height: number) => {
    const clamped = Math.min(Math.max(height, opts.inputMinHeight), opts.inputMaxHeight);
    setLayout((prev) => ({
      ...prev,
      inputHeight: clamped,
      listHeight: prev.height - clamped,
    }));
  }, [opts.inputMinHeight, opts.inputMaxHeight]);

  // 更新滚动位置
  const updateScroll = useCallback((scrollTop: number, scrollHeight: number) => {
    setLayout((prev) => ({ ...prev, scrollTop, scrollHeight }));
  }, []);

  return {
    layout,
    containerRef,
    setVisible,
    setExpanded,
    setInputHeight,
    updateScroll,
    updateContainerSize,
  };
}

export default useChatLayout;
