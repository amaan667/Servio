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

    // Don't show header on auth/onboarding pages
    const isAuthPage = pathname?.startsWith("/auth");
    const isSignUpPage = pathname?.startsWith("/sign-up");
    const isSignInPage = pathname?.startsWith("/sign-in");
    const isCompleteProfilePage = pathname?.startsWith("/complete-profile");

    return (
      !isCustomerOrderPage &&
      !isPaymentPage &&
      !isOrderSummaryPage &&
      !isOrderTrackingPage &&
      !isAuthPage &&
      !isSignUpPage &&
      !isSignInPage &&
      !isCompleteProfilePage
    );
  }, [pathname]);

  if (!shouldShowHeader) {
    return null;
  }

  // Always show header on home page and other pages
  return <AppHeader />;
}
