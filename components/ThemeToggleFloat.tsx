'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggleFloat() {
  const { theme, setTheme } = useTheme();

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="fixed bottom-0 right-0 w-24 h-24 z-50 group pointer-events-none">
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        className="pointer-events-auto absolute bottom-4 right-4 rounded-full border bg-background/80 backdrop-blur px-3 py-3 shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-105"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}


