"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { MenuStyle, getMenuStyleClasses } from "@/lib/menu-style-extractor";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  is_available: boolean;
  [key: string]: unknown; // Allow additional properties
}

interface StyledMenuDisplayProps {
  venueId: string;
  menuItems: MenuItem[];
  categoryOrder: string[] | null;
  onAddToCart: (item: Record<string, unknown>) => void;
  cart: Array<{ id: string; quantity: number }>;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

export function StyledMenuDisplay({
  venueId,
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart,
  onUpdateQuantity,
}: StyledMenuDisplayProps) {
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenuStyle = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("menu_design_settings")
          .select("*")
          .eq("venue_id", venueId)
          .single();

        if (data && !error) {
          // Use detected colors if auto_theme_enabled is true, otherwise use manually set colors
          const primaryColor =
            data.auto_theme_enabled && data.detected_primary_color
              ? data.detected_primary_color
              : data.primary_color || "#8b5cf6";
          const secondaryColor =
            data.auto_theme_enabled && data.detected_secondary_color
              ? data.detected_secondary_color
              : data.secondary_color || "#f3f4f6";

          const style: MenuStyle = {
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: primaryColor,
            background_color: "#ffffff",
            text_color: "#1f2937",
            font_family: data.font_family || "inter",
            font_size: (data.font_size as "small" | "medium" | "large") || "medium",
            heading_font_size:
              data.font_size === "small" ? 20 : data.font_size === "large" ? 28 : 24,
            body_font_size: data.font_size === "small" ? 14 : data.font_size === "large" ? 18 : 16,
            layout: "single-column",
            alignment: "left",
            spacing: "normal",
            logo_url: data.logo_url || undefined,
            venue_name: data.venue_name || undefined,
            show_descriptions: data.show_descriptions ?? true,
            show_prices: data.show_prices ?? true,
            show_images: false,
            detected_primary_color: data.detected_primary_color || data.primary_color,
            detected_secondary_color: data.detected_secondary_color || data.secondary_color,
            detected_layout: "single-column",
          };
          setMenuStyle(style);
        }
      } catch (_error) {
        // Error silently handled
      } finally {
        setLoading(false);
      }
    };

    fetchMenuStyle();
  }, [venueId]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading menu...</div>;
  }

  if (!menuStyle) {
    // Use new vertical menu display as default
    const { VerticalMenuDisplay } = require("./VerticalMenuDisplay");
    return (
      <VerticalMenuDisplay
        menuItems={menuItems}
        categoryOrder={categoryOrder}
        onAddToCart={onAddToCart}
        cart={cart}
        onRemoveFromCart={onRemoveFromCart}
        onUpdateQuantity={onUpdateQuantity}
      />
    );
  }

  const styleClasses = getMenuStyleClasses(menuStyle);

  // Group items by category
  const groupedItems = menuItems.reduce(
    (acc, item) => {
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

  // Get category order or use alphabetical
  const categories = categoryOrder || Object.keys(groupedItems).sort();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: menuStyle.background_color, color: menuStyle.text_color }}
    >
      {/* Header with Logo and Venue Name */}
      {menuStyle.logo_url && (
        <div className="flex justify-center items-center py-8">
          <img
            src={menuStyle.logo_url}
            alt={menuStyle.venue_name || "Venue Logo"}
            className="h-24 object-contain"
          />
        </div>
      )}

      {menuStyle.venue_name && !menuStyle.logo_url && (
        <div className="text-center py-8">
          <h1
            className="font-bold"
            style={{
              fontSize: `${menuStyle.heading_font_size + 8}px`,
              color: menuStyle.primary_color,
            }}
          >
            {menuStyle.venue_name}
          </h1>
        </div>
      )}

      {/* Menu Items by Category */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {categories.map((category) => {
          const items = groupedItems[category] || [];
          if (items.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              {/* Category Header */}
              <h2
                className={`${styleClasses.category} mb-4 sm:mb-6 text-xl sm:text-2xl md:text-3xl`}
                style={{ color: menuStyle.primary_color }}
              >
                {category}
              </h2>

              {/* Items List - PDF Style */}
              <div className="space-y-4">
                {items
                  .filter((item) => item.is_available)
                  .map((item) => {
                    const cartItem = cart.find((c) => c.id === item.id);
                    const quantity = cartItem?.quantity || 0;

                    return (
                      <div
                        key={item.id}
                        className="border-b border-gray-200 pb-4 sm:pb-5 md:pb-6 last:border-b-0"
                      >
                        {/* Item Name and Price - Optimized for mobile/tablet */}
                        <div className="flex justify-between items-start mb-2 sm:mb-3">
                          <h3
                            className={`${styleClasses.item} font-semibold uppercase text-lg sm:text-xl md:text-2xl flex-1 pr-2 leading-tight`}
                            style={{ color: menuStyle.text_color }}
                          >
                            {item.name}
                          </h3>
                          {menuStyle.show_prices && (
                            <span
                              className={`${styleClasses.price} ml-4 whitespace-nowrap text-xl sm:text-2xl md:text-2xl font-bold`}
                              style={{ color: menuStyle.accent_color }}
                            >
                              £{item.price.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Item Description - Optimized for mobile/tablet */}
                        {menuStyle.show_descriptions && item.description && (
                          <p
                            className={`${styleClasses.description} text-gray-600 italic mb-3 sm:mb-4 text-sm sm:text-base md:text-lg leading-relaxed`}
                          >
                            {item.description}
                          </p>
                        )}

                        {/* Add to Cart Controls - Optimized for mobile/tablet */}
                        <div className="flex items-center justify-end mt-3 sm:mt-4">
                          {quantity === 0 ? (
                            <Button
                              onClick={() => onAddToCart(item)}
                              size="mobile"
                              className="h-14 sm:h-12 md:h-11 text-base sm:text-base md:text-sm px-6 sm:px-8 font-semibold"
                              style={{
                                backgroundColor: menuStyle.primary_color,
                                color: "#ffffff",
                              }}
                            >
                              <Plus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4 mr-2" />
                              Add
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                                variant="outline"
                                size="mobile"
                                className="h-12 sm:h-11 md:h-10 w-12 sm:w-11 md:w-10 min-h-[48px] sm:min-h-[44px]"
                              >
                                <Minus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                              </Button>
                              <span
                                className="text-2xl sm:text-xl md:text-lg font-bold min-w-[3rem] sm:min-w-[2.5rem] md:min-w-[30px] text-center"
                                style={{ color: menuStyle.primary_color }}
                              >
                                {quantity}
                              </span>
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                                size="mobile"
                                className="h-12 sm:h-11 md:h-10 w-12 sm:w-11 md:w-10 min-h-[48px] sm:min-h-[44px]"
                                style={{
                                  backgroundColor: menuStyle.primary_color,
                                  color: "#ffffff",
                                }}
                              >
                                <Plus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Default menu display (fallback)
function DefaultMenuDisplay({
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart: _onRemoveFromCart,
  onUpdateQuantity,
}: Omit<StyledMenuDisplayProps, "venueId">) {
  const groupedItems = menuItems.reduce(
    (acc, item) => {
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

  const categories = categoryOrder || Object.keys(groupedItems).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {categories.map((category) => {
          const items = groupedItems[category] || [];
          if (items.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {items
                  .filter((item) => item.is_available)
                  .map((item) => {
                    const cartItem = cart.find((c) => c.id === item.id);
                    const quantity = cartItem?.quantity || 0;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg p-4 sm:p-5 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2 sm:mb-3">
                          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 flex-1 pr-2 leading-tight">
                            {item.name}
                          </h3>
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600 ml-4 whitespace-nowrap">
                            £{item.price.toFixed(2)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-5 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-4 sm:mt-5">
                          {quantity === 0 ? (
                            <Button
                              onClick={() => onAddToCart(item)}
                              variant="servio"
                              className="w-full h-14 sm:h-12 md:h-11 text-base sm:text-base md:text-sm font-semibold px-4 sm:px-6"
                              size="mobile"
                            >
                              <Plus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4 mr-2" />
                              Add to Cart
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 sm:gap-3 w-full">
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                                variant="outline"
                                size="mobile"
                                className="flex-1 h-12 sm:h-11 md:h-10 min-h-[48px] sm:min-h-[44px]"
                              >
                                <Minus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                              </Button>
                              <span className="text-2xl sm:text-xl md:text-lg font-bold min-w-[3rem] sm:min-w-[2.5rem] md:min-w-[40px] text-center text-purple-600">
                                {quantity}
                              </span>
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                                size="mobile"
                                variant="servio"
                                className="flex-1 h-12 sm:h-11 md:h-10 min-h-[48px] sm:min-h-[44px]"
                              >
                                <Plus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
