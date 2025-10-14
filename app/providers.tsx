'use client';
import { ThemeProvider } from 'next-themes';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export default function Providers({ children }: { children: React.ReactNode }) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
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
                               pathname?.startsWith('/settings') ||
                               pathname?.startsWith('/order') ||
                               pathname?.startsWith('/complete-profile') ||
                               pathname?.startsWith('/sign-in') ||
                               pathname?.startsWith('/sign-up');

  // Use conditional rendering within a single return statement instead of multiple returns
  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticatedRoute ? (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ServiceWorkerRegistration>
            {children}
          </ServiceWorkerRegistration>
        </ThemeProvider>
      ) : (
        <ServiceWorkerRegistration>
          {children}
        </ServiceWorkerRegistration>
      )}
    </QueryClientProvider>
  );
}
