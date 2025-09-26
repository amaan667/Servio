'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function ThemeToggleFloat() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showOnScroll, setShowOnScroll] = useState(false);
  const pathname = usePathname();

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll detection for all pages
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setShowOnScroll(scrollTop > 100); // Show when scrolled down more than 100px
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Only show theme toggle on dashboard, settings, and order pages
  const shouldShowToggle = pathname?.startsWith('/dashboard') || 
                          pathname?.startsWith('/settings') ||
                          pathname?.startsWith('/order');

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted || !shouldShowToggle) {
    return null;
  }

  const toggle = () => {
    const currentTheme = theme || 'light';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  const currentTheme = theme || 'light';

  // Adjust positioning based on the page to avoid conflicts
  const getPositionClasses = () => {
    // Only show when scrolled on all pages
    return showOnScroll ? "fixed top-4 right-4" : "hidden";
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={`${getPositionClasses()} z-50 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 dark:shadow-gray-900/50`}
    >
      <div className="flex items-center justify-center">
        {currentTheme === 'dark' ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        )}
      </div>
    </button>
  );
}


