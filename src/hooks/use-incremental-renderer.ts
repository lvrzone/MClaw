import { useEffect, useRef } from 'react';
import { IncrementalRenderer } from '@/lib/incremental-renderer';

export function useIncrementalRenderer(
  containerRef: React.RefObject<HTMLElement | null>,
  options?: { 
    bufferMode?: 'word' | 'paragraph'; 
    animationStyle?: 'fade' | 'slide' | 'none' 
  }
) {
  const rendererRef = useRef<IncrementalRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    rendererRef.current = new IncrementalRenderer(containerRef.current, options);
    return () => rendererRef.current?.dispose();
  }, []);

  const append = (markdown: string) => rendererRef.current?.append(markdown);
  const reset = () => rendererRef.current?.reset();

  return { append, reset };
}
