"use client";

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Don't show header on customer order pages
  const isCustomerOrderPage = pathname?.startsWith('/order') && !pathname?.includes('/demo');
  
  if (isCustomerOrderPage) {
    return null;
  }
  
  return <AppHeader />;
}
