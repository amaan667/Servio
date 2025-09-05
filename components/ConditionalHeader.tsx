"use client";

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CONDITIONAL HEADER] Rendering:', { pathname });
  }
  
  // Don't show header on customer order pages and checkout
  const isCustomerOrderPage = pathname?.startsWith('/order') && !pathname?.includes('/demo');
  const isCheckoutPage = pathname?.startsWith('/checkout');
  
  if (isCustomerOrderPage || isCheckoutPage) {
    return null;
  }
  
  // Always show header on home page and other pages
  return <AppHeader />;
}
