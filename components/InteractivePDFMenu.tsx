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

      // Fetch PDF images from menu_uploads
      const { data: uploadData, error: uploadError } = await supabase
        .from('menu_uploads')
        .select('pdf_images, pdf_images_cc')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (uploadError || !uploadData) {
        setError('No PDF menu found. Please upload a menu first.');
        setLoading(false);
        return;
      }

      const pdfImages = uploadData.pdf_images || uploadData.pdf_images_cc || [];
      
      if (pdfImages.length === 0) {
        setError('No PDF images found. Please upload a PDF menu.');
        setLoading(false);
        return;
      }

      // Fetch existing menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (itemsError) {
        throw new Error(`Failed to fetch items: ${itemsError.message}`);
      }

      if (!itemsData || itemsData.length === 0) {
        setError('No menu items found.');
        setLoading(false);
        return;
      }

      // Group items by page (distribute evenly across pages)
      const itemsPerPage = Math.ceil(itemsData.length / pdfImages.length);
      const pagesMap = new Map<number, PageData>();

      pdfImages.forEach((imageUrl: string, index: number) => {
        const pageNumber = index + 1;
        const startIdx = index * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, itemsData.length);
        const pageItems = itemsData.slice(startIdx, endIdx);

        pagesMap.set(pageNumber, {
          page_number: pageNumber,
          width: 800,
          height: 1000,
          image_url: imageUrl,
          items: pageItems
        });
      });

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
    return (
      <div key={page.page_number} className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PDF Page Image */}
          <div className="lg:sticky lg:top-4 h-fit">
            <img 
              src={page.image_url} 
              alt={`Menu Page ${page.page_number}`}
              className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
            />
          </div>

          {/* Menu Items List */}
          <div className="space-y-4">
            {page.items.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const quantity = cartItem?.quantity || 0;
              const isHovered = hoveredItem === item.id;
              const price = (item.price / 100).toFixed(2);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                    <p className="text-lg font-bold text-purple-600 mt-2">£{price}</p>
                  </div>

                  <div className="ml-4">
                    {quantity === 0 ? (
                      <Button
                        onClick={() => {
                          const menuItem = {
                            id: item.id,
                            name: item.name,
                            description: item.description,
                            price: item.price / 100,
                            category: item.category || 'UNCATEGORIZED',
                            is_available: item.is_available
                          };
                          onAddToCart(menuItem);
                        }}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 bg-purple-50 rounded-lg p-2 border-2 border-purple-600">
                        <Button
                          onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-purple-300 hover:border-purple-600"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold text-purple-700 min-w-[24px] text-center">
                          {quantity}
                        </span>
                        <Button
                          onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                          size="sm"
                          className="h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

