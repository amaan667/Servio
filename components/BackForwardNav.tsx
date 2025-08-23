"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackForwardNavProps {
  className?: string;
  venueId?: string;
}

// Back and Forward navigation component - handles browser navigation functionality
export default function BackForwardNav({ className, venueId }: BackForwardNavProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    // Check initial navigation state
    const checkNavigationState = () => {
      setCanGoBack(window.history.length > 1);
      // Note: We can't reliably detect forward state without tracking navigation
      // This is a limitation of the browser API
      setCanGoForward(false);
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

  const handleForward = () => {
    if (canGoForward) {
      router.forward();
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
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
      <Button
        variant="ghost"
        size="sm"
        onClick={handleForward}
        disabled={!canGoForward}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Go forward"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}