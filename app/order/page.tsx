"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Minus,
  ShoppingCart,
  Clock,
  Star,
  CreditCard,
  Apple,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { demoMenuItems } from "@/data/demoMenuItems";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
  prep_time?: number;
  rating?: number;
}

interface CartItem extends MenuItem {
  quantity: number;
  special_instructions?: string;
}

export default function CustomerOrderPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    table_number: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Dynamically generate categories from menuItems
  const uniqueCategories = Array.from(
    new Set(menuItems.map((item) => item.category.trim().toLowerCase())),
  );
  const categories = ["all", ...uniqueCategories];

  const searchParams = useSearchParams();
  const isDemo = searchParams?.get("demo") === "1";
  
  // Detect if user is signed in (simple check, adjust as needed)
  const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("servio_session");

  // Determine venue ID - use demo-cafe for demo, or get from URL params
  const venueId = isDemo ? "demo-cafe" : searchParams?.get("venue") || "demo-cafe";

  // Check if environment variables are set
  const hasSupabaseConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setMenuError(
        "Database configuration is missing. Please check your environment variables.",
      );
      setLoadingMenu(false);
      return;
    }

    // Load menu based on venue and login status
    loadMenuItems();
  }, [hasSupabaseConfig, venueId, isLoggedIn]);

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    setMenuError(null);

    // Check if supabase is available
    if (!supabase) {
      setMenuError("Database connection not available");
      setLoadingMenu(false);
      return;
    }

    // Determine if this is a demo venue or real venue
    const isDemoVenue = venueId === "demo-cafe" || venueId === "demo";
    const shouldUseDemoData = !isLoggedIn || isDemoVenue;

    console.log("Menu loading logic:", {
      venueId,
      isLoggedIn,
      isDemoVenue,
      shouldUseDemoData,
    });

    if (shouldUseDemoData) {
      // Use demo data for demo venues or when not logged in
      console.log("Loading demo menu data");
      setMenuItems(
        demoMenuItems.map((item, idx) => ({
          ...item,
          id: `demo-${idx}`,
          available: true,
          price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0,
        }))
      );
      setLoadingMenu(false);
      return;
    }

    // For real venues, fetch from database
    console.log(`Fetching menu for real venue slug: ${venueId}`);
    
    try {
      // First, get the venue by venue_id (which is the slug)
      const { data: venueData, error: venueError } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("venue_id", venueId)  // venue_id is the slug field
        .single();

      if (venueError || !venueData) {
        console.log(`Venue not found for slug: ${venueId}`);
        setMenuItems([]);
        setMenuError(`No menu items found for venue '${venueId}'.`);
        setLoadingMenu(false);
        return;
      }

      const actualVenueId = venueData.venue_id;
      console.log(`Found venue: ${venueId} -> ${actualVenueId}`);

      // Fetch menu items for this specific venue
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", actualVenueId)
        .eq("available", true)
        .order("category", { ascending: true });

      console.log("Menu items query:", {
        venueSlug: venueId,
        actualVenueId,
        data: data?.length || 0,
        error,
      });

      if (error) {
        console.error("Supabase error:", error);
        setMenuItems([]);
        setMenuError(`Error loading menu: ${error.message}`);
        setLoadingMenu(false);
        return;
      }

      // Set menu items (empty array if no items found)
      const availableItems = data?.filter((item) => item.available) || [];
      console.log(`Found ${availableItems.length} available items for venue ${venueId} (${actualVenueId})`);
      
      setMenuItems(availableItems);
      
      if (availableItems.length === 0) {
        setMenuError(`No menu items found for venue '${venueId}'.`);
      }
      
      setLoadingMenu(false);

    } catch (err: any) {
      console.error("Unexpected error loading menu:", err);
      setMenuItems([]);
      setMenuError(`Error loading menu: ${err.message}`);
      setLoadingMenu(false);
    }
  };

  // ... the rest of your code is unchanged from your original file ...

  // -- CODE BELOW IS IDENTICAL TO YOURS (no change needed) --

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((cartItem) =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem,
        );
      }
      return prev.filter((cartItem) => cartItem.id !== itemId);
    });
  };

  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((cartItem) =>
        cartItem.id === itemId
          ? { ...cartItem, special_instructions: instructions }
          : cartItem,
      ),
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      alert("Please fill in your name and phone number");
      return;
    }

    if (cart.length === 0) {
      alert("Your cart is empty");
      return;
    }

    if (!supabase) {
      alert("Database connection not available");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          venue_id: venueId, // <-- If you need the UUID here, use actualVenueId!
          customer_name: customerInfo.name,
          customer_phone: customerInfo.phone,
          table_number: parseInt(customerInfo.table_number) || 0,
          total_amount: getTotalPrice(),
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            special_instructions: item.special_instructions,
          })),
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation error:", orderError);
        alert("Failed to submit order. Please try again.");
        setIsSubmitting(false);
        return;
      }

      console.log("Order submitted successfully:", order);
      setOrderSubmitted(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", table_number: "" });
      setIsSubmitting(false);
    } catch (error) {
      console.error("Unexpected error submitting order:", error);
      alert("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Case-insensitive, trimmed category filter
  const filteredItems =
    selectedCategory === "all"
      ? menuItems
      : menuItems.filter(
          (item) =>
            item.category &&
            item.category.trim().toLowerCase() ===
              selectedCategory.trim().toLowerCase(),
        );

  // Floating cart modal state for mobile
  const [showMobileCart, setShowMobileCart] = useState(false);

  // If not signed in and demoMenuItems is empty, show empty state
  if (!isLoggedIn && (!demoMenuItems || demoMenuItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome!
            </h2>
            <p className="text-gray-600 mb-4">
              Please sign in to view the menu and place an order.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ... rest of your rendering code unchanged ...
  // (All JSX below remains identical to your current code, including cart, checkout, etc.)

  // [for brevity, omitted here – keep your UI code exactly as you had it]
}

// Add these SVGs at the top of the file
const ApplePayButton = ({ selected, onClick }: { selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    className={`w-full h-12 flex items-center justify-center mb-2 rounded-lg transition-all border ${selected ? 'ring-2 ring-servio-purple border-servio-purple' : 'border-gray-300'}`}
    style={{
      background: "#000",
      minHeight: 48,
      padding: 0,
      outline: "none",
    }}
    aria-label="Apple Pay"
    tabIndex={0}
    onClick={onClick}
  >
    <img src="/assets/apple-pay-mark.svg" alt="Apple Pay" style={{ height: 32, width: "auto" }} />
  </button>
);

const GooglePayButton = ({ selected, onClick }: { selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    className={`w-full h-12 flex items-center justify-center mb-2 rounded-lg transition-all border ${selected ? 'ring-2 ring-servio-purple border-servio-purple' : 'border-gray-300'}`}
    style={{
      background: "#fff",
      minHeight: 48,
      padding: 0,
      outline: "none",
    }}
    aria-label="Google Pay"
    tabIndex={0}
    onClick={onClick}
  >
    <img src="/assets/google-pay-mark.svg" alt="Google Pay" style={{ height: 32, minHeight: 32, maxHeight: 32, width: "auto" }} />
  </button>
);
