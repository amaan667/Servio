'use client';

import { useState, useEffect, useRef } from 'react';
import { usePdfOverlay, PdfOverlayItem } from '@/hooks/usePdfOverlay';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

// Lazy-load pdfjs worker for smaller bundle
let pdfjs: typeof import('pdfjs-dist');
let workerInitialized = false;

async function initPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist');
    await import('pdfjs-dist/build/pdf.worker.entry');
    
    if (!workerInitialized) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      workerInitialized = true;
    }
  }
  return pdfjs;
}

export interface PdfMenuProps {
  src: string | ArrayBuffer; // public URL or binary data
  items?: PdfOverlayItem[];
  scale?: number; // default 1.5
  onItemClick?: (id: string) => void;
  debug?: boolean; // show hitbox outlines if true
  className?: string;
}

export function PdfMenu({
  src,
  items = [],
  scale = 1.5,
  onItemClick,
  debug = false,
  className = '',
}: PdfMenuProps) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pages, getItemStyle, updatePageDimensions } = usePdfOverlay(
    numPages,
    scale
  );

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        // Lazy-load pdfjs
        const pdfjsLib = await initPdfJs();

        let loadingTask;

        // Handle both URL and ArrayBuffer sources
        if (typeof src === 'string') {
          // For URLs with potential CORS issues, fetch and convert to ArrayBuffer
          try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          } catch (fetchError) {
            // Fallback to direct URL loading
            loadingTask = pdfjsLib.getDocument(src);
          }
        } else {
          loadingTask = pdfjsLib.getDocument({ data: src });
        }

        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);

        // Render all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          await renderPage(page, pageNum - 1);
        }

        setLoading(false);
      } catch (err) {
        console.error('[PDF MENU] Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPdf();
  }, [src, scale]);

  // Render a single page to canvas
  const renderPage = async (page: any, pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;

    const viewport = page.getViewport({ scale: 1 });
    const scaledViewport = page.getViewport({ scale });

    // Set canvas dimensions
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Store original dimensions
    updatePageDimensions(pageIndex, {
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      renderedWidth: scaledViewport.width,
      renderedHeight: scaledViewport.height,
    });

    // Render page to canvas
    const context = canvas.getContext('2d');
    if (!context) return;

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  };

  // Handle item click
  const handleItemClick = (item: PdfOverlayItem) => {
    if (onItemClick) {
      onItemClick(item.id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-2">Error loading PDF</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {Array(numPages)
        .fill(null)
        .map((_, pageIndex) => {
          const pageItems = items.filter((item) => item.page === pageIndex);

          return (
            <div key={pageIndex} className="relative mb-4">
              {/* PDF Canvas */}
              <canvas
                ref={(el) => (canvasRefs.current[pageIndex] = el)}
                className="w-full h-auto border border-gray-200 rounded-lg shadow-sm"
              />

              {/* Overlay Items */}
              {pageItems.map((item) => {
                const style = getItemStyle(item);

                return (
                  <div
                    key={item.id}
                    className="absolute cursor-pointer transition-all duration-200 hover:scale-105"
                    style={{
                      ...style,
                      ...(debug && {
                        border: '2px solid red',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                      }),
                    }}
                    onClick={() => handleItemClick(item)}
                    title={item.name || `Item ${item.id}`}
                  >
                    {debug && (
                      <div className="text-xs bg-red-500 text-white px-1 py-0.5 rounded">
                        {item.id}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

/**
 * PdfMenuWithCart - Enhanced version with cart functionality
 * Shows +/- buttons for items already in cart
 */
export interface PdfMenuWithCartProps extends PdfMenuProps {
  cart?: Array<{ id: string; quantity: number }>;
  onAddToCart?: (item: PdfOverlayItem) => void;
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
}

export function PdfMenuWithCart({
  src,
  items = [],
  scale = 1.5,
  cart = [],
  onAddToCart,
  onUpdateQuantity,
  debug = false,
  className = '',
}: PdfMenuWithCartProps) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pages, getItemStyle, updatePageDimensions } = usePdfOverlay(
    numPages,
    scale
  );

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        // Lazy-load pdfjs
        const pdfjsLib = await initPdfJs();

        let loadingTask;

        if (typeof src === 'string') {
          try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          } catch (fetchError) {
            loadingTask = pdfjsLib.getDocument(src);
          }
        } else {
          loadingTask = pdfjsLib.getDocument({ data: src });
        }

        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          await renderPage(page, pageNum - 1);
        }

        setLoading(false);
      } catch (err) {
        console.error('[PDF MENU] Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPdf();
  }, [src, scale]);

  const renderPage = async (page: pdfjs.PDFPageProxy, pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;

    const viewport = page.getViewport({ scale: 1 });
    const scaledViewport = page.getViewport({ scale });

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    updatePageDimensions(pageIndex, {
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      renderedWidth: scaledViewport.width,
      renderedHeight: scaledViewport.height,
    });

    const context = canvas.getContext('2d');
    if (!context) return;

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  };

  const handleAddToCart = (item: PdfOverlayItem) => {
    if (onAddToCart) {
      onAddToCart(item);
    }
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const cartItem = cart.find((c) => c.id === itemId);
    const currentQty = cartItem?.quantity || 0;
    const newQty = Math.max(0, currentQty + delta);

    if (onUpdateQuantity) {
      onUpdateQuantity(itemId, newQty);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-2">Error loading PDF</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {Array(numPages)
        .fill(null)
        .map((_, pageIndex) => {
          const pageItems = items.filter((item) => item.page === pageIndex);

          return (
            <div key={pageIndex} className="relative mb-4">
              {/* PDF Canvas */}
              <canvas
                ref={(el) => (canvasRefs.current[pageIndex] = el)}
                className="w-full h-auto border border-gray-200 rounded-lg shadow-sm"
              />

              {/* Overlay Items with Cart Controls */}
              {pageItems.map((item) => {
                const style = getItemStyle(item);
                const cartItem = cart.find((c) => c.id === item.id);
                const quantity = cartItem?.quantity || 0;

                return (
                  <div
                    key={item.id}
                    className="absolute transition-all duration-200"
                    style={{
                      ...style,
                      ...(debug && {
                        border: '2px solid red',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                      }),
                    }}
                  >
                    {quantity === 0 ? (
                      <Button
                        size="sm"
                        className="w-full h-full bg-primary/90 hover:bg-primary text-white shadow-lg"
                        onClick={() => handleAddToCart(item)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {item.name || 'Add'}
                      </Button>
                    ) : (
                      <div className="bg-white rounded-md shadow-lg border-2 border-primary p-1.5 flex items-center gap-1.5 h-full">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, -1);
                          }}
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-bold text-primary min-w-[20px] text-center">
                          {quantity}
                        </span>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, 1);
                          }}
                          size="sm"
                          className="h-7 w-7 p-0 bg-primary hover:bg-primary/90"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

