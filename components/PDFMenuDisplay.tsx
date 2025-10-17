'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart } from 'lucide-react';

interface PDFMenuDisplayProps {
  venueId: string;
  menuItems: any[];
  categoryOrder: string[] | null;
  onAddToCart: (item: any) => void;
  cart: Array<{ id: string; quantity: number }>;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  isOrdering?: boolean; // If true, show ordering functionality
}

interface MenuItemOverlay {
  itemId: string;
  itemName: string;
  itemPrice: number;
  x: number; // Position on image (0-100%)
  y: number; // Position on image (0-100%)
  pageIndex: number; // Which PDF page
}

export function PDFMenuDisplay({
  venueId,
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart,
  onUpdateQuantity,
  isOrdering = false
}: PDFMenuDisplayProps) {
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const fetchPDFImages = async () => {
      try {
        const supabase = createClient();
        
        // Fetch the most recent PDF upload for this venue
        const { data: uploadData, error } = await supabase
          .from('menu_uploads')
          .select('pdf_images, filename, created_at')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log('[PDF MENU DISPLAY] Fetch result:', { 
          hasData: !!uploadData, 
          hasPdfImages: !!(uploadData?.pdf_images), 
          pdfImagesLength: uploadData?.pdf_images?.length || 0,
          filename: uploadData?.filename,
          error: error?.message 
        });

        if (uploadData && uploadData.pdf_images && uploadData.pdf_images.length > 0) {
          console.log('[PDF MENU DISPLAY] Setting PDF images:', uploadData.pdf_images.length);
          setPdfImages(uploadData.pdf_images);
        } else {
          console.warn('[PDF MENU DISPLAY] No PDF images found in upload data');
        }
      } catch (error) {
        console.error('[PDF MENU DISPLAY] Error fetching PDF images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPDFImages();
  }, [venueId]);

  // Generate overlays for menu items
  const generateOverlays = (): MenuItemOverlay[] => {
    if (!isOrdering || menuItems.length === 0) return [];
    
    // Distribute items across pages
    const itemsPerPage = Math.ceil(menuItems.length / pdfImages.length);
    const overlays: MenuItemOverlay[] = [];
    
    menuItems.forEach((item, index) => {
      const pageIndex = Math.floor(index / itemsPerPage);
      const itemIndexOnPage = index % itemsPerPage;
      
      // Calculate position (distribute vertically on the page)
      const y = 20 + (itemIndexOnPage * 8); // Start at 20%, space items 8% apart
      const x = 85; // Position on the right side (85% from left)
      
      overlays.push({
        itemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        x,
        y,
        pageIndex
      });
    });
    
    return overlays;
  };

  const overlays = generateOverlays();

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading PDF menu...</div>;
  }

  if (pdfImages.length === 0) {
    // Fallback to text-based menu if no PDF images
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No PDF menu images available</p>
        <p className="text-sm text-gray-500 mb-4">Upload a PDF menu to see the visual menu</p>
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/menu/reconvert-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ venueId })
              });
              const result = await response.json();
              if (result.ok) {
                alert('PDF images regenerated! Please refresh the page.');
                window.location.reload();
              } else {
                alert('Failed to regenerate PDF images: ' + result.error);
              }
            } catch (error) {
              alert('Error regenerating PDF images');
            }
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Regenerate PDF Images
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pdfImages.map((imageUrl, index) => {
        const pageOverlays = overlays.filter(o => o.pageIndex === index);
        
        return (
          <div 
            key={index} 
            className="relative group"
            ref={(el) => { imageRefs.current[index] = el; }}
          >
            {/* PDF Page Image */}
            <img 
              src={imageUrl} 
              alt={`Menu Page ${index + 1}`}
              className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
            />
            
            {/* Interactive Overlays for Ordering - Positioned to blend with PDF */}
            {isOrdering && pageOverlays.map((overlay) => {
              const cartItem = cart.find(c => c.id === overlay.itemId);
              const quantity = cartItem?.quantity || 0;
              const isHovered = hoveredItem === overlay.itemId;
              
              return (
                <div
                  key={overlay.itemId}
                  className="absolute transition-all duration-200"
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isHovered ? 30 : 10
                  }}
                  onMouseEnter={() => setHoveredItem(overlay.itemId)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Add to Cart Button / Quantity Controls */}
                  {quantity === 0 ? (
                    <Button
                      onClick={() => {
                        const item = menuItems.find(i => i.id === overlay.itemId);
                        if (item) onAddToCart(item);
                      }}
                      size="sm"
                      className="bg-white hover:bg-purple-50 text-purple-700 border-2 border-purple-600 shadow-md hover:shadow-lg transition-all font-semibold"
                      style={{
                        opacity: isHovered ? 1 : 0.85,
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  ) : (
                    <div 
                      className="bg-white rounded-md shadow-lg border-2 border-purple-600 p-1.5 flex items-center gap-1.5"
                      style={{
                        opacity: isHovered ? 1 : 0.95,
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      <Button
                        onClick={() => onUpdateQuantity(overlay.itemId, quantity - 1)}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 border-purple-300 hover:border-purple-600 hover:bg-purple-50"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-bold text-purple-700 min-w-[20px] text-center">
                        {quantity}
                      </span>
                      <Button
                        onClick={() => onUpdateQuantity(overlay.itemId, quantity + 1)}
                        size="sm"
                        className="h-7 w-7 p-0 bg-purple-600 hover:bg-purple-700"
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

