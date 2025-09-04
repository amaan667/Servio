"use client";

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Don't show header on customer order pages and checkout
  const isCustomerOrderPage = pathname?.startsWith('/order') && !pathname?.includes('/demo');
  const isCheckoutPage = pathname?.startsWith('/checkout');
  
  if (isCustomerOrderPage || isCheckoutPage) {
    return null;
  }
  
  return <AppHeader />;
}
