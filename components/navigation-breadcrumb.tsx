"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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

  // [NAV] Extract venueId from params or pathname, fallback to prop
  const venueId = useMemo(
    () => params?.venueId ?? extractVenueId(pathname) ?? propVenueId,
    [params?.venueId, pathname, propVenueId]
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
      if (pathname.includes("/kds")) return "Kitchen Display System";
      if (pathname.includes("/inventory")) return "Inventory";
      return "Dashboard";
    }
    if (pathname.includes("/sign-in")) return "Sign In";
    if (pathname.includes("/sign-up")) return "Sign Up";
    if (pathname.includes("/complete-profile")) return "Complete Profile";
    if (pathname.includes("/qr-codes")) return "QR Codes";
    if (pathname.includes("/order")) return "Order";
    return "Home";
  };

  const pageTitle = getPageTitle();
  const isDashboardRoot = /^\/dashboard\/(?:[^/]+)\/?$/.test(pathname);
  const isSignInPage = pathname.includes("/sign-in");
  const isSignUpPage = pathname.includes("/sign-up");
  const isCreateAccountPage = pathname.includes("/auth/create-account");
  const isGenerateQRPage = pathname.includes("/qr-codes");

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
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-700 transition-colors duration-200">
            Demo
          </li>
        </ol>
      </nav>
    );
  }

  // For sign-in/sign-up/create-account pages: Home ← Sign In/Sign Up (current)
  if ((isSignInPage || isSignUpPage || isCreateAccountPage) && !showBackButton) {
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
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-700 transition-colors duration-200">
            {isCreateAccountPage ? "Sign Up" : pageTitle}
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
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 shadow-[0_0_20px_rgba(147,51,234,0.7)] transition-all duration-200">
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
                  <span className="hidden sm:inline">Dashboard</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-foreground/60">←</li>
          <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-700 transition-colors duration-200">
            {pageTitle}
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
            className="flex items-center gap-1 text-foreground hover:text-foreground font-medium"
          >
            <Link href={homeLink}>
              <>
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </>
            </Link>
          </Button>
        </li>
        <li className="text-foreground/40">←</li>
        <li>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-foreground hover:text-foreground font-medium"
          >
            <Link href={dashboardLink}>
              <>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </>
            </Link>
          </Button>
        </li>
        <li className="text-foreground/40">←</li>
        <li className="inline-flex items-center px-3 py-1 rounded-md font-medium text-gray-900 shadow-[0_0_20px_rgba(147,51,234,0.7)] transition-all duration-200">
          {pageTitle}
        </li>
      </ol>
    </nav>
  );
}
