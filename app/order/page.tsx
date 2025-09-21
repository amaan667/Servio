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
import { Loader2, ShoppingCart, Plus, Minus, X, CreditCard, Table, Receipt } from "lucide-react";
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
  
  // Debug table number extraction
  console.log('[ORDER PAGE] ===== URL PARAMETER DEBUG =====');
  console.log('[ORDER PAGE] Full URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
  console.log('[ORDER PAGE] searchParams:', searchParams?.toString());
  console.log('[ORDER PAGE] Raw tableNumber from URL:', tableNumber);
  console.log('[ORDER PAGE] Raw counterNumber from URL:', counterNumber);
  console.log('[ORDER PAGE] venueSlug:', venueSlug);
  console.log('[ORDER PAGE] ===== END URL PARAMETER DEBUG =====');
  
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
          console.log('[ORDER PAGE] Found existing order in localStorage:', orderData);
          
          // Check if the order exists in the database and is still active
          const { data: orderInDb, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderData.orderId)
            .eq('venue_id', venueSlug)
            .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
            .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS'])
            .single();

          if (orderInDb) {
            console.log('[ORDER PAGE] Found active order in database:', orderInDb);
            
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
          } else {
            // Order not active in database, clear localStorage
            console.log('[ORDER PAGE] Order not active in database, clearing localStorage');
            localStorage.removeItem(`servio-order-${sessionParam}`);
          }
        }
      }
      
      // Also check localStorage for any existing session data
      const storedSession = localStorage.getItem('servio-current-session');
      if (storedSession && !sessionParam) {
        console.log('[ORDER PAGE] Checking localStorage session:', storedSession);
        
        const storedOrderData = localStorage.getItem(`servio-order-${storedSession}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);
          console.log('[ORDER PAGE] Found existing order in localStorage session:', orderData);
          
          // Check if the session order exists and is active in database
          const { data: sessionOrderInDb, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderData.orderId)
            .eq('venue_id', venueSlug)
            .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
            .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS'])
            .single();

          if (sessionOrderInDb) {
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
          } else {
            // Session order not active in database, clear localStorage
            console.log('[ORDER PAGE] Session order not active in database, clearing localStorage');
            localStorage.removeItem(`servio-order-${storedSession}`);
            localStorage.removeItem('servio-current-session');
          }
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
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
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
    const checkUnpaidOrders = async () => {
      try {
        // First, check if there are active orders in the database for this table
        const { data: activeOrders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueSlug)
          .eq('table_number', tableNumber)
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
          .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS']);

        if (error) {
          console.error('[ORDER PAGE] Error checking for active orders:', error);
        }

        console.log('[ORDER PAGE] Active orders in database:', activeOrders);

        // If there are active orders in the database, check localStorage for session data
        if (activeOrders && activeOrders.length > 0) {
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
              console.log('[ORDER PAGE] Found existing session with active orders:', session);
              
              // If there's an unpaid order, redirect to order summary
              if (session.paymentStatus === 'unpaid' || session.paymentStatus === 'till') {
                console.log('[ORDER PAGE] Unpaid order detected with active orders in DB, redirecting to summary...');
                
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
          } else {
            // No session data but active orders exist - this shouldn't happen normally
            console.log('[ORDER PAGE] Active orders exist but no session data found');
          }
        } else {
          // No active orders in database - clear any stale localStorage data
          console.log('[ORDER PAGE] No active orders in database, clearing stale session data');
          const tableSessionKey = `servio-session-${tableNumber}`;
          localStorage.removeItem(tableSessionKey);
          
          // Also clear any session-based data
          const sessionId = searchParams?.get('sessionId');
          if (sessionId) {
            const sessionSessionKey = `servio-session-${sessionId}`;
            localStorage.removeItem(sessionSessionKey);
          }
        }
      } catch (error) {
        console.error('[ORDER PAGE] Error in checkUnpaidOrders:', error);
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
      
      // Fetch category order from the most recent menu upload
      try {
        const categoryOrderResponse = await fetch(`${window.location.origin}/api/menu/uploads/${venueSlug}/category-order`);
        if (categoryOrderResponse.ok) {
          const categoryOrderData = await categoryOrderResponse.json();
          if (categoryOrderData.categories && Array.isArray(categoryOrderData.categories)) {
            setCategoryOrder(categoryOrderData.categories);
          }
        }
      } catch (error) {
        console.log('[ORDER PAGE] Could not fetch category order:', error);
        setCategoryOrder(null);
      }
      
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
        console.log('[ORDER SUBMIT] ===== TABLE NUMBER DEBUG =====');
        console.log('[ORDER SUBMIT] Raw tableNumber from URL:', tableNumber);
        console.log('[ORDER SUBMIT] Type of tableNumber:', typeof tableNumber);
        console.log('[ORDER SUBMIT] parseInt(tableNumber):', parseInt(tableNumber));
        console.log('[ORDER SUBMIT] isNaN(parseInt(tableNumber)):', isNaN(parseInt(tableNumber)));
        
        // For counter orders, use counter number; for table orders, use table number
        const safeTable = isCounterOrder ? (parseInt(counterNumber) || 1) : (parseInt(tableNumber) || 1);
        
        // Determine payment mode based on source
        const paymentMode = isCounterOrder ? 'pay_at_till' : 'online';
        console.log('[ORDER SUBMIT] Final safeTable value:', safeTable);
        console.log('[ORDER SUBMIT] Order type:', orderType);
        console.log('[ORDER SUBMIT] Is counter order:', isCounterOrder);
        console.log('[ORDER SUBMIT] Counter number:', counterNumber);
        console.log('[ORDER SUBMIT] ===== END TABLE NUMBER DEBUG =====');

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
        table_id: null, // Will be set by API based on table lookup
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
        payment_mode: paymentMode, // New field for payment mode
        payment_method: paymentMode === 'pay_at_till' ? 'till' : null, // Counter orders pay at till, table orders choose later
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Demo Fallback Notification */}
        {isDemo && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-purple-200 dark:border-purple-700">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-purple-700 dark:text-purple-300">🎯 Demo Mode:</span>
                    <span className="ml-2 text-purple-600 dark:text-purple-400">Experience Servio Café's full ordering flow with payment simulation</span>
                    <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 px-2 py-1 rounded-full">Interactive Preview</span>
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
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          {/* Breadcrumb Navigation for Demo */}
          {isDemo && (
            <div className="mb-3 sm:mb-4">
              <NavigationBreadcrumb 
                customBackPath="/dashboard" 
                customBackLabel="Dashboard"
                showBackButton={true}
                isDemo={true}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              {/* Servio Logo - Large and prominent */}
              <div className="flex items-center flex-shrink-0">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={800}
                  height={250}
                  className="h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto"
                  priority
                />
              </div>
              
              {/* Business Name and Location */}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {isDemo ? "Servio Café" : venueName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {isCounterOrder ? (
                    <>
                      <Receipt className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm sm:text-base text-orange-600 dark:text-orange-400 font-medium">
                        Counter {counterNumber}
                      </span>
                      <Badge variant="secondary" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs">
                        Counter Order
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Table className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm sm:text-base text-blue-600 dark:text-blue-400 font-medium">
                        Table {tableNumber}
                      </span>
                      <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
                        Table Order
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile Cart Button */}
            <Button
              onClick={() => setShowMobileCart(!showMobileCart)}
              className="md:hidden ml-2 flex-shrink-0 min-h-[44px] min-w-[44px] bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white"
              size="sm"
            >
              <ShoppingCart className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="text-sm">{getTotalItems()}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2 space-y-6">
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
              <div className="space-y-8">
                {(() => {
                  const categoryPriority = [
                    "burgers", "burger", "main courses", "main course", "mains", "main", "entrees", 
                    "fries", "fry", "chips", "side dishes", "sides", 
                    "extras", "extra", "add-ons", "add ons", "addons",
                    "sauces", "sauce", "condiments", "condiment",
                    "starters", "starter", "appetizers", "appetizer", "salads", "salad", "desserts", "dessert",
                    "drinks", "beverages", "coffee", "tea", "wine", "beer", "cocktails", "soft drinks"
                  ];
                  const categories = Array.from(new Set(menuItems.map((i) => i.category)));
                  const sortedCats = categories.sort((a,b)=>{
                    // Check if we have stored category order from PDF upload
                    if (categoryOrder && Array.isArray(categoryOrder)) {
                      const orderA = categoryOrder.findIndex(storedCat => 
                        storedCat.toLowerCase() === (a||'').toLowerCase()
                      );
                      const orderB = categoryOrder.findIndex(storedCat => 
                        storedCat.toLowerCase() === (b||'').toLowerCase()
                      );
                      
                      // If both categories are in stored order, sort by that order
                      if (orderA >= 0 && orderB >= 0) {
                        return orderA - orderB;
                      }
                      
                      // If only one is in stored order, prioritize it
                      if (orderA >= 0) return -1;
                      if (orderB >= 0) return 1;
                    }
                    
                    // Fallback to alphabetical sorting for categories not in stored order
                    return String(a||'').localeCompare(String(b||''));
                  });
                  return sortedCats.map((category) => (
                    <div key={category} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white capitalize">
                          {category}
                        </h2>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {menuItems
                          .filter((item) => item.category === category)
                          .sort((a,b)=> String(a.name).localeCompare(String(b.name)))
                          .map((item) => (
                            <Card key={item.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500 bg-white dark:bg-gray-800">
                              <CardContent className="p-4">
                                <div className="flex flex-col space-y-3">
                                  {/* Item Details */}
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
                                      {item.name}
                                    </h3>
                                    {item.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                                        {item.description}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                        £{item.price.toFixed(2)}
                                      </p>
                                      <Button
                                        onClick={() => addToCart(item)}
                                        size="sm"
                                        className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white px-4 py-2"
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add to Cart
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
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
            <Card className="sticky top-4 shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-gray-100 dark:border-gray-700">
                <CardTitle className="flex items-center text-lg text-gray-900 dark:text-white">
                  <ShoppingCart className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Your Order
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  {getTotalItems()} items • £{getTotalPrice().toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Your cart is empty. Add some items to get started!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              £{item.price.toFixed(2)} each
                            </p>
                          </div>
                          <Button
                            onClick={() => removeFromCart(item.id)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 h-6 w-6"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                            £{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                        
                        <Textarea
                          placeholder="Special instructions (optional)"
                          value={item.specialInstructions || ""}
                          onChange={(e) =>
                            updateSpecialInstructions(item.id, e.target.value)
                          }
                          className="text-xs resize-none"
                          rows={2}
                        />
                      </div>
                    ))}

                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4 bg-white dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          £{getTotalPrice().toFixed(2)}
                        </span>
                      </div>

                      <Button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white py-3 text-lg font-medium"
                        disabled={cart.length === 0}
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
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
            className="rounded-full w-14 h-14 shadow-lg relative min-h-[56px] min-w-[56px]"
            disabled={cart.length === 0}
          >
            <ShoppingCart className="h-6 w-6" />
            {getTotalItems() > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                {getTotalItems()}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile Cart Modal */}
        {showMobileCart && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                <div className="flex justify-between items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold truncate text-gray-900 dark:text-white">Your Order</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {getTotalItems()} items • £{getTotalPrice().toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileCart(false)}
                    className="ml-2 min-h-[44px] min-w-[44px] flex-shrink-0 text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Your cart is empty. Add some items to get started!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-base">
                              {item.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              £{item.price.toFixed(2)} each
                            </p>
                          </div>
                          <Button
                            onClick={() => removeFromCart(item.id)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 p-1 h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              size="sm"
                              variant="outline"
                              className="min-h-[40px] min-w-[40px]"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-medium min-w-[2rem] text-center">{item.quantity}</span>
                            <Button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              size="sm"
                              variant="outline"
                              className="min-h-[40px] min-w-[40px]"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                            £{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-500 mb-2">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                        
                        <Textarea
                          placeholder="Special instructions (optional)"
                          value={item.specialInstructions || ""}
                          onChange={(e) =>
                            updateSpecialInstructions(item.id, e.target.value)
                          }
                          className="text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {cart.length > 0 && (
                <div className="border-t p-4 flex-shrink-0 bg-white">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      £{getTotalPrice().toFixed(2)}
                    </span>
                  </div>

                  <Button
                    onClick={() => {
                      setShowMobileCart(false);
                      setShowCheckout(true);
                    }}
                    className="w-full min-h-[48px] text-base font-medium bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white"
                    disabled={cart.length === 0}
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Proceed to Checkout
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <Card className="w-full sm:max-w-md sm:w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-lg">
            <CardHeader className="flex-shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg sm:text-xl">Complete Your Order</CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Enter your details to complete the order
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCheckout(false)}
                  className="ml-2 min-h-[44px] min-w-[44px] flex-shrink-0 sm:hidden"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <Input
                  value={customerInfo.name}
                  onChange={(e) =>
                    updateCustomerInfo('name', e.target.value)
                  }
                  placeholder="Enter your name"
                  required
                  className="min-h-[48px] text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <Input
                  value={customerInfo.phone}
                  onChange={(e) =>
                    updateCustomerInfo('phone', e.target.value)
                  }
                  placeholder="Enter your phone number"
                  type="tel"
                  className="min-h-[48px] text-base"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    £{getTotalPrice().toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <Button
                    onClick={() => setShowCheckout(false)}
                    variant="outline"
                    className="flex-1 min-h-[48px] text-base font-medium order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      submitOrder();
                    }}
                    className="flex-1 min-h-[48px] text-base font-medium order-1 sm:order-2"
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


