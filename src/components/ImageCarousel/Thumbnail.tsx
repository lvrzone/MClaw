import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ThumbnailProps {
  src: string;
  index: number;
  isActive: boolean;
  onClick: (index: number) => void;
  alt?: string;
}

export const Thumbnail = memo(function Thumbnail({
  src,
  index,
  isActive,
  onClick,
  alt = 'Thumbnail',
}: ThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback(() => {
    onClick(index);
  }, [onClick, index]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden',
        'transition-all duration-200 ease-out',
        'border-2 hover:border-primary/50',
        isActive
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-transparent opacity-60 hover:opacity-100',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
      )}
      aria-label={`View image ${index + 1}`}
      aria-current={isActive ? 'true' : 'false'}
    >
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={`${alt} thumbnail ${index + 1}`}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
        />
      )}
      {!isInView && (
        <div className="w-full h-full bg-muted" />
      )}
    </button>
  );
});
