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
    console.log('🚀 [ORDER SUBMIT] ========================================');
    console.log('🚀 [ORDER SUBMIT] submitOrder function STARTED');
    console.log('🚀 [ORDER SUBMIT] Timestamp:', new Date().toISOString());
    
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

    console.log('🚀 [ORDER SUBMIT] Params destructured');
    console.log('🚀 [ORDER SUBMIT] Cart length:', cart.length);
    console.log('🚀 [ORDER SUBMIT] Customer name:', customerInfo.name);
    console.log('🚀 [ORDER SUBMIT] Customer phone:', customerInfo.phone);
    console.log('🚀 [ORDER SUBMIT] Venue slug:', venueSlug);

    // Validate order data
    console.log('🚀 [ORDER SUBMIT] Starting validation...');
    
    if (!customerInfo.name.trim()) {
      console.error('❌ [ORDER SUBMIT] Validation failed: No customer name');
      alert("Please enter your name before placing the order.");
      return;
    }
    console.log('✅ [ORDER SUBMIT] Name validation passed');
    
    if (!customerInfo.phone.trim()) {
      console.error('❌ [ORDER SUBMIT] Validation failed: No customer phone');
      alert("Please enter your phone number before placing the order.");
      return;
    }
    console.log('✅ [ORDER SUBMIT] Phone validation passed');
    
    if (cart.length === 0) {
      console.error('❌ [ORDER SUBMIT] Validation failed: Empty cart');
      alert("Your cart is empty. Please add items before placing the order.");
      return;
    }
    console.log('✅ [ORDER SUBMIT] Cart validation passed');
    
    if (!venueSlug) {
      console.error('❌ [ORDER SUBMIT] Validation failed: No venue slug');
      alert("Invalid venue. Please check your QR code and try again.");
      return;
    }
    console.log('✅ [ORDER SUBMIT] Venue validation passed');
    console.log('🚀 [ORDER SUBMIT] All validations passed!');

    console.log('🚀 [ORDER SUBMIT] Setting isSubmitting to true...');
    setIsSubmitting(true);
    console.log('🚀 [ORDER SUBMIT] isSubmitting set to true');
    
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
            image: (item as unknown).image || null,
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
      // DON'T create order yet - just save to localStorage and go to payment
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('servio-current-session', sessionId);
      
      const checkoutData = {
        venueId: venueSlug,
        venueName: 'Restaurant',
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
          image: (item as unknown).image || null,
        })),
        total: cart.reduce((total, item) => total + item.price * item.quantity, 0),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
        sessionId: sessionId,
        isDemo: isDemo,
        paymentMode: paymentMode,
        source: orderType === 'counter' ? 'counter' : 'qr',
      };

      console.log('💾 [ORDER SUBMIT] Saving checkout data to localStorage (NO ORDER CREATED YET)...');
      localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
      console.log('✅ [ORDER SUBMIT] Checkout data saved - redirecting to payment selection...');
      
      // Instant redirect to payment method selection page
      // Order will be created AFTER payment method is selected
      window.location.href = '/payment';
    } catch (error) {
      console.error('❌❌❌ [ORDER SUBMIT] CAUGHT ERROR ❌❌❌');
      console.error('❌ [ORDER SUBMIT] Error type:', typeof error);
      console.error('❌ [ORDER SUBMIT] Error instanceof Error:', error instanceof Error);
      console.error('❌ [ORDER SUBMIT] Error object:', error);
      console.error('❌ [ORDER SUBMIT] Error message:', error instanceof Error ? error.message : String(error));
      console.error('❌ [ORDER SUBMIT] Error stack:', error instanceof Error ? error.stack : 'No stack');

      let errorMessage = "Failed to place order. Please try again.";
      
      if (error instanceof Error) {
        console.log('🔍 [ORDER SUBMIT] Processing error message:', error.message);
        
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
      
      console.error('❌ [ORDER SUBMIT] Final error message:', errorMessage);
      console.error('❌ [ORDER SUBMIT] Showing alert to user...');
      alert(errorMessage);
      console.error('❌ [ORDER SUBMIT] Setting isSubmitting to false...');
      setIsSubmitting(false);
      console.error('❌❌❌ [ORDER SUBMIT] ERROR HANDLING COMPLETE ❌❌❌');
    }
  };

  return {
    isSubmitting,
    submitOrder,
  };
}

