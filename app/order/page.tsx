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
    const supabase = createClient();

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
    console.log(`Fetching menu for real venue: ${venueId}`);
    
    try {
      // Fetch menu items for this specific venue
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .eq("available", true)
        .order("category", { ascending: true });

      console.log("Menu items query:", {
        venueId,
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
      console.log(`Found ${availableItems.length} available items for venue ${venueId}`);
      
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
    if (!customerInfo.name.trim() || !customerInfo.phone.trim()) {
      alert("Please enter your name and phone number.");
      setIsSubmitting(false);
      return;
    }
    if (isDemo && !isLoggedIn) {
      setOrderSubmitted(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", table_number: "" });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          venue_id: venueId,
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
                    <span>£{(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="font-bold flex justify-between">
                <span>Total:</span>
                <span>£{getTotalPrice().toFixed(2)}</span>
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
          </div>
        ) : menuItems.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div>No menu items found. Please check back later.</div>
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
              <Card className="sticky top-24 hidden lg:block">
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
              {/* Floating cart button for mobile */}
              <div className="fixed bottom-4 right-4 z-50 lg:hidden">
                {cart.length > 0 && (
                  <Button
                    className="rounded-full shadow-lg px-6 py-3 text-lg flex items-center"
                    style={{ background: "#fff", border: "1px solid #eee" }}
                    onClick={() => setShowMobileCart(true)}
                  >
                    <ShoppingCart className="w-6 h-6 mr-2 text-servio-purple" />
                    <span>{getTotalItems()} · £{getTotalPrice().toFixed(2)}</span>
                  </Button>
                )}
              </div>
              {/* Mobile cart modal */}
              {showMobileCart && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end justify-center z-50 lg:hidden">
                  <div className="bg-white rounded-t-2xl shadow-lg w-full max-w-md mx-auto p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">Your Order</h2>
                      <Button variant="ghost" onClick={() => setShowMobileCart(false)}>
                        Close
                      </Button>
                    </div>
                    {cart.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Your cart is empty</p>
                    ) : (
                      <>
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
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-green-600">
                              £{getTotalPrice().toFixed(2)}
                            </span>
                          </div>
                        </div>
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
                        <Button
                          onClick={() => {
                            setShowCheckout(true);
                            setShowMobileCart(false);
                          }}
                          disabled={isSubmitting || cart.length === 0}
                          className="w-full mt-4"
                        >
                          Checkout
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
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
              <ApplePayButton selected={selectedPayment === "apple"} onClick={() => setSelectedPayment("apple")}/>
              <GooglePayButton selected={selectedPayment === "google"} onClick={() => setSelectedPayment("google")}/>
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
                setIsSubmitting(true);
                const prevOrderSubmitted = orderSubmitted;
                await submitOrder();
                setIsSubmitting(false);
                // Only close modal if orderSubmitted is now true (order was actually submitted)
                if (!prevOrderSubmitted && orderSubmitted) {
                  setShowCheckout(false);
                }
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
