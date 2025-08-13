"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Home, ArrowLeft } from "lucide-react";

interface NavigationBreadcrumbProps {
  showBackButton?: boolean;
  showHomeButton?: boolean;
  customBackPath?: string;
  customBackLabel?: string;
}

export default function NavigationBreadcrumb({
  showBackButton = true,
  showHomeButton = true,
  customBackPath,
  customBackLabel
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
    router.push('/');
  };

  const getPageTitle = () => {
    if (pathname.includes('/dashboard')) {
      if (pathname.includes('/live-orders')) return 'Live Orders';
      if (pathname.includes('/menu')) return 'Menu Management';
      if (pathname.includes('/qr-codes')) return 'QR Codes';
      if (pathname.includes('/analytics')) return 'Analytics';
      if (pathname.includes('/staff')) return 'Staff Management';
      if (pathname.includes('/settings')) return 'Settings';
      return 'Dashboard';
    }
    if (pathname.includes('/sign-in')) return 'Sign In';
    if (pathname.includes('/sign-up')) return 'Sign Up';
    if (pathname.includes('/complete-profile')) return 'Complete Profile';
    if (pathname.includes('/generate-qr')) return 'Generate QR Code';
    if (pathname.includes('/order')) return 'Order';
    return 'Home';
  };

  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
      {showHomeButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleHome}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Button>
      )}
      
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">
            {customBackLabel || 'Back'}
          </span>
        </Button>
      )}
      
      <div className="flex items-center gap-1 text-gray-500">
        <ChevronLeft className="h-4 w-4" />
        <span className="font-medium">{getPageTitle()}</span>
      </div>
    </div>
  );
}
