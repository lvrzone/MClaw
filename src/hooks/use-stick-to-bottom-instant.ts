import { useEffect, useRef, useCallback } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

/**
 * A wrapper around useStickToBottom that ensures the initial scroll
 * to bottom happens instantly without any visible animation.
 * Optimized for 120fps smooth scrolling experience.
 *
 * @param resetKey - When this key changes, the scroll position will be reset to bottom instantly.
 *                   Typically this should be the conversation ID.
 */
export function useStickToBottomInstant(resetKey?: string) {
  const lastKeyRef = useRef(resetKey);
  const hasInitializedRef = useRef(false);
  const rafIdRef = useRef<number>(0);

  const result = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  });

  const { scrollRef } = result;

  // 高性能滚动函数 - 120fps丝滑动效
  const scrollToBottom = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // 取消之前的动画帧
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // 使用 RAF 确保在下一帧执行，获得最佳性能
    rafIdRef.current = requestAnimationFrame(() => {
      const targetScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
      const currentScrollTop = scrollElement.scrollTop;
      const distance = targetScrollTop - currentScrollTop;

      // 如果距离很小，直接滚动
      if (Math.abs(distance) < 5) {
        scrollElement.scrollTop = targetScrollTop;
        return;
      }

      // 使用弹簧缓动曲线 - 模拟真实物理效果
      const springDuration = 280; // 280ms 丝滑过渡
      const startTime = performance.now();
      const startScroll = currentScrollTop;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / springDuration, 1);

        // 弹簧缓动曲线 - 快速启动，平滑停止
        const easeOutExpo = progress === 1
          ? 1
          : 1 - Math.pow(2, -10 * progress);

        scrollElement.scrollTop = startScroll + (distance * easeOutExpo);

        if (progress < 1) {
          rafIdRef.current = requestAnimationFrame(animate);
        }
      };

      rafIdRef.current = requestAnimationFrame(animate);
    });
  }, [scrollRef]);

  // Reset initialization when key changes
  useEffect(() => {
    if (resetKey !== lastKeyRef.current) {
      hasInitializedRef.current = false;
      lastKeyRef.current = resetKey;
    }
  }, [resetKey]);

  // Scroll to bottom instantly on mount or when key changes
  useEffect(() => {
    if (hasInitializedRef.current) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // Hide, scroll, reveal pattern to avoid visible animation
    scrollElement.style.visibility = "hidden";

    // Use double RAF to ensure content is rendered
    const frame1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Direct scroll to bottom
        scrollElement.scrollTop = scrollElement.scrollHeight;

        // Small delay to ensure scroll is applied
        setTimeout(() => {
          scrollElement.style.visibility = "";
          hasInitializedRef.current = true;
        }, 0);
      });
    });

    return () => {
      cancelAnimationFrame(frame1);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [scrollRef, resetKey]);

  return { ...result, scrollToBottom };
}
