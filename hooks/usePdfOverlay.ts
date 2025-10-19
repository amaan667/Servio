// PDF Overlay Hook - Manages PDF rendering lifecycle and coordinate scaling
// Handles window resize/re-render scaling for pixel-perfect hitboxes

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PdfOverlayItem {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  priceMinor?: number;
}

export interface PageDimensions {
  originalWidth: number;
  originalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  scaleX: number;
  scaleY: number;
}

export interface UsePdfOverlayReturn {
  pages: PageDimensions[];
  getItemStyle: (item: PdfOverlayItem) => React.CSSProperties;
  updatePageDimensions: (pageIndex: number, dimensions: Partial<PageDimensions>) => void;
  reset: () => void;
}

/**
 * Hook for managing PDF page rendering and overlay coordinate scaling
 * 
 * @param numPages - Number of pages in the PDF
 * @param scale - Initial scale factor (default: 1.5)
 * @returns Object with page dimensions, scaling utilities, and item style calculator
 */
export function usePdfOverlay(
  numPages: number,
  scale: number = 1.5
): UsePdfOverlayReturn {
  const [pages, setPages] = useState<PageDimensions[]>([]);
  const scaleRef = useRef(scale);

  // Initialize pages array
  useEffect(() => {
    setPages(
      Array(numPages)
        .fill(null)
        .map(() => ({
          originalWidth: 0,
          originalHeight: 0,
          renderedWidth: 0,
          renderedHeight: 0,
          scaleX: 1,
          scaleY: 1,
        }))
    );
  }, [numPages]);

  // Update scale ref when scale changes
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  /**
   * Update dimensions for a specific page
   */
  const updatePageDimensions = useCallback(
    (pageIndex: number, dimensions: Partial<PageDimensions>) => {
      setPages((prev) => {
        const updated = [...prev];
        if (updated[pageIndex]) {
          const current = updated[pageIndex];
          updated[pageIndex] = {
            ...current,
            ...dimensions,
          };

          // Recalculate scale factors if both original and rendered dimensions are set
          if (
            updated[pageIndex].originalWidth > 0 &&
            updated[pageIndex].renderedWidth > 0
          ) {
            updated[pageIndex].scaleX =
              updated[pageIndex].renderedWidth / updated[pageIndex].originalWidth;
          }
          if (
            updated[pageIndex].originalHeight > 0 &&
            updated[pageIndex].renderedHeight > 0
          ) {
            updated[pageIndex].scaleY =
              updated[pageIndex].renderedHeight / updated[pageIndex].originalHeight;
          }
        }
        return updated;
      });
    },
    []
  );

  /**
   * Calculate CSS styles for an overlay item based on its bbox and page scaling
   */
  const getItemStyle = useCallback(
    (item: PdfOverlayItem): React.CSSProperties => {
      const page = pages[item.page];
      if (!page || page.originalWidth === 0) {
        // Return hidden style if page not yet loaded
        return { display: 'none' };
      }

      const sx = page.scaleX;
      const sy = page.scaleY;

      return {
        position: 'absolute',
        left: `${item.x * sx}px`,
        top: `${item.y * sy}px`,
        width: `${item.w * sx}px`,
        height: `${item.h * sy}px`,
      };
    },
    [pages]
  );

  /**
   * Reset all page dimensions
   */
  const reset = useCallback(() => {
    setPages(
      Array(numPages)
        .fill(null)
        .map(() => ({
          originalWidth: 0,
          originalHeight: 0,
          renderedWidth: 0,
          renderedHeight: 0,
          scaleX: 1,
          scaleY: 1,
        }))
    );
  }, [numPages]);

  return {
    pages,
    getItemStyle,
    updatePageDimensions,
    reset,
  };
}

/**
 * Utility function to compute scale factors for a page
 * 
 * @param originalWidth - Original page width from PDF
 * @param originalHeight - Original page height from PDF
 * @param renderedWidth - Actual rendered width in pixels
 * @param renderedHeight - Actual rendered height in pixels
 * @returns Object with scaleX and scaleY
 */
export function computePageScale(
  originalWidth: number,
  originalHeight: number,
  renderedWidth: number,
  renderedHeight: number
): { scaleX: number; scaleY: number } {
  return {
    scaleX: renderedWidth / originalWidth,
    scaleY: renderedHeight / originalHeight,
  };
}

/**
 * Utility function to map PDF coordinates to CSS coordinates
 * 
 * @param bbox - Bounding box in PDF coordinates { x, y, w, h }
 * @param scaleX - X-axis scale factor
 * @param scaleY - Y-axis scale factor
 * @returns CSS coordinates
 */
export function mapBboxToCss(
  bbox: { x: number; y: number; w: number; h: number },
  scaleX: number,
  scaleY: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: bbox.x * scaleX,
    top: bbox.y * scaleY,
    width: bbox.w * scaleX,
    height: bbox.h * scaleY,
  };
}

