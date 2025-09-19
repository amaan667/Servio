'use client';
import { ThemeProvider } from 'next-themes';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Create QueryClient instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
      },
    },
  }));
  
  // Only enable dark mode for dashboard, settings, and order pages
  // Disable it for the main homepage to prevent logo dark mode issues
  const isAuthenticatedRoute = pathname?.startsWith('/dashboard') || 
                               pathname?.startsWith('/generate-qr') || 
                               pathname?.startsWith('/settings') ||
                               pathname?.startsWith('/order') ||
                               pathname?.startsWith('/complete-profile') ||
                               pathname?.startsWith('/sign-in') ||
                               pathname?.startsWith('/sign-up');

  if (isAuthenticatedRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  // For homepage and other public pages, render with QueryClient but without theme provider
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
