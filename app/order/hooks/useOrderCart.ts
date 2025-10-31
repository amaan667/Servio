import { useState, useCallback, useEffect } from "react";
import { CartItem, MenuItem } from "../types";

const CART_STORAGE_KEY = "servio-order-cart";

export function useOrderCart() {
  // Initialize cart from localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

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
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
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
