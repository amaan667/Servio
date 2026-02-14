"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // On mobile dashboard pages, the bottom nav + AI button are present so shift up
  const hasBottomNav =
    isMobile && (pathname?.startsWith("/dashboard") || pathname?.includes("/qr-codes"));

  return (
    <Button
      onClick={scrollToTop}
      className={`fixed right-4 sm:right-6 z-50 h-12 w-12 rounded-full bg-white text-servio-purple hover:bg-gray-50 shadow-lg hover:shadow-xl border-2 border-servio-purple transition-all duration-300 p-0 flex items-center justify-center group ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      } ${hasBottomNav ? "bottom-44" : "bottom-24"}`}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5 text-servio-purple" />
    </Button>
  );
}
