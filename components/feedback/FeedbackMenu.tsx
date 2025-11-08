"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bug, Lightbulb, X, Send } from "lucide-react";
import { FeedbackButton } from "./FeedbackButton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function FeedbackMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Hide on mobile when on dashboard pages (bottom nav is present)
  const shouldHideOnMobile = isMobile && pathname?.includes("/dashboard/");

  // Auto-close when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  // Don't render on mobile dashboard pages where bottom nav exists
  if (shouldHideOnMobile) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col-reverse gap-2">
      {/* Expanded Menu Items */}
      <div
        className={cn(
          "flex flex-col gap-2 transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <FeedbackButton type="bug" className="w-full justify-start" />
        <FeedbackButton type="feature" className="w-full justify-start" />
        <FeedbackButton type="general" className="w-full justify-start" />
      </div>

      {/* Main Toggle Button */}
      <Button
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "shadow-lg hover:shadow-xl transition-all duration-200",
          "bg-purple-600 hover:bg-purple-700 text-white",
          "h-12 px-4 rounded-full md:rounded-lg",
          isOpen && "bg-purple-700"
        )}
        aria-label={isOpen ? "Close feedback menu" : "Open feedback menu"}
      >
        {isOpen ? (
          <>
            <X className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Close</span>
          </>
        ) : (
          <>
            <MessageSquare className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Feedback</span>
          </>
        )}
      </Button>

      {/* Mobile: Show badge when closed */}
      {!isOpen && (
        <div className="absolute -top-1 -right-1 md:hidden">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            !
          </span>
        </div>
      )}
    </div>
  );
}
