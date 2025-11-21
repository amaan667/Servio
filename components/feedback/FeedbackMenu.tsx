"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { FeedbackButton } from "./FeedbackButton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function FeedbackMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-close when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2",
        // Hide completely until mounted and isMobile is determined (prevents flicker)
        !mounted || isMobile === undefined ? "invisible opacity-0 pointer-events-none" : "",
        // Mobile: inline at bottom of page
        isMobile ? "relative w-full mt-8 mb-24" : "fixed bottom-4 left-4 z-50"
      )}
    >
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
          "bg-servio-purple hover:bg-white hover:text-servio-purple text-white",
          "h-12 px-4 rounded-full md:rounded-lg border-2 border-servio-purple",
          isOpen && "bg-white text-servio-purple",
          // Mobile: full width button, Desktop: icon + text with white text
          isMobile ? "w-full" : "text-white"
        )}
        aria-label={isOpen ? "Close feedback menu" : "Open feedback menu"}
      >
        {isOpen ? (
          <>
            <X className={cn("h-5 w-5", isMobile ? "mr-2" : "md:mr-2")} />
            <span className={cn(isMobile ? "inline" : "hidden md:inline", "text-white")}>
              Close
            </span>
          </>
        ) : (
          <>
            <MessageSquare className={cn("h-5 w-5", isMobile ? "mr-2" : "md:mr-2")} />
            <span className={cn(isMobile ? "inline" : "hidden md:inline", "text-white")}>
              Feedback
            </span>
          </>
        )}
      </Button>

      {/* Desktop only: Show badge when closed */}
      {!isOpen && !isMobile && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            !
          </span>
        </div>
      )}
    </div>
  );
}
