"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart, X, Search, List, Grid, ZoomIn, ZoomOut } from "lucide-react";
import { ItemDetailsModal } from "@/components/ItemDetailsModal";
import { Input } from "@/components/ui/input";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";

interface MenuItem {
  id: string;
  venue_id?: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_url?: string | null;
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
  // Bounding box coordinates
  x1_percent?: number;
  y1_percent?: number;
  x2_percent?: number;
  y2_percent?: number;
  // Button position (from GPT Vision)
  button_x_percent?: number;
  button_y_percent?: number;
}

export function EnhancedPDFMenuDisplay({
  venueId,
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart,
  onUpdateQuantity,
  isOrdering = false,
}: EnhancedPDFMenuDisplayProps) {
  // Check cache for PDF images existence to prevent flicker
  const hasPdfImagesInCache = () => {
    if (typeof window === "undefined") return false;
    const cached = sessionStorage.getItem(`has_pdf_images_${venueId}`);
    return cached === "true";
  };

  // Cache PDF images for instant load
  const getCachedPdfImages = () => {
    if (typeof window === "undefined") return [];
    const cached = sessionStorage.getItem(`pdf_images_${venueId}`);
    return cached ? JSON.parse(cached) : [];
  };

  const getCachedHotspots = () => {
    if (typeof window === "undefined") return [];
    const cached = sessionStorage.getItem(`hotspots_${venueId}`);
    return cached ? JSON.parse(cached) : [];
  };

  // Initialize with cached data immediately - no loading state if cache exists
  const cachedImages = getCachedPdfImages();
  const cachedHotspots = getCachedHotspots();
  const hasCachedImages = cachedImages.length > 0;
  const hasCachedHotspots = cachedHotspots.length > 0;

  const [pdfImages, setPdfImages] = useState<string[]>(cachedImages);
  const [loading, setLoading] = useState(!hasCachedImages); // Only show loading if no cached images
  const [hotspots, setHotspots] = useState<Hotspot[]>(cachedHotspots);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"pdf" | "list">(
    hasCachedImages && cachedImages.length > 0 ? "pdf" : "list"
  );
  const [hasPdfImages, setHasPdfImages] = useState(
    hasPdfImagesInCache() || cachedImages.length > 0
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showStickyCart, setShowStickyCart] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({
    /* Empty */
  });

  // Preload images for instant display
  useEffect(() => {
    if (pdfImages.length > 0 && typeof window !== "undefined") {
      pdfImages.forEach((imageUrl) => {
        const img = new Image();
        img.src = imageUrl;
      });
    }
  }, [pdfImages]);

  useEffect(() => {
    // Skip fetch if we already have cached data - instant load
    if (hasCachedImages && cachedImages.length > 0) {
      setLoading(false);
      return;
    }

    const fetchPDFImages = async () => {
      try {
        const supabase = createClient();

        // Fetch the most recent PDF upload for this venue
        const { data: uploadData, error } = await supabase
          .from("menu_uploads")
          .select("*")
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Try pdf_images first, then fallback to pdf_images_cc
        const images = uploadData?.pdf_images || uploadData?.pdf_images_cc;

        if (uploadData && images && images.length > 0) {
          setPdfImages(images);
          setHasPdfImages(true);
          setViewMode("pdf");
          // Cache PDF images for instant load next time
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`has_pdf_images_${venueId}`, "true");
            sessionStorage.setItem(`pdf_images_${venueId}`, JSON.stringify(images));
          }
          // Preload images
          images.forEach((imageUrl: string) => {
            const img = new Image();
            img.src = imageUrl;
          });
        } else {
          setViewMode("list");
          setHasPdfImages(false);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`has_pdf_images_${venueId}`, "false");
            sessionStorage.removeItem(`pdf_images_${venueId}`);
          }
        }
      } catch (_error) {
        setViewMode("list");
      } finally {
        setLoading(false);
      }
    };

    fetchPDFImages();
  }, [venueId, hasCachedImages, cachedImages.length]);

  // Fetch or auto-generate hotspots - skip if cached
  useEffect(() => {
    // Skip if we already have cached hotspots
    if (hasCachedHotspots && cachedHotspots.length > 0) {
      return;
    }

    const fetchOrGenerateHotspots = async () => {
      try {
        const supabase = createClient();

        // First, try to fetch existing hotspots
        const { data: existingHotspots, error } = await supabase
          .from("menu_hotspots")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_active", true);

        if (!error && existingHotspots && existingHotspots.length > 0) {
          // Check if hotspots have new bounding box format
          const hasBoundingBoxes = existingHotspots.some((h) => h.x1_percent !== undefined);

          if (!hasBoundingBoxes) {
            /* Empty */
          }

          setHotspots(existingHotspots);

          // Cache hotspots for instant load
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`hotspots_${venueId}`, JSON.stringify(existingHotspots));
          }
        } else {
          // Auto-generate hotspots if none exist and we have PDF images
          if (pdfImages.length > 0 && menuItems.length > 0) {
            const generatedHotspots = await generateHotspotsFromMenu(menuItems, pdfImages.length);
            setHotspots(generatedHotspots);

            // Save to database
            await saveHotspotsToDatabase(venueId, generatedHotspots, supabase);

            // Cache generated hotspots
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`hotspots_${venueId}`, JSON.stringify(generatedHotspots));
            }
          }
        }
      } catch (_error) {
        // Error handled silently
      }
    };

    if (pdfImages.length > 0) {
      fetchOrGenerateHotspots();
    }
  }, [venueId, pdfImages, menuItems]);

  // Check if cart has items to show sticky cart
  useEffect(() => {
    const hasItems = cart.some((item) => item.quantity > 0);
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
    const existingItem = cart.find((c) => c.id === item.id);
    if (!existingItem) {
      onAddToCart(item);
      onUpdateQuantity(item.id, 1);
    } else {
      onUpdateQuantity(item.id, existingItem.quantity + 1);
    }
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity === 0) {
      onRemoveFromCart(itemId);
    } else {
      const existingItem = cart.find((c) => c.id === itemId);
      if (existingItem) {
        onUpdateQuantity(itemId, quantity);
      } else {
        const item = menuItems.find((i) => i.id === itemId);
        if (item) {
          onAddToCart(item);
          onUpdateQuantity(itemId, quantity);
        }
      }
    }
  };

  const scrollToCategory = (category: string) => {
    setSelectedCategory(category);
    const element = categoryRefs.current[category];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.5), 3));
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
        y: e.clientY - dragStart.y,
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
        y: e.touches[0].clientY - imagePosition.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && zoomLevel > 1) {
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
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
  const filteredItems = menuItems.filter(
    (item: MenuItem) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group items by category
  const groupedItems = filteredItems.reduce(
    (acc, item: MenuItem) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {
      /* Empty */
    } as Record<string, MenuItem[]>
  );

  const categories = categoryOrder
    ? categoryOrder.filter((cat) => groupedItems[cat]?.length > 0)
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
      {/* Horizontal Scrollable Categories */}
      {categories.length > 0 && viewMode === "list" && (
        <div className="mb-6 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="overflow-x-auto py-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-purple-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-purple-700">
            <div className="flex space-x-2 px-4">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategory(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="whitespace-nowrap text-white hover:text-white dark:text-white dark:hover:text-white"
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => scrollToCategory(category)}
                  className="shrink-0 min-w-fit text-white hover:text-white dark:text-white dark:hover:text-white"
                >
                  <span className="truncate max-w-[120px] px-1">{category}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle - Always show both buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === "pdf" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (pdfImages.length > 0 || hasPdfImages) {
                setViewMode("pdf");
              } else {
                // Intentionally empty
              }
            }}
            disabled={!hasPdfImages && pdfImages.length === 0}
          >
            <Grid className="h-4 w-4 mr-2" />
            Visual Menu
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List View
          </Button>
        </div>

        {/* Search Bar (shown in list view) */}
        {viewMode === "list" && (
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

      {/* PDF View Loading State - Only show if truly loading */}
      {viewMode === "pdf" && pdfImages.length === 0 && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading visual menu...</p>
          </div>
        </div>
      )}

      {/* PDF Image View with Interactive Hotspots */}
      {viewMode === "pdf" && pdfImages.length > 0 && (
        <div className="space-y-4">
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
              const pageHotspots = hotspots.filter((h) => h.page_index === index);

              return (
                <div key={index} className="relative mb-4">
                  {/* Image container with transform */}
                  <div
                    className="relative"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                      transformOrigin: "center center",
                      transition: isDragging ? "none" : "transform 0.1s ease-out",
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt={`Menu Page ${index + 1}`}
                      className="w-full h-auto"
                      draggable={false}
                      onMouseDown={handleMouseDown}
                      loading="eager"
                      decoding="async"
                    />
                  </div>

                  {/* Hotspot overlays - positioned relative to image, accounting for transform */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                      transformOrigin: "center center",
                      pointerEvents: zoomLevel > 1 ? "none" : "auto",
                    }}
                  >
                    {pageHotspots.map((hotspot) => {
                      const item = menuItems.find((i) => i.id === hotspot.menu_item_id);
                      if (!item) return null;

                      const cartItem = cart.find((c) => c.id === item.id);
                      const quantity = cartItem?.quantity || 0;

                      // Prefer bounding box coordinates if available
                      const hasBoundingBox =
                        hotspot.x1_percent !== undefined &&
                        hotspot.y1_percent !== undefined &&
                        hotspot.x2_percent !== undefined &&
                        hotspot.y2_percent !== undefined &&
                        hotspot.x2_percent - hotspot.x1_percent < 60; // Sanity check

                      if (hasBoundingBox) {
                        // Use precise bounding box coordinates
                        return (
                          <div
                            key={hotspot.id}
                            className="absolute group transition-all duration-200 cursor-pointer"
                            style={{
                              left: `${hotspot.x1_percent}%`,
                              top: `${hotspot.y1_percent}%`,
                              width: `${hotspot.x2_percent! - hotspot.x1_percent!}%`,
                              height: `${hotspot.y2_percent! - hotspot.y1_percent!}%`,
                            }}
                            onClick={() => handleHotspotClick(hotspot)}
                          >
                            {/* Cart controls only shown when ordering (not in preview mode) */}
                            {isOrdering && (
                              <div
                                className="absolute z-20"
                                style={{
                                  left:
                                    hotspot.button_x_percent !== undefined
                                      ? `${hotspot.button_x_percent}%`
                                      : `${hotspot.x2_percent! - 8}%`,
                                  top:
                                    hotspot.button_y_percent !== undefined
                                      ? `${hotspot.button_y_percent}%`
                                      : `${(hotspot.y1_percent! + hotspot.y2_percent!) / 2}%`,
                                  transform: "translate(-50%, -50%)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {quantity === 0 ? (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(item);
                                      // Visual feedback
                                      const button = e.currentTarget;
                                      button.classList.add("animate-pulse");
                                      setTimeout(
                                        () => button.classList.remove("animate-pulse"),
                                        300
                                      );
                                    }}
                                    className="bg-primary hover:bg-primary/90 text-white shadow-2xl text-xs px-3 py-1.5 h-8 font-semibold"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add to Cart
                                  </Button>
                                ) : (
                                  <div className="bg-white rounded-lg shadow-2xl border-2 border-primary p-1.5 flex items-center gap-2">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQuantity(item.id, quantity - 1);
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 border-primary/30 hover:bg-primary/10"
                                    >
                                      <Minus className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                    <span className="text-sm font-bold text-primary min-w-[24px] text-center">
                                      {quantity}
                                    </span>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQuantity(item.id, quantity + 1);
                                      }}
                                      size="sm"
                                      className="h-7 w-7 p-0 bg-primary hover:bg-primary/90 text-white"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Item name overlay (optional - shows on hover) */}
                            <div className="absolute left-2 bottom-2 bg-black/70 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {item.name} - £{item.price.toFixed(2)}
                            </div>
                          </div>
                        );
                      } else {
                        // Fallback: Create smart overlay even with old format
                        // Use estimated bounding box based on typical menu layouts
                        const estimatedWidth = 85; // Most items span ~85% of width
                        const estimatedHeight = 6; // Typical item height
                        const estimatedX1 = Math.max(5, hotspot.x_percent - 40); // Start from left edge
                        const estimatedY1 = Math.max(0, hotspot.y_percent - 3);

                        return (
                          <div
                            key={hotspot.id}
                            className="absolute group transition-all duration-200 cursor-pointer"
                            style={{
                              left: `${estimatedX1}%`,
                              top: `${estimatedY1}%`,
                              width: `${estimatedWidth}%`,
                              height: `${estimatedHeight}%`,
                            }}
                            onClick={() => handleHotspotClick(hotspot)}
                          >
                            {/* Always-visible cart controls overlayed on PDF - positioned using GPT Vision button coordinates */}
                            {/* Cart controls only shown when ordering (not in preview mode) */}
                            {isOrdering && (
                              <div
                                className="absolute z-10"
                                style={{
                                  left:
                                    hotspot.button_x_percent !== undefined
                                      ? `${hotspot.button_x_percent}%`
                                      : `${estimatedX1 + estimatedWidth - 8}%`,
                                  top:
                                    hotspot.button_y_percent !== undefined
                                      ? `${hotspot.button_y_percent}%`
                                      : `${estimatedY1 + estimatedHeight / 2}%`,
                                  transform: "translate(-50%, -50%)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {quantity === 0 ? (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(item);
                                    }}
                                    className="bg-primary hover:bg-primary/90 text-white shadow-xl text-xs px-3 py-1.5 h-8"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                  </Button>
                                ) : (
                                  <div className="bg-white rounded-lg shadow-xl border-2 border-primary p-1.5 flex items-center gap-2">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQuantity(item.id, quantity - 1);
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 border-primary/30 hover:bg-primary/10"
                                    >
                                      <Minus className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                    <span className="text-sm font-bold text-primary min-w-[20px] text-center">
                                      {quantity}
                                    </span>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQuantity(item.id, quantity + 1);
                                      }}
                                      size="sm"
                                      className="h-7 w-7 p-0 bg-primary hover:bg-primary/90"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}

            {/* Zoom Controls */}
            {zoomLevel > 1 && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-white rounded-lg shadow-lg p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel((prev) => Math.max(prev - 0.2, 1))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{Math.round(zoomLevel * 100)}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel((prev) => Math.min(prev + 0.2, 3))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetZoom}>
                  Reset
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {categories.map((category) => {
            const items = groupedItems[category] || [];
            if (items.length === 0) return null;

            return (
              <div
                key={category}
                className="space-y-4"
                ref={(el) => {
                  categoryRefs.current[category] = el;
                }}
              >
                <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items
                    .filter((item: MenuItem) => item.is_available)
                    .map((item: MenuItem) => {
                      const cartItem = cart.find((c) => c.id === item.id);
                      const quantity = cartItem?.quantity || 0;

                      return (
                        <div
                          key={item.id}
                          className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsModalOpen(true);
                          }}
                        >
                          {/* IMAGE - Show if available from hybrid merge */}
                          {item.image_url && (
                            <div className="relative w-full h-48 bg-gray-100">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Hide image if it fails to load
                                  (e.target as HTMLElement).style.display = "none";
                                  (e.target as HTMLElement).parentElement!.style.display = "none";
                                }}
                              />
                            </div>
                          )}

                          <div className="p-4">
                            <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-primary">
                                {formatPriceWithCurrency(item.price, "£")}
                              </span>
                              {isOrdering && quantity > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  {quantity} in cart
                                </span>
                              )}
                            </div>
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
                  {formatPriceWithCurrency(cartTotal, "£")}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                // Scroll to cart or trigger cart view
                window.scrollTo({ top: 0, behavior: "smooth" });
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
        quantity={selectedItem ? cart.find((c) => c.id === selectedItem.id)?.quantity || 0 : 0}
        isPreview={!isOrdering}
      />
    </div>
  );
}

// Helper function to auto-generate hotspots from menu items
async function generateHotspotsFromMenu(
  menuItems: MenuItem[],
  pageCount: number
): Promise<Hotspot[]> {
  const hotspots: Hotspot[] = [];
  const itemsPerPage = Math.ceil(menuItems.length / pageCount);

  menuItems.forEach((item, index) => {
    const pageIndex = Math.floor(index / itemsPerPage);
    const positionOnPage = index % itemsPerPage;
    const totalOnPage = Math.min(itemsPerPage, menuItems.length - pageIndex * itemsPerPage);

    // Calculate position - distribute items evenly across the page
    // Assuming menu items are listed vertically down the page
    const x_percent = 85; // Right side for + buttons
    const y_percent = 15 + (positionOnPage / totalOnPage) * 70; // Spread from 15% to 85% of page

    hotspots.push({
      id: `auto-${item.id}`,
      menu_item_id: item.id,
      page_index: pageIndex,
      x_percent,
      y_percent,
      width_percent: 10,
      height_percent: 5,
    });
  });

  return hotspots;
}

// Helper function to save hotspots to database
async function saveHotspotsToDatabase(
  venueId: string,
  hotspots: Hotspot[],
  supabase: ReturnType<typeof createClient>
) {
  try {
    // Delete existing hotspots for this venue
    await supabase.from("menu_hotspots").delete().eq("venue_id", venueId);

    // Insert new hotspots
    const hotspotsToInsert = hotspots.map((h) => ({
      venue_id: venueId,
      menu_item_id: h.menu_item_id,
      page_index: h.page_index,
      x_percent: h.x_percent,
      y_percent: h.y_percent,
      width_percent: h.width_percent,
      height_percent: h.height_percent,
      is_active: true,
    }));

    await supabase.from("menu_hotspots").insert(hotspotsToInsert);
  } catch (_error) {
    // Error handled silently
  }
}
