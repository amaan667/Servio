'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart, X, Search, List, Grid, ZoomIn, ZoomOut } from 'lucide-react';
import { ItemDetailsModal } from '@/components/ItemDetailsModal';
import { Input } from '@/components/ui/input';
import { formatPriceWithCurrency } from '@/lib/pricing-utils';
import { logger } from '@/lib/logger';

interface MenuItem {
  id: string;
  venue_id?: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at?: string;
  venue_name?: string;
  options?: Array<{ label: string; values: string[] }>;
}

// Type-safe menu item interface for hotspot system

interface EnhancedPDFMenuDisplayProps {
  venueId: string;
  menuItems: MenuItem[];
  categoryOrder: string[] | null;
  onAddToCart: (item: MenuItem) => void;
  cart: Array<{ id: string; quantity: number }>;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  isOrdering?: boolean;
}

interface Hotspot {
  id: string;
  menu_item_id: string;
  page_index: number;
  x_percent: number;
  y_percent: number;
  width_percent?: number;
  height_percent?: number;
}

export function EnhancedPDFMenuDisplay({
  venueId,
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart,
  onUpdateQuantity,
  isOrdering = false
}: EnhancedPDFMenuDisplayProps) {
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'pdf' | 'list'>('pdf');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showStickyCart, setShowStickyCart] = useState(false);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPDFImages = async () => {
      try {
        const supabase = createClient();
        
        logger.debug('[PDF IMAGES] Fetching PDF images for venue:', venueId);
        
        // Fetch the most recent PDF upload for this venue
        const { data: uploadData, error } = await supabase
          .from('menu_uploads')
          .select('*')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        logger.debug('[PDF IMAGES] Upload data:', uploadData);
        logger.debug('[PDF IMAGES] Error:', error);

        if (uploadData) {
          logger.debug('[PDF IMAGES] pdf_images column:', uploadData.pdf_images);
          logger.debug('[PDF IMAGES] pdf_images_cc column:', uploadData.pdf_images_cc);
          logger.debug('[PDF IMAGES] pdf_images type:', typeof uploadData.pdf_images);
          logger.debug('[PDF IMAGES] pdf_images length:', uploadData.pdf_images?.length);
          logger.debug('[PDF IMAGES] pdf_images_cc length:', uploadData.pdf_images_cc?.length);
        }

        // Try pdf_images first, then fallback to pdf_images_cc
        const images = uploadData?.pdf_images || uploadData?.pdf_images_cc;

        if (uploadData && images && images.length > 0) {
          logger.debug('[PDF IMAGES] Setting PDF images:', images);
          setPdfImages(images);
        } else {
          logger.debug('[PDF IMAGES] No PDF images found, defaulting to list view');
          setViewMode('list');
        }
      } catch (error) {
        logger.error('[PDF IMAGES] Error fetching PDF images:', error);
        setViewMode('list');
      } finally {
        setLoading(false);
      }
    };

    fetchPDFImages();
  }, [venueId]);

  useEffect(() => {
    const fetchHotspots = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('menu_hotspots')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true);

        if (!error && data) {
          setHotspots(data);
        }
      } catch (error) {
        logger.error('Error fetching hotspots:', error);
      }
    };

    fetchHotspots();
  }, [venueId]);

  // Check if cart has items to show sticky cart
  useEffect(() => {
    const hasItems = cart.some(item => item.quantity > 0);
    setShowStickyCart(hasItems);
  }, [cart]);

  const handleHotspotClick = (hotspot: Hotspot) => {
    const item = menuItems.find((i: MenuItem) => i.id === hotspot.menu_item_id);
    if (item) {
      setSelectedItem(item);
      setIsModalOpen(true);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    onAddToCart(item);
    setIsModalOpen(false);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    onUpdateQuantity(itemId, quantity);
  };

  // Pinch zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.5), 3));
    }
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && zoomLevel > 1) {
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Filter menu items based on search
  const filteredItems = menuItems.filter((item: MenuItem) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item: MenuItem) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const categories = categoryOrder
    ? categoryOrder.filter(cat => groupedItems[cat]?.length > 0)
    : Object.keys(groupedItems).sort();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no PDF images and no menu items, show empty state
  if (pdfImages.length === 0 && menuItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No menu items available</p>
        <p className="text-sm text-gray-500">Add menu items in the Manage tab to see them here</p>
      </div>
    );
  }

  const cartTotal = cart.reduce((sum, item) => {
    const menuItem = menuItems.find((i: MenuItem) => i.id === item.id);
    return sum + (menuItem ? menuItem.price * item.quantity : 0);
  }, 0);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="relative">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'pdf' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pdf')}
          >
            <Grid className="h-4 w-4 mr-2" />
            Image View
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List View
          </Button>
        </div>

        {/* Search Bar (shown in list view) */}
        {viewMode === 'list' && (
          <div className="flex-1 max-w-md ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}
      </div>

      {/* PDF Image View */}
      {viewMode === 'pdf' && (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {pdfImages.map((imageUrl, index) => {
            const pageHotspots = hotspots.filter(h => h.page_index === index);
            
            return (
              <div
                key={index}
                className="relative"
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              >
                <img
                  src={imageUrl}
                  alt={`Menu Page ${index + 1}`}
                  className="w-full h-auto"
                  draggable={false}
                  onMouseDown={handleMouseDown}
                />

                {/* Interactive Hotspots */}
                {isOrdering && pageHotspots.map((hotspot) => {
                  const item = menuItems.find(i => i.id === hotspot.menu_item_id);
                  if (!item) return null;

                  const cartItem = cart.find(c => c.id === item.id);
                  const quantity = cartItem?.quantity || 0;

                  return (
                    <div
                      key={hotspot.id}
                      className="absolute cursor-pointer transition-all duration-200 hover:scale-110"
                      style={{
                        left: `${hotspot.x_percent}%`,
                        top: `${hotspot.y_percent}%`,
                        transform: 'translate(-50%, -50%)',
                        width: hotspot.width_percent ? `${hotspot.width_percent}%` : 'auto',
                        height: hotspot.height_percent ? `${hotspot.height_percent}%` : 'auto',
                      }}
                      onClick={() => handleHotspotClick(hotspot)}
                    >
                      {quantity === 0 ? (
                        <Button
                          size="sm"
                          className="bg-primary/90 hover:bg-primary text-white shadow-lg"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {item.name}
                        </Button>
                      ) : (
                        <div className="bg-white rounded-md shadow-lg border-2 border-primary p-1.5 flex items-center gap-1.5">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, quantity - 1);
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
                              onUpdateQuantity(item.id, quantity + 1);
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

          {/* Zoom Controls */}
          {zoomLevel > 1 && (
            <div className="absolute top-4 right-4 flex items-center space-x-2 bg-white rounded-lg shadow-lg p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 1))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{Math.round(zoomLevel * 100)}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetZoom}
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {categories.map((category) => {
            const items = groupedItems[category] || [];
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items
                    .filter((item: MenuItem) => item.is_available)
                    .map((item: MenuItem) => {
                      const cartItem = cart.find(c => c.id === item.id);
                      const quantity = cartItem?.quantity || 0;

                      return (
                        <div
                          key={item.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsModalOpen(true);
                          }}
                        >
                          <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-primary">
                              {formatPriceWithCurrency(item.price, '£')}
                            </span>
                            {quantity > 0 && (
                              <span className="text-sm text-muted-foreground">
                                {quantity} in cart
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Sticky Cart (Mobile) */}
      {showStickyCart && isOrdering && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 md:hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-medium">{cartItemCount} items</p>
                <p className="text-lg font-bold text-primary">
                  {formatPriceWithCurrency(cartTotal, '£')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                // Scroll to cart or trigger cart view
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="bg-primary hover:bg-primary/90"
            >
              View Cart
            </Button>
          </div>
        </div>
      )}

      {/* Item Details Modal */}
      <ItemDetailsModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        quantity={selectedItem ? (cart.find(c => c.id === selectedItem.id)?.quantity || 0) : 0}
      />
    </div>
  );
}

