"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import AppHeader from "./AppHeader";

export default function ConditionalHeader() {
  const pathname = usePathname();

  // Memoize the header visibility check for better performance
  const shouldShowHeader = useMemo(() => {
    // Don't show header on customer-facing pages
    const isCustomerOrderPage = pathname?.startsWith("/order");
    const isPaymentPage = pathname?.startsWith("/payment");
    const isOrderSummaryPage = pathname?.startsWith("/order-summary");
    const isOrderTrackingPage = pathname?.startsWith("/order-tracking");

    return !isCustomerOrderPage && !isPaymentPage && !isOrderSummaryPage && !isOrderTrackingPage;
  }, [pathname]);

  if (!shouldShowHeader) {
    return null;
  }

  // Always show header on home page and other pages
  return <AppHeader />;
}
