"use client";

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CONDITIONAL HEADER] Rendering:', { pathname });
  }
  
  // Don't show header on customer-facing pages
  const isCustomerOrderPage = pathname?.startsWith('/order');
  const isCheckoutPage = pathname?.startsWith('/checkout');
  const isPaymentPage = pathname?.startsWith('/payment');
  const isOrderSummaryPage = pathname?.startsWith('/order-summary');
  const isOrderTrackingPage = pathname?.startsWith('/order-tracking');
  
  if (isCustomerOrderPage || isCheckoutPage || isPaymentPage || isOrderSummaryPage || isOrderTrackingPage) {
    return null;
  }
  
  // Always show header on home page and other pages
  return <AppHeader />;
}
