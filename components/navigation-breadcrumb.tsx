"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ChevronRight } from "lucide-react";
import Link from 'next/link';
import { useMemo } from 'react';

interface NavigationBreadcrumbProps {
  customBackPath?: string;
  customBackLabel?: string;
  showBackButton?: boolean;
  venueId?: string;
}

function extractVenueId(pathname: string | null) {
  if (!pathname) return undefined;
  const m = pathname.match(/\/dashboard\/([^/]+)/);
  return m?.[1];
}

export default function NavigationBreadcrumb({
  customBackPath,
  customBackLabel,
  showBackButton = true,
  venueId: propVenueId,
}: NavigationBreadcrumbProps) {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw || '';
  const params = useParams() as { venueId?: string };
  
  // Extract venueId from params or pathname, fallback to prop
  const venueId = useMemo(
    () => params?.venueId ?? extractVenueId(pathname) ?? propVenueId,
    [params?.venueId, pathname, propVenueId]
  );
  
  // Home should always link to main home page, dashboard link for breadcrumb navigation
  const homeLink = '/';
  const dashboardLink = venueId ? `/dashboard/${venueId}` : '/dashboard';

  console.log('[NAV] NavigationBreadcrumb', { venueId, homeLink, pathname });

  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) {
      if (pathname.includes("/live-orders")) return "Live Orders";
      if (pathname.includes("/menu")) return "Menu Management";
      if (pathname.includes("/menu-management")) return "Menu Management";
      if (pathname.includes("/qr-codes")) return "QR Codes";
      if (pathname.includes("/qr/")) return "QR Codes";
      if (pathname.includes("/analytics")) return "Analytics";
      if (pathname.includes("/staff")) return "Staff Management";
      if (pathname.includes("/settings")) return "Settings";
      if (pathname.includes("/feedback")) return "Feedback";
      if (pathname.includes("/orders")) return "Orders";
      return "Dashboard";
    }
    if (pathname.includes("/sign-in")) return "Sign In";
    if (pathname.includes("/sign-up")) return "Sign Up";
    if (pathname.includes("/complete-profile")) return "Complete Profile";
    if (pathname.includes("/generate-qr")) return "QR Codes";
    if (pathname.includes("/order")) return "Order";
    return "Home";
  };

  const pageTitle = getPageTitle();
  const isDashboardRoot = /^\/dashboard\/(?:[^/]+)\/?$/.test(pathname);
  const isSignInPage = pathname.includes("/sign-in");
  const isSignUpPage = pathname.includes("/sign-up");
  const isHomePage = pathname === "/";

  // Don't show breadcrumbs on home page
  if (isHomePage) {
    return null;
  }

  // For sign-in/sign-up pages: Home → Sign In/Sign Up (current)
  if ((isSignInPage || isSignUpPage) && !showBackButton) {
    return (
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button asChild variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 h-8 px-3">
              <Link href={homeLink}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </Button>
          </li>
          <li className="text-gray-400">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li className="text-gray-900 font-medium">{pageTitle}</li>
        </ol>
      </nav>
    );
  }

  // Dashboard root: Home → Dashboard (current)
  if (isDashboardRoot) {
    return (
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button asChild variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 h-8 px-3">
              <Link href={homeLink}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </Button>
          </li>
          <li className="text-gray-400">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li className="text-gray-900 font-medium">Dashboard</li>
        </ol>
      </nav>
    );
  }

  // Subpages: Home → Dashboard → Current Page
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Button asChild variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 h-8 px-3">
            <Link href={homeLink}>
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
          </Button>
        </li>
        <li className="text-gray-400">
          <ChevronRight className="h-4 w-4" />
        </li>
        <li>
          <Button asChild variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 h-8 px-3">
            <Link href={dashboardLink}>
              <span>Dashboard</span>
            </Link>
          </Button>
        </li>
        <li className="text-gray-400">
          <ChevronRight className="h-4 w-4" />
        </li>
        <li className="text-gray-900 font-medium">{pageTitle}</li>
      </ol>
    </nav>
  );
}
