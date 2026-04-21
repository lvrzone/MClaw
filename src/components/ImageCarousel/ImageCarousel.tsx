import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageZoom } from './useImageZoom';
import { Thumbnail } from './Thumbnail';

export interface CarouselImage {
  url?: string;
  data?: string;
  mimeType?: string;
  alt?: string;
  fileName?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  initialIndex?: number;
  onClose: () => void;
}

function getImageSrc(img: CarouselImage): string {
  if (img.url) return img.url;
  if (img.data) return `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`;
  return '';
}

export function ImageCarousel({
  images,
  initialIndex = 0,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentImage = images[currentIndex];
  const imageSrc = getImageSrc(currentImage);

  const {
    scale,
    offsetX,
    offsetY,
    zoomIn,
    zoomOut,
    resetZoom,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    isDragging,
  } = useImageZoom(containerRef, { minScale: 0.5, maxScale: 5 });

  // Reset zoom when changing images
  useEffect(() => {
    resetZoom();
    setIsLoading(true);
  }, [currentIndex, resetZoom]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            resetZoom();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, zoomIn, zoomOut, resetZoom]);

  // Prevent scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStart.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.y;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
    
    setTouchStart(null);
  }, [touchStart, goToPrevious, goToNext]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Wheel zoom on container
  const handleContainerWheel = useCallback((e: React.WheelEvent) => {
    handleWheel(e.nativeEvent as WheelEvent);
  }, [handleWheel]);

  const canDrag = scale > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image carousel"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 5}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-white/20 mx-2" />
          
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onWheel={handleContainerWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Image */}
        <img
          src={imageSrc}
          alt={currentImage.alt || `Image ${currentIndex + 1}`}
          className={cn(
            'max-w-full max-h-full object-contain transition-transform duration-150',
            'select-none'
          )}
          style={{
            transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`,
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-4 bg-black/50 overflow-x-auto">
          {images.map((img, idx) => (
            <Thumbnail
              key={idx}
              src={getImageSrc(img)}
              index={idx}
              isActive={idx === currentIndex}
              onClick={setCurrentIndex}
              alt={img.alt || img.fileName}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ── Context for global carousel ──

interface CarouselContextValue {
  open: (images: CarouselImage[], initialIndex?: number) => void;
  close: () => void;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) {
    throw new Error('useCarousel must be used within a CarouselProvider');
  }
  return context;
}

interface CarouselProviderProps {
  children: React.ReactNode;
}

export function CarouselProvider({ children }: CarouselProviderProps) {
  const [carouselState, setCarouselState] = useState<{
    images: CarouselImage[];
    initialIndex: number;
    isOpen: boolean;
  }>({
    images: [],
    initialIndex: 0,
    isOpen: false,
  });

  const open = useCallback((images: CarouselImage[], initialIndex = 0) => {
    if (images.length === 0) return;
    setCarouselState({
      images,
      initialIndex,
      isOpen: true,
    });
  }, []);

  const close = useCallback(() => {
    setCarouselState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const contextValue = useMemo(() => ({ open, close }), [open, close]);

  return (
    <CarouselContext.Provider value={contextValue}>
      {children}
      {carouselState.isOpen && (
        <ImageCarousel
          images={carouselState.images}
          initialIndex={carouselState.initialIndex}
          onClose={close}
        />
      )}
    </CarouselContext.Provider>
  );
}
