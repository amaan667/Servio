"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import Link from 'next/link';

interface NavigationBreadcrumbProps {
  customBackPath?: string;
  customBackLabel?: string;
}

export default function NavigationBreadcrumb({
  customBackPath,
  customBackLabel,
}: NavigationBreadcrumbProps) {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw || '';

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

  // Dashboard root: Home → Dashboard (current)
  if (isDashboardRoot) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Button asChild variant="ghost" size="sm" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <Link href="/">
                <>
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </>
              </Link>
            </Button>
          </li>
          <li className="text-gray-400">→</li>
          <li className="text-gray-700 font-medium">Dashboard</li>
        </ol>
      </nav>
    );
  }

  // Subpages: Home → Dashboard (Back) → Current Page
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Button asChild variant="ghost" size="sm" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <Link href="/">
              <>
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </>
            </Link>
          </Button>
        </li>
        <li className="text-gray-400">→</li>
        <li>
          {customBackPath ? (
            <Button asChild variant="ghost" size="sm" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <Link href={customBackPath}>
                <>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{customBackLabel || "Dashboard"}</span>
                </>
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{customBackLabel || "Dashboard"}</span>
            </Button>
          )}
        </li>
        <li className="text-gray-400">→</li>
        <li className="text-gray-700 font-medium">{pageTitle}</li>
      </ol>
    </nav>
  );
}
