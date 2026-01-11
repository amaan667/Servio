import { useState, useCallback, useEffect } from "react";
import { CartItem, MenuItem } from "../types";
import { useSearchParams } from "next/navigation";

export function useOrderCart() {
  const searchParams = useSearchParams();

  // Get venue and table from URL to scope the cart
  const venueSlug = searchParams?.get("venue") || "";
  const tableNumber = searchParams?.get("table") || searchParams?.get("counter") || "";

  // Create a scoped cart storage key (venue + table specific)
  const CART_STORAGE_KEY = `servio-order-cart-${venueSlug}-${tableNumber}`;

  // Initialize cart from localStorage (scoped to venue + table)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, CART_STORAGE_KEY]);

  // Clear cart when venue or table changes (new QR code scanned)
  useEffect(() => {
    if (typeof window !== "undefined" && venueSlug && tableNumber) {
      // Check if this is a different venue/table than the last one
      const lastKey = localStorage.getItem("servio-last-cart-key");
      const currentKey = CART_STORAGE_KEY;

      if (lastKey && lastKey !== currentKey) {
        // New QR code scanned - reset cart
        setCart([]);
        localStorage.removeItem(lastKey);
      }

      // Store the current key
      localStorage.setItem("servio-last-cart-key", currentKey);
    }
  }, [venueSlug, tableNumber, CART_STORAGE_KEY]);

  const addToCart = useCallback(
    (item: MenuItem & { selectedModifiers?: Record<string, string[]>; modifierPrice?: number }) => {
      setCart((prev) => {
        // Check if item with same modifiers already exists
        const existing = prev.find((cartItem) => {
          if (cartItem.id !== item.id) return false;
          // Compare modifiers
          const cartModifiers = JSON.stringify(cartItem.selectedModifiers || {});
          const itemModifiers = JSON.stringify(item.selectedModifiers || {});
          return cartModifiers === itemModifiers;

        if (existing) {
          return prev.map((cartItem) =>
            cartItem.id === item.id &&
            JSON.stringify(cartItem.selectedModifiers || {}) ===
              JSON.stringify(item.selectedModifiers || {})
              ? {
                  ...cartItem,

                }

        }
        return [
          ...prev,
          {
            ...item,

          },
        ];

    },
    []
  );

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(itemId);
        return;
      }

      setCart((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
    },
    [removeFromCart]
  );

  const updateSpecialInstructions = useCallback((itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, specialInstructions: instructions } : item
      )
    );
  }, []);

  const getTotalPrice = useCallback(() => {
    return cart.reduce((total, item) => {
      const itemPrice = item.price + (item.modifierPrice || 0);
      return total + itemPrice * item.quantity;
    }, 0);
  }, [cart]);

  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const resetCart = useCallback(() => {
    setCart([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSpecialInstructions,
    getTotalPrice,
    getTotalItems,
    resetCart,
  };
}
