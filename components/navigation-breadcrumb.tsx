"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

interface NavigationBreadcrumbProps {
  customBackPath?: string;
  customBackLabel?: string;
}

export default function NavigationBreadcrumb({
  customBackPath,
  customBackLabel,
}: NavigationBreadcrumbProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (customBackPath) {
      router.push(customBackPath);
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    router.push("/");
  };

  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) {
      if (pathname.includes("/live-orders")) return "Live Orders";
      if (pathname.includes("/menu")) return "Menu Management";
      if (pathname.includes("/qr-codes")) return "QR Codes";
      if (pathname.includes("/analytics")) return "Analytics";
      if (pathname.includes("/staff")) return "Staff Management";
      if (pathname.includes("/settings")) return "Settings";
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
            <Button variant="ghost" size="sm" onClick={handleHome} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
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
          <Button variant="ghost" size="sm" onClick={handleHome} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
        </li>
        <li className="text-gray-400">→</li>
        <li>
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{customBackLabel || "Dashboard"}</span>
          </Button>
        </li>
        <li className="text-gray-400">→</li>
        <li className="text-gray-700 font-medium">{pageTitle}</li>
      </ol>
    </nav>
  );
}
