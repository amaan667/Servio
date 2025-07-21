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
import { createClient } from "@/lib/supabase";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

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
  // Use the correct venue_id from the database schema
  const venueId = "demo-cafe";

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
    loadMenuItems();
  }, [hasSupabaseConfig]);

  useEffect(() => {
    // Demo mode: if demo=1 in URL, pre-populate cart with sample items
    const demo = searchParams?.get("demo");
    if (demo === "1") {
      const demoItems: CartItem[] = [
        {
          id: "1",
          name: "Margherita Pizza",
          description: "Classic pizza with tomato, mozzarella, and basil.",
          price: 10.99,
          category: "Restaurant",
          available: true,
          quantity: 2,
        },
        {
          id: "2",
          name: "Flat White",
          description: "Rich espresso with steamed milk.",
          price: 3.5,
          category: "Coffee Shop",
          available: true,
          quantity: 1,
        },
        {
          id: "3",
          name: "Chicken Shawarma Wrap",
          description: "Grilled chicken, salad, and garlic sauce in a wrap.",
          price: 7.0,
          category: "Food Truck",
          available: true,
          quantity: 1,
        },
        {
          id: "4",
          name: "Avocado Toast",
          description: "Sourdough toast with smashed avocado and chili flakes.",
          price: 5.5,
          category: "Cafe",
          available: true,
          quantity: 1,
        },
      ];
      setCart(demoItems);
    }
  }, [searchParams]);

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    setMenuError(null);
    const supabase = createClient();

    // Try different venue IDs in order of preference
    const venueIds = [
      "demo-cafe",
      "pizza-palace",
      "c9413421-af4a-43d8-b783-3e3232b7e7e7",
    ];

    for (const currentVenueId of venueIds) {
      try {
        console.log(`Trying venue_id: ${currentVenueId}`);

        // First, let's check if the venue exists
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select("venue_id, name")
          .eq("venue_id", currentVenueId)
          .single();

        console.log("Venue check:", { venueData, venueError });

        // Now fetch menu items
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", currentVenueId)
          .order("category", { ascending: true });

        console.log("Menu items query:", {
          venueId: currentVenueId,
          data: data?.length || 0,
          error,
          availableItems: data?.filter((item) => item.available)?.length || 0,
        });

        if (error) {
          console.error("Supabase error:", error);
          continue; // Try next venue_id
        } else if (data && data.length > 0) {
          // Filter for available items
          const availableItems = data.filter((item) => item.available);
          console.log("Available items:", availableItems.length);

          if (availableItems.length > 0) {
            setMenuItems(availableItems);
            setLoadingMenu(false);
            return; // Success, exit the function
          }
        }

        // If we get here, try without venue_id filter to see if RLS is the issue
        const { data: allData, error: allError } = await supabase
          .from("menu_items")
          .select("*")
          .order("category", { ascending: true });

        console.log("All menu items (no venue filter):", {
          data: allData?.length || 0,
          error: allError,
          availableItems:
            allData?.filter((item) => item.available)?.length || 0,
        });

        if (!allError && allData && allData.length > 0) {
          const availableItems = allData.filter((item) => item.available);
          if (availableItems.length > 0) {
            setMenuItems(availableItems);
            setLoadingMenu(false);
            return; // Success, exit the function
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        continue; // Try next venue_id
      }
    }

    // If we get here, no venue worked
    setMenuError(
      "No menu items found for any venue. Please check the database connection.",
    );
    setMenuItems([]);
    setLoadingMenu(false);
  };

  const debugMenu = async () => {
    console.log("=== DEBUG MENU ===");

    // Check environment variables first
    console.log("Environment check:", {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + "...",
    });

    // Test if we can create a client
    try {
      const supabase = createClient();
      console.log("✅ Supabase client created successfully");

      // Check all venues
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("*");

      console.log("All venues:", venues, venuesError);

      // Check all menu items
      const { data: allMenuItems, error: menuError } = await supabase
        .from("menu_items")
        .select("*");

      console.log("All menu items:", allMenuItems?.length || 0, menuError);

      // Check specific venue
      const { data: specificVenue, error: specificError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", "demo-cafe");

      console.log(
        "Demo cafe items:",
        specificVenue?.length || 0,
        specificError,
      );

      // Test RLS by trying to insert a test record (should fail but tell us about permissions)
      try {
        const { data: testInsert, error: testError } = await supabase
          .from("menu_items")
          .insert({
            venue_id: "test-venue",
            name: "Test Item",
            price: 9.99,
            category: "test",
            available: true,
          })
          .select();

        console.log("RLS test (insert):", testInsert, testError);
      } catch (e) {
        console.log("RLS test error:", e);
      }
    } catch (error) {
      console.error("❌ Failed to create Supabase client:", error);
      console.log(
        "This means the environment variables are not set correctly.",
      );
    }
  };

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
    // Prevent order submission in demo mode
    const demo = searchParams?.get("demo");
    if (demo === "1") {
      alert("This is a demo. Orders are not submitted.");
      setOrderSubmitted(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", table_number: "" });
      return;
    }

    if (!customerInfo.name || !customerInfo.phone) {
      alert("Please fill in your name and phone number");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerInfo.name,
          customer_phone: customerInfo.phone,
          table_number: customerInfo.table_number || null,
          total_amount: getTotalPrice(),
          status: "pending",
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

      if (orderError) throw orderError;

      setOrderSubmitted(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", table_number: "" });
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
    } finally {
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

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Order Confirmed!
            </h2>
            <p className="text-gray-600 mb-4">
              Your order is on its way to the kitchen.
            </p>
            <div className="text-left mb-4">
              <h3 className="font-semibold mb-2">Order Summary:</h3>
              <ul className="mb-2">
                {cart.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between text-sm mb-1"
                  >
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="font-bold flex justify-between">
                <span>Total:</span>
                <span>${getTotalPrice().toFixed(2)}</span>
              </div>
            </div>
            <Button onClick={() => setOrderSubmitted(false)} className="w-full">
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Menu
                {customerInfo.table_number
                  ? ` (Table ${customerInfo.table_number})`
                  : ""}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{getTotalItems()} items</span>
              <span className="text-green-600 font-bold">
                £{getTotalPrice().toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loadingMenu ? (
          <div className="text-center text-gray-500 py-12">Loading menu...</div>
        ) : menuError ? (
          <div className="text-center text-red-500 py-12">
            <div>{menuError}</div>
            {!hasSupabaseConfig && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  Missing Environment Variables
                </h3>
                <p className="text-yellow-700 text-sm mb-2">
                  You need to set up your Supabase environment variables:
                </p>
                <code className="text-xs bg-yellow-100 p-2 rounded block">
                  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
                  <br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
                </code>
              </div>
            )}
            <Button onClick={debugMenu} className="mt-4" variant="outline">
              Debug Database Connection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Menu Items */}
            <div className="lg:col-span-2">
              {/* Category Filter */}
              <div className="flex space-x-2 mb-6 overflow-x-auto">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? "default" : "outline"
                    }
                    onClick={() => setSelectedCategory(category)}
                    className="whitespace-nowrap capitalize"
                  >
                    {category}
                  </Button>
                ))}
              </div>
              {/* Menu Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <div className="flex items-center space-x-1">
                          {item.rating && (
                            <>
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm text-gray-600">
                                {item.rating}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-bold text-green-600">
                          £{item.price.toFixed(2)}
                        </span>
                        {item.prep_time && (
                          <div className="flex items-center text-gray-500 text-sm">
                            <Clock className="w-4 h-4 mr-1" />
                            {item.prep_time} min
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="capitalize">
                          {item.category}
                        </Badge>
                        <div className="flex items-center space-x-2">
                          {cart.find((cartItem) => cartItem.id === item.id) ? (
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="font-medium">
                                {
                                  cart.find(
                                    (cartItem) => cartItem.id === item.id,
                                  )?.quantity
                                }
                              </span>
                              <Button size="sm" onClick={() => addToCart(item)}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => addToCart(item)}>
                              Add to Cart
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            {/* Cart & Checkout */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Your Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Your cart is empty
                    </p>
                  ) : (
                    <>
                      {/* Cart Items */}
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="border-b pb-3">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{item.name}</h4>
                              <span className="font-bold">
                                £{(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(item.id)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span>{item.quantity}</span>
                                <Button
                                  size="sm"
                                  onClick={() => addToCart(item)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                              <span className="text-sm text-gray-600">
                                £{item.price.toFixed(2)} each
                              </span>
                            </div>
                            <Textarea
                              placeholder="Special instructions..."
                              value={item.special_instructions || ""}
                              onChange={(e) =>
                                updateSpecialInstructions(
                                  item.id,
                                  e.target.value,
                                )
                              }
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                      {/* Total */}
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span className="text-green-600">
                            £{getTotalPrice().toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {/* Customer Info */}
                      <div className="space-y-3 border-t pt-3">
                        <Input
                          placeholder="Your name *"
                          value={customerInfo.name}
                          onChange={(e) =>
                            setCustomerInfo((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="Phone number *"
                          value={customerInfo.phone}
                          onChange={(e) =>
                            setCustomerInfo((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="Table number (optional)"
                          value={customerInfo.table_number}
                          onChange={(e) =>
                            setCustomerInfo((prev) => ({
                              ...prev,
                              table_number: e.target.value,
                            }))
                          }
                        />
                      </div>
                      {/* Checkout Button */}
                      <Button
                        onClick={() => setShowCheckout(true)}
                        disabled={isSubmitting || cart.length === 0}
                        className="w-full"
                      >
                        Checkout
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Choose Payment Method</h2>
            <div className="flex flex-col space-y-3 mb-6">
              <Button
                variant={selectedPayment === "apple" ? "default" : "outline"}
                onClick={() => setSelectedPayment("apple")}
                className="flex items-center space-x-2"
              >
                <Apple className="w-5 h-5 mr-2" /> Apple Pay
              </Button>
              <Button
                variant={selectedPayment === "google" ? "default" : "outline"}
                onClick={() => setSelectedPayment("google")}
                className="flex items-center space-x-2"
              >
                <Smartphone className="w-5 h-5 mr-2" /> Google Pay
              </Button>
              <Button
                variant={selectedPayment === "card" ? "default" : "outline"}
                onClick={() => setSelectedPayment("card")}
                className="flex items-center space-x-2"
              >
                <CreditCard className="w-5 h-5 mr-2" /> Card / Stripe
              </Button>
            </div>
            <Button
              className="w-full mb-2"
              disabled={!selectedPayment}
              onClick={async () => {
                setShowCheckout(false);
                setIsSubmitting(true);
                await submitOrder();
                setIsSubmitting(false);
                setOrderSubmitted(true);
              }}
            >
              Pay & Place Order
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCheckout(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
