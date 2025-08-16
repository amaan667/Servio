'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggleFloat() {
  const { theme, setTheme } = useTheme();

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="fixed bottom-4 left-4 z-50 rounded-full border bg-background/90 backdrop-blur px-3 py-3 shadow-lg hover:scale-105 transition-transform md:left-auto md:right-4"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}


