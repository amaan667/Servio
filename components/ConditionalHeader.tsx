"use client";

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Debug logging
  console.log('[CONDITIONAL HEADER] Rendering:', { 
    pathname,
    timestamp: new Date().toISOString()
  });
  
  // Don't show header on customer order pages and checkout
  const isCustomerOrderPage = pathname?.startsWith('/order') && !pathname?.includes('/demo');
  const isCheckoutPage = pathname?.startsWith('/checkout');
  
  if (isCustomerOrderPage || isCheckoutPage) {
    console.log('[CONDITIONAL HEADER] Hiding header for customer pages');
    return null;
  }
  
  // Always show header on home page and other pages
  console.log('[CONDITIONAL HEADER] Showing AppHeader');
  return <AppHeader />;
}
