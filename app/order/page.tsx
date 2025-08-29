"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShoppingCart, Plus, Minus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import React from "react";
import { demoMenuItems } from "@/data/demoMenuItems";
import OrderFeedbackForm from "@/components/OrderFeedbackForm";

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  venue_name?: string; // added for display in header when loaded with join
  options?: Array<{ label: string; values: string[] }>; // modifiers/options
}

interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
}

export default function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams?.get("venue") || "";
  const tableNumber = searchParams?.get("table") || "1";
  const isDemo = searchParams?.get("demo") === "1";

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isDemoFallback, setIsDemoFallback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
  });
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await createClient().auth.getSession();
      setSession(session);
    };
    getSession();

    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isLoggedIn = !!session;

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    setMenuError(null);
    setIsDemoFallback(false);

    // Explicit demo only
    if (isDemo) {
      console.log("Loading demo menu items");
      setMenuItems(
        demoMenuItems.map((item, idx) => ({
          ...item,
          id: `demo-${idx}`,
          available: true,
          price:
            typeof item.price === "number"
              ? item.price
              : parseFloat(String(item.price).replace(/[^0-9.]/g, "")) || 0,
        }))
      );
      setLoadingMenu(false);
      return;
    }

    try {
      if (!venueSlug) {
        setMenuError("Invalid or missing venue in QR link.");
        setLoadingMenu(false);
        return;
      }
      // First check if venue exists
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("venue_id", venueSlug)
        .single();

      if (venueError || !venue) {
        setMenuError("Venue not found.");
        setLoadingMenu(false);
        return;
      }

      // Fetch menu items for the venue
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, venues!inner(name)")
        .eq("venue_id", venueSlug)
        .eq("available", true);

      if (error) {
        setMenuError(`Error loading menu: ${error.message}`);
        setLoadingMenu(false);
        return;
      }

      // Attach venue_name for display
      const normalized = (data || []).map((mi: any) => ({ ...mi, venue_name: mi.venues?.name }));
      setMenuItems(normalized);
      if (!data || data.length === 0) {
        setMenuError("This venue has no available menu items yet.");
      }
      setLoadingMenu(false);
    } catch (err: any) {
      setMenuError(`Error loading menu: ${err.message}`);
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    loadMenuItems();
  }, [venueSlug, isLoggedIn]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, specialInstructions: instructions } : item
      )
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
    if (!customerInfo.name.trim()) {
      alert("Please enter your name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const safeTable = parseInt(tableNumber) || 1;

      // For demo orders, create immediately
      if (isDemo || isDemoFallback || venueSlug === 'demo-cafe') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setOrderSubmitted(true);
        setSubmittedOrder({ id: null, items: cart, total: getTotalPrice(), table_number: safeTable, venue_id: venueSlug });
        setCart([]);
        setShowCheckout(false);
        return;
      }

      // For real orders, store order data and show payment first
      const orderData = {
        venue_id: venueSlug,
        table_number: safeTable,
        customer_name: customerInfo.name.trim(),
        customer_phone: customerInfo.phone || undefined,
        items: cart.map((item) => ({
          menu_item_id: item.id && item.id.startsWith('demo-') ? null : item.id,
          quantity: item.quantity,
          unit_price: item.price,
          item_name: item.name,
          special_instructions: item.specialInstructions || null,
        })),
        total_amount: getTotalPrice(),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
      };

      // Store order data for payment confirmation
      setSubmittedOrder({ 
        id: null, 
        items: cart, 
        total: getTotalPrice(), 
        table_number: safeTable, 
        venue_id: venueSlug,
        pendingOrderData: orderData 
      });
      setOrderSubmitted(true);
      setCart([]);
      setShowCheckout(false);
    } catch (error) {
      console.error("Error preparing order:", error);
      alert("Failed to prepare order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (orderData: any) => {
    try {
      // Now create the actual order in the database
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      const out = await res.json().catch(() => ({} as any));
      
      if (!res.ok || !out?.ok) {
        console.error('Order API failed', out);
        alert(out?.error || 'Failed to confirm order. Please contact support.');
        return;
      }
      
      console.log('Order confirmed after payment', out);
      
      // Update the submitted order with the real ID
      setSubmittedOrder((prev: any) => ({ 
        ...prev, 
        id: out?.order?.id,
        pendingOrderData: undefined 
      }));
      
    } catch (error) {
      console.error("Error confirming order:", error);
      alert("Failed to confirm order. Please contact support.");
    }
  };

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {submittedOrder?.id ? 'Order Confirmed' : 'Complete Payment'}
              </CardTitle>
              <CardDescription>
                {submittedOrder?.id 
                  ? 'Thank you! Your order is on its way.' 
                  : 'Please complete payment to confirm your order.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Order Summary</h3>
                <div className="space-y-2">
                  {(submittedOrder?.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{it.name}</span>
                        <span className="ml-2 text-gray-500">× {it.quantity}</span>
                      </div>
                      <div>£{(it.price * it.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
                    <span>Total</span>
                    <span>£{Number(submittedOrder?.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {!submittedOrder?.id && submittedOrder?.pendingOrderData ? (
                <div className="space-y-2">
                  <h3 className="font-semibold">Order Submitted</h3>
                  <p className="text-sm text-gray-600">Your order has been submitted successfully. Payment will be handled at the venue.</p>
                </div>
              ) : null}

              {submittedOrder?.id ? (
                <OrderFeedbackForm venueId={submittedOrder.venue_id} orderId={submittedOrder.id} />
              ) : null}

              <div className="pt-2">
                <Button
                  onClick={() => { setOrderSubmitted(false); setSubmittedOrder(null); loadMenuItems(); }}
                  variant="outline"
                  className="w-full"
                >
                  Place Another Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Demo Fallback Notification */}
        {isDemo && (
          <div className="bg-blue-50 border-b border-blue-200">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <div className="flex items-center justify-center text-sm text-blue-700">
                <span className="font-medium">Demo Mode:</span>
                <span className="ml-1">You're viewing a sample menu.</span>
              </div>
            </div>
          </div>
        )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isDemo ? "Demo Cafe" : (menuItems[0]?.venue_name || 'Our Venue')}
              </h1>
              <p className="text-gray-600">Table {tableNumber}</p>
            </div>
            <Button
              onClick={() => setShowMobileCart(!showMobileCart)}
              className="md:hidden"
              size="sm"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {getTotalItems()}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu */}
          <div className="lg:col-span-2">
        {loadingMenu ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
        ) : menuError ? (
              <Alert variant="destructive">
                <AlertDescription>{menuError}</AlertDescription>
              </Alert>
        ) : menuItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No menu items available.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const categoryPriority = [
                    "starters", "starter", "appetizers", "appetizer", "entrees", "main courses", "main course",
                    "mains", "main", "salads", "salad", "sides", "side dishes", "desserts", "dessert",
                    "drinks", "beverages", "coffee", "tea", "wine", "beer", "cocktails", "soft drinks"
                  ];
                  const categories = Array.from(new Set(menuItems.map((i) => i.category)));
                  const sortedCats = categories.sort((a,b)=>{
                    const aIdx = categoryPriority.findIndex(p => (a||'').toLowerCase().includes(p));
                    const bIdx = categoryPriority.findIndex(p => (b||'').toLowerCase().includes(p));
                    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                    if (aIdx !== -1) return -1;
                    if (bIdx !== -1) return 1;
                    return String(a||'').localeCompare(String(b||''));
                  });
                  return sortedCats.map((category) => (
                    <div key={category}>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
                        {category}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {menuItems
                          .filter((item) => item.category === category)
                          .sort((a,b)=> String(a.name).localeCompare(String(b.name)))
                          .map((item) => (
                            <Card key={item.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                      {item.name}
                                    </h3>
                                    {item.description && (
                                      <p className="text-sm text-gray-600 mt-1">
                                        {item.description}
                                      </p>
                                    )}
                                    <p className="text-lg font-bold text-purple-600 mt-2">
                                      £{item.price.toFixed(2)}
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => addToCart(item)}
                                    size="sm"
                                    className="ml-4"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Desktop Cart */}
          <div className="hidden lg:block">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Your Order
                </CardTitle>
                <CardDescription>
                  {getTotalItems()} items • £{getTotalPrice().toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Your cart is empty. Add some items to get started!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="border-b pb-4 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {item.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              £{item.price.toFixed(2)} each
                            </p>
                            {item.specialInstructions && (
                              <p className="text-xs text-gray-500 mt-1">
                                Note: {item.specialInstructions}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              size="sm"
                              variant="outline"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              size="sm"
                              variant="outline"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => removeFromCart(item.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          placeholder="Special instructions (optional)"
                          value={item.specialInstructions || ""}
                          onChange={(e) =>
                            updateSpecialInstructions(item.id, e.target.value)
                          }
                          className="mt-2 text-xs"
                          rows={2}
                        />
                      </div>
                    ))}

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-xl font-bold text-purple-600">
                          £{getTotalPrice().toFixed(2)}
                        </span>
                      </div>

                      <Button
                        onClick={() => setShowCheckout(true)}
                        className="w-full"
                        disabled={cart.length === 0}
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile Floating Cart Button */}
        <div className="lg:hidden fixed bottom-4 right-4 z-40">
          <Button
            onClick={() => setShowMobileCart(true)}
            className="rounded-full w-14 h-14 shadow-lg relative"
            disabled={cart.length === 0}
          >
            <ShoppingCart className="h-6 w-6" />
            {getTotalItems() > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {getTotalItems()}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile Cart Modal */}
        {showMobileCart && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Your Order</h3>
                    <p className="text-sm text-gray-600">
                      {getTotalItems()} items • £{getTotalPrice().toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileCart(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Your cart is empty. Add some items to get started!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="border-b pb-4 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {item.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              £{item.price.toFixed(2)} each
                            </p>
                            {item.specialInstructions && (
                              <p className="text-xs text-gray-500 mt-1">
                                Note: {item.specialInstructions}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              size="sm"
                              variant="outline"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              size="sm"
                              variant="outline"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => removeFromCart(item.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          placeholder="Special instructions (optional)"
                          value={item.specialInstructions || ""}
                          onChange={(e) =>
                            updateSpecialInstructions(item.id, e.target.value)
                          }
                          className="mt-2 text-xs"
                          rows={2}
                        />
                      </div>
                    ))}

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-xl font-bold text-purple-600">
                          £{getTotalPrice().toFixed(2)}
                        </span>
                      </div>

                      <Button
                        onClick={() => {
                          setShowMobileCart(false);
                          setShowCheckout(true);
                        }}
                        className="w-full"
                        disabled={cart.length === 0}
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Complete Your Order</CardTitle>
              <CardDescription>
                Enter your details to complete the order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  value={customerInfo.name}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, name: e.target.value })
                  }
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number (optional)
                </label>
                <Input
                  value={customerInfo.phone}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, phone: e.target.value })
                  }
                  placeholder="Enter your phone number"
                  type="tel"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-purple-600">
                    £{getTotalPrice().toFixed(2)}
                  </span>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => setShowCheckout(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitOrder}
                    className="flex-1"
                    disabled={isSubmitting || !customerInfo.name.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Order"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


