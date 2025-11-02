"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  is_available: boolean;
  image_url?: string;
  [key: string]: unknown;
}

interface VerticalMenuDisplayProps {
  menuItems: MenuItem[];
  categoryOrder: string[] | null;
  onAddToCart: (item: Record<string, unknown>) => void;
  cart: Array<{ id: string; quantity: number }>;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

export function VerticalMenuDisplay({
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart: _onRemoveFromCart,
  onUpdateQuantity,
}: VerticalMenuDisplayProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({
    /* Empty */
  });

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

  const categories = categoryOrder || Object.keys(groupedItems).sort();

  // Filter items by search
  const filteredItems = menuItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroupedItems = searchQuery
    ? filteredItems.reduce(
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
      )
    : groupedItems;

  // Scroll to category
  const scrollToCategory = (category: string) => {
    const element = categoryRefs.current[category];
    if (element) {
      const offset = 120; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setSelectedCategory(category);
      setSidebarOpen(false);
    }
  };

  // Track which category is in view
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;

      for (const category of categories) {
        const element = categoryRefs.current[category];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setSelectedCategory(category);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Vertical Sidebar - Categories */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out z-40
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search Food"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Categories List */}
          <nav className="flex-1 overflow-y-auto py-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => scrollToCategory(category)}
                className={`
                  w-full text-left px-6 py-3 text-sm font-medium transition-colors
                  ${
                    selectedCategory === category
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                {category}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-0">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
          {/* Menu Items by Category */}
          {Object.entries(filteredGroupedItems).map(([category, items]) => {
            if (items.length === 0) return null;

            return (
              <div
                key={category}
                ref={(el) => {
                  categoryRefs.current[category] = el;
                }}
                className="mb-12"
              >
                {/* Category Title */}
                <h2 className="text-3xl font-bold mb-8 text-gray-900 uppercase tracking-wide">
                  {category}
                </h2>

                {/* Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items
                    .filter((item) => item.is_available)
                    .map((item) => {
                      const cartItem = cart.find((c) => c.id === item.id);
                      const quantity = cartItem?.quantity || 0;

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100"
                        >
                          <div className="flex gap-4 p-6">
                            {/* Item Details */}
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                                  {item.name}
                                </h3>
                                <span className="text-xl font-bold text-purple-600 ml-4">
                                  £{item.price.toFixed(2)}
                                </span>
                              </div>

                              {item.description && (
                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                  {item.description}
                                </p>
                              )}

                              {/* Add to Cart Controls */}
                              <div className="flex items-center gap-2 mt-4">
                                {quantity === 0 ? (
                                  <Button
                                    onClick={() => onAddToCart(item)}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
                                    size="sm"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add to Cart
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2 w-full">
                                    <Button
                                      onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="text-lg font-bold min-w-[40px] text-center text-purple-600">
                                      {quantity}
                                    </span>
                                    <Button
                                      onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                                      size="sm"
                                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Item Image (if available) */}
                            {item.image_url && (
                              <div
                                className="flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden"
                                style={{ width: "110px", height: "110px" }}
                              >
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-contain"
                                />
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

          {/* Empty State */}
          {Object.keys(filteredGroupedItems).length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">No items found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
