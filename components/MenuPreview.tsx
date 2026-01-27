"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { MenuStyle, getMenuStyleClasses } from "@/lib/menu-style-extractor";

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  is_available: boolean;
  [key: string]: unknown; // Allow additional properties
}

interface MenuPreviewProps {
  venueId: string;
  menuItems: MenuItem[];
  categoryOrder: string[] | null;
}

export function MenuPreview({ venueId, menuItems, categoryOrder }: MenuPreviewProps) {
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
            logo_size_numeric: data.logo_size_numeric || 200, // Use numeric size
            custom_heading: data.custom_heading || undefined,
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
    return <div className="flex justify-center items-center h-64">Loading menu preview...</div>;
  }

  if (!menuStyle) {
    // Fallback to default styling
    return <DefaultMenuPreview menuItems={menuItems} categoryOrder={categoryOrder} />;
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
        <div className="flex flex-col justify-center items-center py-8">
          <img
            src={menuStyle.logo_url}
            alt={menuStyle.venue_name || "Venue Logo"}
            className="object-contain"
            style={{
              height: `${menuStyle.logo_size_numeric || 200}px`,
              maxWidth: "100%",
            }}
          />
          {menuStyle.custom_heading && (
            <p
              className="mt-4 text-center font-medium"
              style={{
                color: menuStyle.text_color,
                fontSize: `${menuStyle.body_font_size}px`,
              }}
            >
              {menuStyle.custom_heading}
            </p>
          )}
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
                  .map((item) => (
                    <div key={item.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                      {/* Item Name and Price */}
                      <div className="flex justify-between items-start mb-1">
                        <h3
                          className={`${styleClasses.item} font-semibold uppercase`}
                          style={{ color: menuStyle.text_color }}
                        >
                          {item.name}
                        </h3>
                        {menuStyle.show_prices && (
                          <span
                            className={`${styleClasses.price} ml-4 whitespace-nowrap`}
                            style={{ color: menuStyle.accent_color }}
                          >
                            £{item.price.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Item Description */}
                      {menuStyle.show_descriptions && item.description && (
                        <p className={`${styleClasses.description} text-gray-600 italic`}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Default menu preview (fallback)
function DefaultMenuPreview({
  menuItems,
  categoryOrder,
}: {
  menuItems: MenuItem[];
  categoryOrder: string[] | null;
}) {
  const groupedItems = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category ?? "";
    const arr = acc[cat] ?? [];
    arr.push(item);
    acc[cat] = arr;
    return acc;
  }, {});

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
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                        <span className="text-xl font-semibold text-purple-600 ml-4">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-base text-gray-600">{item.description}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
