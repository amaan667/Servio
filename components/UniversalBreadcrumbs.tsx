"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

function getPageTitle(pathname: string): string {
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
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  // Always start with Home
  breadcrumbs.push({
    label: "Home",
    href: "/"
  });

  // Handle dashboard routes
  if (pathname.includes("/dashboard")) {
    // Extract venueId if present
    const venueMatch = pathname.match(/\/dashboard\/([^/]+)/);
    const venueId = venueMatch?.[1];
    
    if (venueId) {
      // Add Dashboard with venue context
      breadcrumbs.push({
        label: "Dashboard",
        href: `/dashboard/${venueId}`
      });
      
      // Add current page
      const currentPage = getPageTitle(pathname);
      if (currentPage !== "Dashboard") {
        breadcrumbs.push({
          label: currentPage,
          current: true
        });
      }
    } else {
      // Simple dashboard without venue
      breadcrumbs.push({
        label: "Dashboard",
        current: true
      });
    }
  } else if (pathname.includes("/sign-in") || pathname.includes("/sign-up")) {
    // Auth pages
    breadcrumbs.push({
      label: getPageTitle(pathname),
      current: true
    });
  } else if (pathname !== "/") {
    // Other pages
    breadcrumbs.push({
      label: getPageTitle(pathname),
      current: true
    });
  }

  return breadcrumbs;
}

export default function UniversalBreadcrumbs() {
  const pathname = usePathname();
  
  // Don't show breadcrumbs on home page
  if (pathname === "/") {
    return null;
  }

  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="flex items-center gap-2">
            {crumb.current ? (
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {crumb.label}
              </span>
            ) : (
              <Link 
                href={crumb.href!}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors flex items-center gap-1"
              >
                {crumb.label === "Home" && <Home className="h-4 w-4" />}
                {crumb.label}
              </Link>
            )}
            {index < breadcrumbs.length - 1 && (
              <ChevronLeft className="h-4 w-4 text-gray-400 rotate-180" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}