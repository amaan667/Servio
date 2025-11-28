"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useMemo, useEffect, useState } from "react";

interface NavigationBreadcrumbProps {
  customBackPath?: string;
  customBackLabel?: string;
  showBackButton?: boolean;
  venueId?: string; // Add venueId prop
  isDemo?: boolean; // Add demo flag
}

function extractVenueId(pathname: string | null) {
  if (!pathname) return undefined;
  const m = pathname.match(/\/dashboard\/([^/]+)/);
  return m?.[1];
}

export default function NavigationBreadcrumb({
  customBackPath: _customBackPath,
  customBackLabel: _customBackLabel,
  showBackButton = true,
  venueId: propVenueId,
  isDemo = false,
}: NavigationBreadcrumbProps) {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw || "";
  const params = useParams() as { venueId?: string };

  // [NAV] Get venueId from localStorage for help page
  const [storedVenueId, setStoredVenueId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined" && pathname.includes("/help")) {
      const stored = localStorage.getItem("currentVenueId") || localStorage.getItem("venueId");
      if (stored) {
        setStoredVenueId(stored);
      }
    }
  }, [pathname]);

  // [NAV] Extract venueId from params or pathname, fallback to prop or stored
  const venueId = useMemo(
    () => params?.venueId ?? extractVenueId(pathname) ?? propVenueId ?? storedVenueId ?? undefined,
    [params?.venueId, pathname, propVenueId, storedVenueId]
  );

  // [NAV] Determine home link - always route to actual home page
  const homeLink = "/";

  // [NAV] Determine dashboard link - route to dashboard if we have a venueId
  const dashboardLink = venueId ? `/dashboard/${venueId}` : "/";

  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) {
      if (pathname.includes("/live-orders")) return "Live Orders";
      if (pathname.includes("/menu")) return "Menu Management";
      if (pathname.includes("/menu-management")) return "Menu Management";
      if (pathname.includes("/tables")) return "Table Management";
      if (pathname.includes("/qr-codes")) return "QR Codes";
      if (pathname.includes("/analytics")) return "Analytics";
      if (pathname.includes("/staff")) return "Staff Management";
      if (pathname.includes("/settings")) return "Settings";
      if (pathname.includes("/feedback")) return "Feedback";
      if (pathname.includes("/orders")) return "Orders";
      if (pathname.includes("/receipts")) return "Receipts";
      if (pathname.includes("/kds")) return "Kitchen Display System";
      if (pathname.includes("/inventory")) return "Inventory";
      return "Dashboard";
    }
    if (pathname.includes("/help")) return "Support";
    if (pathname.includes("/sign-in")) return "Sign In";
    if (pathname.includes("/sign-up")) return "Sign Up";
    if (pathname.includes("/forgot-password")) return "Reset Your Password";
    if (pathname.includes("/reset-password")) return "Set New Password";
    if (pathname.includes("/complete-profile")) return "Complete Profile";
    if (pathname.includes("/qr-codes")) return "QR Codes";
    if (pathname.includes("/order")) return "Order";
    return "Home";
  };

  const pageTitle = getPageTitle();
  const isDashboardRoot = /^\/dashboard\/(?:[^/]+)\/?$/.test(pathname);
  const isHelpPage = pathname.includes("/help");
  const isSignInPage = pathname.includes("/sign-in");
  const isSignUpPage = pathname.includes("/sign-up");
  const isForgotPasswordPage = pathname.includes("/forgot-password");
  const isResetPasswordPage = pathname.includes("/reset-password");
  const isCreateAccountPage = pathname.includes("/auth/create-account");
  const isGenerateQRPage = pathname.includes("/qr-codes");
  const isSelectPlanPage = pathname.includes("/select-plan");

  // Demo mode: Home ← Demo (current)
  if (isDemo) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
            >
              <Link href={homeLink}>
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
            Demo
          </li>
        </ol>
      </nav>
    );
  }

  // For sign-in/sign-up/forgot-password/reset-password/create-account/select-plan pages: Home ← Page Name (current)
  if (
    (isSignInPage ||
      isSignUpPage ||
      isForgotPasswordPage ||
      isResetPasswordPage ||
      isCreateAccountPage ||
      isSelectPlanPage) &&
    !showBackButton
  ) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
            >
              <Link href={homeLink}>
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
            {isCreateAccountPage
              ? "Sign Up"
              : isSelectPlanPage
                ? "Choose Your Plan"
                : isForgotPasswordPage
                  ? "Reset Your Password"
                  : isResetPasswordPage
                    ? "Set New Password"
                    : pageTitle}
          </li>
        </ol>
      </nav>
    );
  }

  // Dashboard root: Home ← Dashboard (current)
  if (isDashboardRoot) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
            >
              <Link href={homeLink}>
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
            Dashboard
          </li>
        </ol>
      </nav>
    );
  }

  // Generate QR page: Home ← Dashboard ← QR Codes
  if (isGenerateQRPage && venueId) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
            >
              <Link href={homeLink}>
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
            >
              <Link href={dashboardLink}>
                <>
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
            {pageTitle}
          </li>
        </ol>
      </nav>
    );
  }

  // Help page: Home ← Dashboard ← Support
  if (isHelpPage) {
    // For help page, try to get venueId from localStorage or use a default dashboard link
    const helpDashboardLink = venueId ? `/dashboard/${venueId}` : "/";
    
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 dark:text-foreground/80 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors duration-200"
            >
              <Link href={homeLink}>
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60 dark:text-foreground/60">←</li>
          <li>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-700 dark:text-foreground/80 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors duration-200"
            >
              <Link href={helpDashboardLink}>
                <>
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60 dark:text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
            Support
          </li>
        </ol>
      </nav>
    );
  }

  // Subpages: Home ← Dashboard ← Current Page
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-gray-700 dark:text-foreground/80 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors duration-200"
          >
            <Link href={homeLink}>
              <>
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </>
            </Link>
          </Button>
        </li>
        <li className="text-foreground/60 dark:text-foreground/60">←</li>
        <li>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-gray-700 dark:text-foreground/80 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors duration-200"
          >
            <Link href={dashboardLink}>
              <>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden md:inline">Dashboard</span>
              </>
            </Link>
          </Button>
        </li>
        <li className="text-foreground/60 dark:text-foreground/60">←</li>
        <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 dark:text-foreground shadow-[0_0_20px_rgba(147,51,234,0.7)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-200">
          {pageTitle}
        </li>
      </ol>
    </nav>
  );
}
