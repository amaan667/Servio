'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';

interface InteractivePDFMenuProps {
  venueId: string;
  onAddToCart: (item: any) => void;
  cart: Array<{ id: string; quantity: number }>;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_minor: number;
  currency: string;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  page_number: number;
  image_url: string;
  source: string;
  confidence: number;
  category?: string;
  is_available: boolean;
}

interface PageData {
  page_number: number;
  width: number;
  height: number;
  image_url: string;
  items: MenuItem[];
}

export function InteractivePDFMenu({
  venueId,
  onAddToCart,
  cart,
  onUpdateQuantity
}: InteractivePDFMenuProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    fetchMenuData();
  }, [venueId]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Fetch existing menu items with coordinates
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .not('bbox_x', 'is', null) // Only items with coordinates
        .order('page_number', { ascending: true })
        .order('bbox_y', { ascending: false }); // Top to bottom

      if (itemsError) {
        throw new Error(`Failed to fetch items: ${itemsError.message}`);
      }

      if (!itemsData || itemsData.length === 0) {
        setError('No menu items with coordinates found. Please update coordinates first.');
        setLoading(false);
        return;
      }

      // Group items by page and get page images
      const pagesMap = new Map<number, PageData>();
      
      for (const item of itemsData) {
        if (!item.page_number || !item.pdf_image_url) continue;
        
        if (!pagesMap.has(item.page_number)) {
          pagesMap.set(item.page_number, {
            page_number: item.page_number,
            width: 800, // Default, will be calculated from image
            height: 1000, // Default, will be calculated from image
            image_url: item.pdf_image_url,
            items: []
          });
        }
        
        const page = pagesMap.get(item.page_number);
        if (page) {
          page.items.push(item);
        }
      }

      setPages(Array.from(pagesMap.values()));
      console.log(`[InteractivePDFMenu] Loaded ${pages.length} pages with ${itemsData.length} items`);

    } catch (err: any) {
      console.error('[InteractivePDFMenu] Error:', err);
      setError(err.message || 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = (page: PageData, index: number) => {
    const pageRef = pageRefs.current.get(page.page_number);
    const renderedWidth = pageRef?.clientWidth || 800;
    const renderedHeight = (renderedWidth / page.width) * page.height;

    // Calculate scale factors
    const scaleX = renderedWidth / page.width;
    const scaleY = renderedHeight / page.height;

    return (
      <div 
        key={page.page_number}
        ref={(el) => {
          if (el) {
            pageRefs.current.set(page.page_number, el);
          }
        }}
        className="relative mb-8"
      >
        {/* PDF Page Image */}
        <img 
          src={page.image_url} 
          alt={`Menu Page ${page.page_number}`}
          className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
          style={{ maxWidth: '100%' }}
        />

        {/* Interactive Hitboxes */}
        {page.items.map((item) => {
          // Skip unavailable items
          if (!item.is_available) {
            return null;
          }

          const cartItem = cart.find(c => c.id === item.id);
          const quantity = cartItem?.quantity || 0;
          const isHovered = hoveredItem === item.id;

          // Calculate scaled coordinates
          const left = item.bbox_x * scaleX;
          const top = item.bbox_y * scaleY;
          const width = item.bbox_w * scaleX;
          const height = item.bbox_h * scaleY;

          // Position button at the right edge of the item's bounding box
          const buttonLeft = left + width - 80; // 80px for button width
          const buttonTop = top + (height / 2) - 20; // Center vertically

          const price = (item.price_minor / 100).toFixed(2);

          return (
            <div
              key={item.id}
              className="absolute transition-all duration-200"
              style={{
                left: `${buttonLeft}px`,
                top: `${buttonTop}px`,
                zIndex: isHovered ? 30 : 10
              }}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Add to Cart Button / Quantity Controls */}
              {quantity === 0 ? (
                <Button
                  onClick={() => {
                    // Convert to menu item format
                    const menuItem = {
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      price: item.price_minor / 100,
                      category: item.category || 'UNCATEGORIZED',
                      is_available: item.is_available
                    };
                    onAddToCart(menuItem);
                  }}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold min-w-[80px]"
                  style={{
                    opacity: isHovered ? 1 : 0.9,
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)'
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
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <Button
                    onClick={() => onUpdateQuantity(item.id, quantity - 1)}
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
                    onClick={() => onUpdateQuantity(item.id, quantity + 1)}
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
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
        <p className="text-gray-600">Loading interactive menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">Venue ID: {venueId}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No menu pages found</p>
        <p className="text-sm text-gray-500">Upload and parse a PDF menu first</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pages.map((page, index) => renderPage(page, index))}
    </div>
  );
}

