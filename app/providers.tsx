'use client';
import { ThemeProvider } from 'next-themes';
import { usePathname } from 'next/navigation';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Only enable dark mode for dashboard and authenticated pages
  // Disable it for the main homepage to prevent logo dark mode issues
  const isAuthenticatedRoute = pathname?.startsWith('/dashboard') || 
                               pathname?.startsWith('/generate-qr') || 
                               pathname?.startsWith('/settings') ||
                               pathname?.startsWith('/complete-profile') ||
                               pathname?.startsWith('/sign-in') ||
                               pathname?.startsWith('/sign-up');

  if (isAuthenticatedRoute) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        {children}
      </ThemeProvider>
    );
  }

  // For homepage and other public pages, render without theme provider
  return <>{children}</>;
}
