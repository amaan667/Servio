'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggleFloat() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  const toggle = () => {
    const currentTheme = theme || 'light';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  const currentTheme = theme || 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="fixed bottom-4 left-4 z-50 rounded-full border bg-background/90 backdrop-blur px-3 py-3 shadow-lg hover:scale-105 transition-transform md:left-auto md:right-4"
    >
      {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}


