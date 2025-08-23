"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackForwardNavProps {
  className?: string;
  venueId?: string;
}

// Back navigation component - handles browser back functionality
export default function BackForwardNav({ className, venueId }: BackForwardNavProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check initial navigation state
    const checkNavigationState = () => {
      setCanGoBack(window.history.length > 1);
    };

    checkNavigationState();
    
    // Listen for popstate events to update navigation state
    const handlePopState = () => {
      checkNavigationState();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      // Default to dashboard if no history
      const dashboardPath = venueId ? `/dashboard/${venueId}` : '/dashboard';
      router.push(dashboardPath);
    }
  };

  return (
    <div className={cn("flex items-center", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        disabled={!canGoBack}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Go back"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}