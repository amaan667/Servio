import { useState } from 'react';
import { CartItem, CustomerInfo } from '../types';

interface OrderSubmissionParams {
  cart: CartItem[];
  customerInfo: CustomerInfo;
  venueSlug: string;
  tableNumber: string;
  counterNumber: string;
  orderLocation: string;
  orderType: 'counter' | 'table';
  isCounterOrder: boolean;
  isDemo: boolean;
  isDemoFallback: boolean;
}

export function useOrderSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = async (params: OrderSubmissionParams) => {
    const {
      cart,
      customerInfo,
      venueSlug,
      tableNumber,
      counterNumber,
      orderLocation,
      orderType,
      isCounterOrder,
      isDemo,
      isDemoFallback,
    } = params;

    // Validate order data
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
      const safeTable = isCounterOrder ? (parseInt(counterNumber) || 1) : (parseInt(tableNumber) || 1);
      const paymentMode = isCounterOrder ? 'pay_at_till' : 'online';

      // For demo orders
      if (isDemo || isDemoFallback || venueSlug === 'demo-cafe') {
        const orderData = {
          venueId: 'demo-cafe',
          venueName: 'Demo Café',
          tableNumber: parseInt(orderLocation) || 1,
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
          total: cart.reduce((total, item) => total + item.price * item.quantity, 0),
          notes: cart
            .filter((item) => item.specialInstructions)
            .map((item) => `${item.name}: ${item.specialInstructions}`)
            .join("; "),
          isDemo: true,
        };
        
        localStorage.setItem('servio-pending-order', JSON.stringify(orderData));
        setIsSubmitting(false);
        
        if (typeof window !== 'undefined') {
          window.location.href = '/order-summary';
        }
        return;
      }

      // For real orders
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('servio-current-session', sessionId);
      
      const orderData = {
        venue_id: venueSlug,
        table_number: safeTable,
        table_id: null,
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
        total_amount: cart.reduce((total, item) => total + item.price * item.quantity, 0),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
        order_status: 'PLACED',
        payment_status: 'UNPAID',
        payment_mode: paymentMode,
        payment_method: paymentMode === 'pay_at_till' ? 'till' : null,
        session_id: sessionId,
        source: orderType === 'counter' ? 'counter' : 'qr',
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create order (${response.status})`);
      }

      const orderResult = await response.json();
      
      const checkoutData = {
        venueId: venueSlug,
        venueName: 'Restaurant',
        tableNumber: parseInt(orderLocation) || 1,
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
        total: cart.reduce((total, item) => total + item.price * item.quantity, 0),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
        orderId: orderResult.order?.id,
        orderNumber: orderResult.order?.order_number,
        sessionId: sessionId,
        orderType: orderType,
        isDemo: isDemo,
      };

      localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
      
      const orderDataForSession = {
        venueId: venueSlug,
        tableNumber: parseInt(orderLocation) || 1,
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
        total: cart.reduce((total, item) => total + item.price * item.quantity, 0),
        orderId: orderResult.order?.id,
        orderNumber: orderResult.order?.order_number,
        sessionId: sessionId,
        paymentStatus: 'unpaid'
      };
      
      localStorage.setItem(`servio-order-${sessionId}`, JSON.stringify(orderDataForSession));
      
      setIsSubmitting(false);
      
      if (typeof window !== 'undefined') {
        window.location.href = '/payment';
      }
    } catch (error) {

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

  return {
    isSubmitting,
    submitOrder,
  };
}

