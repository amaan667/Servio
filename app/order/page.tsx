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
      // Direct query: venue_id is the slug (TEXT field)
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueId)  // venue_id is TEXT, can be the slug directly
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

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Order Submitted!
            </h2>
            <p className="text-gray-600 mb-4">
              Your order has been received and is being prepared. You'll be notified when it's ready.
            </p>
            <Button
              onClick={() => setOrderSubmitted(false)}
              className="w-full"
            >
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingMenu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading menu...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Menu Unavailable
            </h2>
            <p className="text-gray-600 mb-4">{menuError}</p>
            <Button onClick={loadMenuItems} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
              <p className="text-sm text-gray-600">
                {isDemo ? "Demo Restaurant" : `Venue: ${venueId}`}
              </p>
            </div>
            
            {/* Desktop Cart Button */}
            <div className="hidden md:block">
              <Button
                variant="outline"
                onClick={() => setShowCheckout(true)}
                className="relative"
                disabled={cart.length === 0}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Cart ({getTotalItems()})
                {cart.length > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white">
                    ${getTotalPrice().toFixed(2)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category === "all" ? "All Items" : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video relative bg-gray-100">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-gray-400">No image</div>
                  </div>
                )}
                
                {/* Rating Badge */}
                {item.rating && (
                  <Badge className="absolute top-2 left-2 bg-white text-gray-900">
                    <Star className="w-3 h-3 mr-1 fill-current text-yellow-500" />
                    {item.rating}
                  </Badge>
                )}
                
                {/* Prep Time Badge */}
                {item.prep_time && (
                  <Badge variant="secondary" className="absolute top-2 right-2">
                    <Clock className="w-3 h-3 mr-1" />
                    {item.prep_time}m
                  </Badge>
                )}
              </div>
              
              <CardContent className="p-4">
                <div className="mb-2">
                  <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-green-600">
                      ${item.price.toFixed(2)}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {item.category}
                    </Badge>
                  </div>
                </div>
                
                {/* Cart Controls */}
                <div className="flex items-center justify-between">
                  {cart.find(cartItem => cartItem.id === item.id) ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="font-semibold">
                        {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => addToCart(item)}
                      className="w-full"
                    >
                      Add to Cart
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items found in this category.</p>
          </div>
        )}
      </div>

      {/* Mobile Cart Button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="p-4">
          <Button
            onClick={() => setShowMobileCart(true)}
            className="w-full relative"
            disabled={cart.length === 0}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            View Cart ({getTotalItems()})
            {cart.length > 0 && (
              <Badge className="ml-2 bg-white text-black">
                ${getTotalPrice().toFixed(2)}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Cart Modal */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="bg-white h-full overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Your Cart</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowMobileCart(false)}
                >
                  ✕
                </Button>
              </div>
            </div>
            
            <div className="p-4">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} className="border-b pb-4 mb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">{item.name}</h4>
                          <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-semibold">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <Textarea
                        placeholder="Special instructions..."
                        value={item.special_instructions || ""}
                        onChange={(e) => updateSpecialInstructions(item.id, e.target.value)}
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                  ))}
                  
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center text-lg font-bold mb-4">
                      <span>Total:</span>
                      <span>${getTotalPrice().toFixed(2)}</span>
                    </div>
                    
                    <Button
                      onClick={() => {
                        setShowMobileCart(false);
                        setShowCheckout(true);
                      }}
                      className="w-full"
                    >
                      Proceed to Checkout
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Checkout</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowCheckout(false)}
                >
                  ✕
                </Button>
              </div>

              {/* Order Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-600">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                        {item.special_instructions && (
                          <p className="text-xs text-gray-500 mt-1">
                            Note: {item.special_instructions}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>${getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <Input
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone Number *</label>
                    <Input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      placeholder="Your phone number"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Table Number</label>
                    <Input
                      type="number"
                      value={customerInfo.table_number}
                      onChange={(e) => setCustomerInfo({...customerInfo, table_number: e.target.value})}
                      placeholder="Table number (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Options */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
                <div className="space-y-3">
                  <ApplePayButton
                    selected={selectedPayment === "apple"}
                    onClick={() => setSelectedPayment("apple")}
                  />
                  
                  <GooglePayButton
                    selected={selectedPayment === "google"}
                    onClick={() => setSelectedPayment("google")}
                  />
                  
                  <button
                    type="button"
                    className={`w-full h-12 flex items-center justify-center rounded-lg border transition-all ${
                      selectedPayment === "card"
                        ? "ring-2 ring-blue-500 border-blue-500"
                        : "border-gray-300"
                    }`}
                    onClick={() => setSelectedPayment("card")}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Credit Card
                  </button>
                  
                  <button
                    type="button"
                    className={`w-full h-12 flex items-center justify-center rounded-lg border transition-all ${
                      selectedPayment === "cash"
                        ? "ring-2 ring-green-500 border-green-500"
                        : "border-gray-300"
                    }`}
                    onClick={() => setSelectedPayment("cash")}
                  >
                    <Smartphone className="w-5 h-5 mr-2" />
                    Pay at Counter
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={submitOrder}
                disabled={isSubmitting || !customerInfo.name || !customerInfo.phone || !selectedPayment}
                className="w-full h-12 text-lg"
              >
                {isSubmitting ? "Submitting..." : `Place Order - $${getTotalPrice().toFixed(2)}`}
              </Button>
            </div>
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
