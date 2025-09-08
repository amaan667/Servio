"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShoppingCart, Plus, Minus, X, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import React from "react";
import { demoMenuItems } from "@/data/demoMenuItems";

import { useRouter } from "next/navigation";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

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

  // Initialize page parameters
  useEffect(() => {
    
    // Log to server-side for deploy logs
    fetch('/api/log-order-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueSlug,
        tableNumber,
        isDemo,
        url: window.location.href
      })
    });
  }, [venueSlug, tableNumber, isDemo, searchParams]);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false); // Start with false for instant loading
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isDemoFallback, setIsDemoFallback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
  });

  // Add logging for customer info changes
  const updateCustomerInfo = (field: 'name' | 'phone', value: string) => {
    
    setCustomerInfo(prev => {
      const updated = { ...prev, [field]: value };
      return updated;
    });
  };
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [venueName, setVenueName] = useState<string>('Our Venue');

  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSession(user ? { user } : null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
              const mappedItems = demoMenuItems.map((item, idx) => ({
          ...item,
          id: `demo-${idx}`,
          available: true,
          price:
            typeof item.price === "number"
              ? item.price
              : Number(item.price) || 0,
        }));
        setMenuItems(mappedItems);
      setLoadingMenu(false);
      return;
    }

    try {
      if (!venueSlug) {
        setMenuError("Invalid or missing venue in QR link.");
        setLoadingMenu(false);
        return;
      }
      // Skip venue lookup since it's failing due to RLS - go straight to API call
      setVenueName('Cafe Nur'); // Set default venue name

      // Fetch menu items using the API endpoint (bypasses RLS)
      const apiUrl = `${window.location.origin}/api/menu/${venueSlug}`;
      
      const response = await fetch(apiUrl);
      
      
      if (!response.ok) {
        const errorData = await response.json();
        setMenuError(`Error loading menu: ${errorData.error || 'Failed to load menu'}`);
        setLoadingMenu(false);
        return;
      }

      const data = await response.json();
      
      // Attach venue_name for display
      const normalized = (data.menuItems || []).map((mi: any) => ({ 
        ...mi, 
        venue_name: data.venue?.name || 'Our Venue'
      }));
      
      
      setMenuItems(normalized);
      
      if (!data.menuItems || data.menuItems.length === 0) {
        setMenuError("This venue has no available menu items yet.");
      } else {
      }
      
      setLoadingMenu(false);
      // Clear the timeout since we successfully loaded the menu
      if ((window as any).menuLoadTimeout) {
        clearTimeout((window as any).menuLoadTimeout);
        (window as any).menuLoadTimeout = null;
      }
    } catch (err: any) {
      setMenuError(`Error loading menu: ${err.message}`);
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    loadMenuItems();
    
    // Remove artificial timeout - let real loading states handle this
    
    return () => {
      if ((window as any).menuLoadTimeout) {
        clearTimeout((window as any).menuLoadTimeout);
        (window as any).menuLoadTimeout = null;
      }
    };
  }, [venueSlug, isLoggedIn]);

  // Debug state changes
  useEffect(() => {
  }, [menuItems, loadingMenu, menuError]);

  // Auto-reset demo after 2 minutes for next user
  useEffect(() => {
    if (isDemo) {
      // Remove artificial demo reset timer - let users control their demo experience
      // Demo reset can be handled manually or through a button
    }
  }, [isDemo]);

  const addToCart = (item: MenuItem) => {
    
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        const updated = prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
        return updated;
      }
      const newCart = [...prev, { ...item, quantity: 1 }];
      return newCart;
    });
  };

  const removeFromCart = (itemId: string) => {
    
    setCart((prev) => {
      const newCart = prev.filter((item) => item.id !== itemId);
      return newCart;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart((prev) => {
      const newCart = prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      );
      return newCart;
    });
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

  const resetCart = () => {
    setCart([]);
  };

  const submitOrder = async () => {
    
    if (!customerInfo.name.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!customerInfo.phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    setIsSubmitting(true);
      try {
        const safeTable = parseInt(tableNumber) || 1;

      // For demo orders, redirect to checkout with demo mode
      if (isDemo || isDemoFallback || venueSlug === 'demo-cafe') {
        
        // For demo orders, use the same flow as real orders but with demo mode
        const orderData = {
          venueId: 'demo-cafe',
          venueName: 'Servio Café',
          tableNumber: safeTable,
          customerName: customerInfo.name.trim(),
          customerPhone: customerInfo.phone.trim(),
          cart: cart.map((item) => ({
            id: item.id && item.id.startsWith('demo-') ? null : item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions || null,
            image: (item as any).image || null,
          })),
          total: getTotalPrice(),
          notes: cart
            .filter((item) => item.specialInstructions)
            .map((item) => `${item.name}: ${item.specialInstructions}`)
            .join("; "),
        };

        
        // Store order data in localStorage for order summary page
        localStorage.setItem('servio-pending-order', JSON.stringify(orderData));
        
        // Verify storage
        const storedPending = localStorage.getItem('servio-pending-order');
        
        // Redirect to order summary page
        
        // Clear loading state before navigation
        setIsSubmitting(false);
        
        // Use window.location for reliable navigation
        if (typeof window !== 'undefined') {
          window.location.href = '/order-summary';
        } else {
        }
        
        return;
      }

      // For real orders, store order data and redirect to unified checkout page
      
      // Order will only be created after successful payment
      const orderData = {
        venueId: venueSlug, // Changed from venue_id to venueId
        venueName: 'Restaurant', // You might want to fetch this from the venue data
        tableNumber: safeTable, // Changed from table_number to tableNumber
        customerName: customerInfo.name.trim(), // Changed from customer_name to customerName
        customerPhone: customerInfo.phone.trim(), // Changed from customer_phone to customerPhone
        cart: cart.map((item) => ({
          id: item.id && item.id.startsWith('demo-') ? null : item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
          image: (item as any).image || null,
        })),
        total: getTotalPrice(),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
      };

      
      // Store order data in localStorage for order summary page
      localStorage.setItem('servio-pending-order', JSON.stringify(orderData));
      
      // Verify storage
      const storedPending = localStorage.getItem('servio-pending-order');
      
      // Redirect to order summary page - customer can choose to pay now or later
      
      // Clear loading state before navigation
      setIsSubmitting(false);
      
      // Use window.location for reliable navigation
      if (typeof window !== 'undefined') {
        window.location.href = '/order-summary';
      } else {
      }
    } catch (error) {
      console.error('[ORDER SUBMIT] ERROR: Error preparing order:', error);
      console.error('[ORDER SUBMIT] ERROR: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      alert("Failed to prepare order. Please try again.");
      setIsSubmitting(false);
    }
  };





  return (
    <div className="min-h-screen bg-gray-50">
        {/* Demo Fallback Notification */}
        {isDemo && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-purple-700">🎯 Demo Mode:</span>
                    <span className="ml-2 text-purple-600">Experience Servio Café's full ordering flow with payment simulation</span>
                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Interactive Preview</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetCart}
                      className="text-xs"
                    >
                      Reset Cart
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCart([]);
                        setCustomerInfo({ name: '', phone: '' });
                        setShowCheckout(false);
                        setShowMobileCart(false);
                      }}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      🔄 Reset Demo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Breadcrumb Navigation for Demo */}
          {isDemo && (
            <div className="mb-4">
              <NavigationBreadcrumb 
                customBackPath="/dashboard" 
                customBackLabel="Dashboard"
                showBackButton={true}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Servio Logo */}
              <div className="flex items-center">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={300}
                  height={90}
                  className="h-20 w-auto"
                  priority
                />
              </div>
              
              {/* Business Name and Table */}
              <div className="ml-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {isDemo ? "Servio Café" : venueName}
                </h1>
                <p className="text-gray-600">Table {tableNumber}</p>
              </div>
            </div>
            
            {/* Mobile Cart Button */}
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
        {(() => {
          
          // Remove loading check - render immediately
          
          if (menuError) {
            return (
              <Alert variant="destructive">
                <AlertDescription>{menuError}</AlertDescription>
              </Alert>
            );
          }
          
          if (menuItems.length === 0) {
            return (
              <div className="text-center py-12">
                <p className="text-gray-600">No menu items available.</p>
              </div>
            );
          }
          
          return (
              <div className="space-y-6">
                {(() => {
                  const categoryPriority = [
                    "starters", "starter", "appetizers", "appetizer", "entrees", "main courses", "main course",
                    "mains", "main", "salads", "salad", "sides", "side", "desserts", "dessert",
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
                                <div className="flex space-x-4">
                                  {/* Item Image */}
                                  {item.image && (
                                    <div className="flex-shrink-0">
                                      <Image
                                        src={item.image}
                                        alt={item.name}
                                        width={80}
                                        height={80}
                                        className="w-20 h-20 object-cover rounded-lg"
                                        onError={(e) => {
                                          // Hide image if it fails to load
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {/* Item Details */}
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
                                  
                                  {/* Add to Cart Button */}
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
            );
          })()}
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
                        <div className="flex space-x-3">
                          {/* Cart Item Details */}
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
                        <div className="flex space-x-3">
                          {/* Mobile Cart Item Details */}
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
                    updateCustomerInfo('name', e.target.value)
                  }
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <Input
                  value={customerInfo.phone}
                  onChange={(e) =>
                    updateCustomerInfo('phone', e.target.value)
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
                    onClick={() => {
                      submitOrder();
                    }}
                    className="flex-1"
                    disabled={isSubmitting || !customerInfo.name.trim() || !customerInfo.phone.trim()}
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


