import { useState, useCallback, RefObject } from 'react';

interface UseImageZoomOptions {
  minScale?: number;
  maxScale?: number;
}

export interface UseImageZoomReturn {
  scale: number;
  offsetX: number;
  offsetY: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  handleWheel: (e: WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleDoubleClick: () => void;
  isDragging: boolean;
}

export function useImageZoom(
  _containerRef: RefObject<HTMLDivElement | null>,
  options: UseImageZoomOptions = {}
): UseImageZoomReturn {
  const { minScale = 0.5, maxScale = 5 } = options;
  
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.2, maxScale));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.2, minScale));
  }, [minScale]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => {
      const newScale = Math.min(Math.max(s * delta, minScale), maxScale);
      return newScale;
    });
  }, [minScale, maxScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    }
  }, [scale, offsetX, offsetY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setOffsetX(e.clientX - dragStart.x);
      setOffsetY(e.clientY - dragStart.y);
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  }, [scale, resetZoom]);

  return {
    scale,
    offsetX,
    offsetY,
    zoomIn,
    zoomOut,
    resetZoom,
    handleWheel: (e: WheelEvent) => handleWheel(e),
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    isDragging,
  };
}
