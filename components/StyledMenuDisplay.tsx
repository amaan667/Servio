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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {categories.map((category) => {
          const items = groupedItems[category] || [];
          if (items.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              {/* Category Header */}
              <h2
                className={`${styleClasses.category} mb-6`}
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
                      <div key={item.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                        {/* Item Name and Price - Larger text on mobile */}
                        <div className="flex justify-between items-start mb-1">
                          <h3
                            className={`${styleClasses.item} font-semibold uppercase text-base md:text-lg`}
                            style={{ color: menuStyle.text_color }}
                          >
                            {item.name}
                          </h3>
                          {menuStyle.show_prices && (
                            <span
                              className={`${styleClasses.price} ml-4 whitespace-nowrap text-base md:text-lg`}
                              style={{ color: menuStyle.accent_color }}
                            >
                              £{item.price.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Item Description - Larger text on mobile */}
                        {menuStyle.show_descriptions && item.description && (
                          <p
                            className={`${styleClasses.description} text-gray-600 italic mb-3 text-sm md:text-base`}
                          >
                            {item.description}
                          </p>
                        )}

                        {/* Add to Cart Controls - Larger on mobile */}
                        <div className="flex items-center justify-end mt-2">
                          {quantity === 0 ? (
                            <Button
                              onClick={() => onAddToCart(item)}
                              size="mobile"
                              className="md:size-sm text-base md:text-sm"
                              style={{
                                backgroundColor: menuStyle.primary_color,
                                color: "#ffffff",
                              }}
                            >
                              <Plus className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                              Add
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 md:gap-2">
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                                variant="outline"
                                size="mobile"
                                className="md:size-sm h-10 w-10 md:h-9 md:w-9"
                              >
                                <Minus className="h-5 w-5 md:h-4 md:w-4" />
                              </Button>
                              <span
                                className="text-lg md:text-base font-semibold min-w-[2.5rem] md:min-w-[30px] text-center"
                                style={{ color: menuStyle.primary_color }}
                              >
                                {quantity}
                              </span>
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                                size="mobile"
                                className="md:size-sm h-10 w-10 md:h-9 md:w-9"
                                style={{
                                  backgroundColor: menuStyle.primary_color,
                                  color: "#ffffff",
                                }}
                              >
                                <Plus className="h-5 w-5 md:h-4 md:w-4" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items
                  .filter((item) => item.is_available)
                  .map((item) => {
                    const cartItem = cart.find((c) => c.id === item.id);
                    const quantity = cartItem?.quantity || 0;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base md:text-lg font-semibold text-gray-900">
                            {item.name}
                          </h3>
                          <span className="text-lg md:text-xl font-semibold text-purple-600 ml-4">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-sm md:text-base text-gray-600 mb-4">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-4">
                          {quantity === 0 ? (
                            <Button
                              onClick={() => onAddToCart(item)}
                              variant="servio"
                              className="w-full h-12 md:h-10 text-base md:text-sm"
                              size="mobile"
                            >
                              <Plus className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                              Add to Cart
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 md:gap-3 w-full">
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                                variant="outline"
                                size="mobile"
                                className="flex-1 h-10 md:h-9"
                              >
                                <Minus className="h-5 w-5 md:h-4 md:w-4" />
                              </Button>
                              <span className="text-xl md:text-lg font-semibold min-w-[2.5rem] md:min-w-[40px] text-center text-purple-600">
                                {quantity}
                              </span>
                              <Button
                                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                                size="mobile"
                                variant="servio"
                                className="flex-1 h-10 md:h-9"
                              >
                                <Plus className="h-5 w-5 md:h-4 md:w-4" />
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
