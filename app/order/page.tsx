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
import { MenuItem as BaseMenuItem } from "@/lib/supabase";

// Local MenuItem interface for order page (extends global but makes some properties optional)
interface MenuItem extends Omit<BaseMenuItem, 'venue_id' | 'created_at'> {
  venue_id?: string;
  created_at?: string;
  venue_name?: string; // added for display in header when loaded with join
  options?: Array<{ label: string; values: string[] }>; // modifiers/options
}

interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
}

export default function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams?.get("venue") || "venue-1e02af4d"; // Default to known venue
  const tableNumber = searchParams?.get("table") || "1";
  const counterNumber = searchParams?.get("counter") || "";
  const isDemo = searchParams?.get("demo") === "1";
  
  // Determine if this is a counter order or table order
  const isCounterOrder = !!counterNumber;
  const orderLocation = isCounterOrder ? counterNumber : tableNumber;
  const orderType = isCounterOrder ? "counter" : "table";

  // Initialize page parameters and check for existing orders
  useEffect(() => {
    
    // Log to server-side for deploy logs
    fetch('/api/log-order-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueSlug,
        tableNumber,
        counterNumber,
        orderType,
        orderLocation,
        isDemo,
        url: window.location.href
      })
    });

    // Check for existing unpaid orders for this table/session
    checkForExistingOrder();
  }, [venueSlug, tableNumber, counterNumber, orderType, orderLocation, isDemo, searchParams]);

  const checkForExistingOrder = async () => {
    try {
      // Check if there's a session parameter in the URL
      const sessionParam = searchParams?.get('session');
      
      if (sessionParam) {
        console.log('[ORDER PAGE] Checking for existing order with session:', sessionParam);
        
        // Check localStorage for existing order data with this session
        const storedOrderData = localStorage.getItem(`servio-order-${sessionParam}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);
          console.log('[ORDER PAGE] Found existing unpaid order in localStorage:', orderData);
          
          // Redirect to payment page with existing order data
          const checkoutData = {
            venueId: orderData.venueId,
            venueName: 'Restaurant',
            tableNumber: orderData.tableNumber,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            cart: orderData.cart || [],
            total: orderData.total,
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            sessionId: sessionParam,
          };
          
          localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
          window.location.href = '/payment';
          return;
        }
      }
      
      // Also check localStorage for any existing session data
      const storedSession = localStorage.getItem('servio-current-session');
      if (storedSession && !sessionParam) {
        console.log('[ORDER PAGE] Checking localStorage session:', storedSession);
        
        const storedOrderData = localStorage.getItem(`servio-order-${storedSession}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);
          console.log('[ORDER PAGE] Found existing unpaid order in localStorage session:', orderData);
          
          const checkoutData = {
            venueId: orderData.venueId,
            venueName: 'Restaurant',
            tableNumber: orderData.tableNumber,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            cart: orderData.cart || [],
            total: orderData.total,
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            sessionId: storedSession,
          };
          
          localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
          window.location.href = '/payment';
          return;
        }
      }
      
    } catch (error) {
      console.error('[ORDER PAGE] Error checking for existing order:', error);
      // Continue with normal flow if check fails
    }
  };

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

    // Check for existing unpaid orders
    const checkUnpaidOrders = () => {
      // Check for table-based session
      const tableSessionKey = `servio-session-${tableNumber}`;
      const tableSessionData = localStorage.getItem(tableSessionKey);
      
      // Check for session-based session (if sessionId exists in URL)
      const sessionId = searchParams?.get('sessionId');
      const sessionSessionKey = sessionId ? `servio-session-${sessionId}` : null;
      const sessionSessionData = sessionSessionKey ? localStorage.getItem(sessionSessionKey) : null;
      
      const sessionData = tableSessionData || sessionSessionData;
      
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          console.log('[ORDER PAGE] Found existing session:', session);
          
          // If there's an unpaid order, redirect to order summary
          if (session.paymentStatus === 'unpaid' || session.paymentStatus === 'till') {
            console.log('[ORDER PAGE] Unpaid order detected, redirecting to summary...');
            
            // Store the session data for the summary page
            localStorage.setItem('servio-unpaid-order', JSON.stringify(session));
            
            // Redirect to order summary page
            router.push(`/order-summary?${isCounterOrder ? 'counter' : 'table'}=${orderLocation}&session=${session.orderId}`);
            return;
          }
          
          // If paid order, show checkout form for new order
          setShowCheckout(true);
          setCustomerInfo({
            name: session.customerName,
            phone: session.customerPhone
          });
          
        } catch (error) {
          console.error('[ORDER PAGE] Error parsing session data:', error);
        }
      }
    };

    checkUnpaidOrders();

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
    // Customer details are now collected in the checkout modal, not here

    // Validate order data before submission
    if (!customerInfo.name.trim()) {
      alert("Please enter your name before placing the order.");
      return;
    }
    
    if (!customerInfo.phone.trim()) {
      alert("Please enter your phone number before placing the order.");
      return;
    }
    
    if (cart.length === 0) {
      alert("Your cart is empty. Please add items before placing the order.");
      return;
    }
    
    if (!venueSlug) {
      alert("Invalid venue. Please check your QR code and try again.");
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
          tableNumber: parseInt(orderLocation) || 1, // Use orderLocation for consistency
          counterNumber: counterNumber,
          orderType: orderType,
          orderLocation: orderLocation,
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
        console.log('[ORDER PAGE DEBUG] Storing order data for summary:', orderData);
        localStorage.setItem('servio-pending-order', JSON.stringify(orderData));
        
        // Verify storage
        const storedPending = localStorage.getItem('servio-pending-order');
        console.log('[ORDER PAGE DEBUG] Verified stored data:', storedPending);
        
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

      // For real orders, create the order immediately in the database
      console.log('[ORDER SUBMIT] Creating order immediately...');
      
      // Generate session ID for this order
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session in localStorage for future QR scans
      localStorage.setItem('servio-current-session', sessionId);
      
      const orderData = {
        venue_id: venueSlug,
        table_number: safeTable,
        counter_number: counterNumber,
        order_type: orderType,
        order_location: orderLocation,
        customer_name: customerInfo.name.trim(),
        customer_phone: customerInfo.phone.trim(),
        items: cart.map((item) => ({
          menu_item_id: item.id && item.id.startsWith('demo-') ? 'demo-item' : item.id || 'unknown',
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          specialInstructions: item.specialInstructions || null,
        })),
        total_amount: getTotalPrice(),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
        order_status: 'PLACED',
        payment_status: 'UNPAID', // Start as unpaid
        payment_method: null, // Will be updated based on payment choice
        session_id: sessionId,
        source: orderType === 'counter' ? 'counter' : 'qr',
      };

      // Create the order immediately via API
      console.log('[ORDER SUBMIT] Calling orders API...');
      console.log('[ORDER SUBMIT] Order data being sent:', JSON.stringify(orderData, null, 2));
      console.log('[ORDER SUBMIT] Validation check - venueSlug:', venueSlug);
      console.log('[ORDER SUBMIT] Validation check - customerName:', customerInfo.name.trim());
      console.log('[ORDER SUBMIT] Validation check - customerPhone:', customerInfo.phone.trim());
      console.log('[ORDER SUBMIT] Validation check - cart length:', cart.length);
      console.log('[ORDER SUBMIT] Validation check - total amount:', getTotalPrice());
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      console.log('[ORDER SUBMIT] API response status:', response.status);
      console.log('[ORDER SUBMIT] API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ORDER SUBMIT] API error response:', errorData);
        throw new Error(errorData.error || `Failed to create order (${response.status})`);
      }

      const orderResult = await response.json();
      console.log('[ORDER SUBMIT] Order created successfully:', orderResult);
      
      // Check if a table was auto-created
      if (orderResult.table_auto_created) {
        console.log('[ORDER SUBMIT] Table was auto-created for QR code:', orderResult.table_id);
      }

      // Store order data with order ID for payment page
      const checkoutData = {
        venueId: venueSlug,
        venueName: 'Restaurant',
        tableNumber: parseInt(orderLocation) || 1, // Use orderLocation to handle both counter and table numbers
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
        orderId: orderResult.data?.id || orderResult.id, // Include the created order ID
        orderNumber: orderResult.data?.order_number || orderResult.order_number,
        sessionId: sessionId, // Include session ID for resume functionality
        orderType: orderType, // Include order type for source determination
      };

      // Store checkout data for payment page
      localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
      
      // Store order data in localStorage for session management (since session_id column doesn't exist in DB yet)
      const orderDataForSession = {
        venueId: venueSlug,
        tableNumber: parseInt(orderLocation) || 1, // Use orderLocation to handle both counter and table numbers
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
        orderId: orderResult.data?.id || orderResult.id,
        orderNumber: orderResult.data?.order_number || orderResult.order_number,
        sessionId: sessionId,
        paymentStatus: 'unpaid'
      };
      
      localStorage.setItem(`servio-order-${sessionId}`, JSON.stringify(orderDataForSession));
      
      // Clear loading state before navigation
      setIsSubmitting(false);
      
      // Redirect to payment page where they can choose payment method
      if (typeof window !== 'undefined') {
        window.location.href = '/payment';
      }
    } catch (error) {
      console.error('[ORDER SUBMIT] ERROR: Error preparing order:', error);
      console.error('[ORDER SUBMIT] ERROR: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Provide more specific error messages
      let errorMessage = "Failed to place order. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('venue_id is required')) {
          errorMessage = "Invalid venue. Please check your QR code and try again.";
        } else if (error.message.includes('customer_name is required')) {
          errorMessage = "Please enter your name before placing the order.";
        } else if (error.message.includes('customer_phone is required')) {
          errorMessage = "Please enter your phone number before placing the order.";
        } else if (error.message.includes('items must be a non-empty array')) {
          errorMessage = "Your cart is empty. Please add items before placing the order.";
        } else if (error.message.includes('total_amount must be a number')) {
          errorMessage = "Invalid order total. Please try again.";
        } else if (error.message.includes('Failed to create order')) {
          errorMessage = "Unable to create order. Please check your connection and try again.";
        } else if (error.message.includes('Failed to verify venue')) {
          errorMessage = "Invalid venue. Please check your QR code and try again.";
        } else {
          errorMessage = `Order failed: ${error.message}`;
        }
      }
      
      alert(errorMessage);
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
                isDemo={true}
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
                <p className="text-gray-600">
                  {isCounterOrder ? `Counter ${counterNumber}` : `Table ${tableNumber}`}
                </p>
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
          
          if (menuError) {
            return (
              <Alert variant="destructive">
                <AlertDescription>{menuError}</AlertDescription>
              </Alert>
            );
          }
          
          // Always render the menu structure - items will appear as they load
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


