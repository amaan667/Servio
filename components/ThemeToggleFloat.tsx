"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ThemeToggleFloat() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showOnScroll, setShowOnScroll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);

    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle scroll detection with improved logic
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      // Different scroll thresholds for mobile vs desktop
      const scrollThreshold = isMobile ? 150 : 100;
      setShowOnScroll(scrollTop > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Only show theme toggle on dashboard, settings, and order pages
  // Explicitly hide on home page (/ or /home)
  const isHomePage = pathname === "/" || pathname === "/home";
  const shouldShowToggle =
    !isHomePage &&
    (pathname?.startsWith("/dashboard") ||
      pathname?.startsWith("/settings") ||
      pathname?.startsWith("/order"));

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted || !shouldShowToggle) {
    return null;
  }

  const toggle = () => {
    const currentTheme = theme || "light";
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  const currentTheme = theme || "light";

  // Improved positioning logic for desktop vs mobile
  const getPositionClasses = () => {
    if (!showOnScroll) return "hidden";

    if (isMobile) {
      // Mobile: Center position to avoid conflicts
      return "fixed top-24 right-1/2 transform translate-x-1/2 z-50";
    } else {
      // Desktop: Right side positioning with proper spacing
      return "fixed top-20 right-6 z-50";
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={`${getPositionClasses()} rounded-full border-2 border-border dark:border-border bg-card dark:bg-card p-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 backdrop-blur-sm bg-card/95 dark:bg-card/95 hover:bg-accent dark:hover:bg-accent`}
    >
      <div className="flex items-center justify-center">
        {currentTheme === "dark" ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-foreground dark:text-foreground" />
        )}
      </div>
    </button>
  );
}
