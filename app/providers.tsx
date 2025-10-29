"use client";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
  const pathname = usePathname();

  // Create optimized QueryClient instance (with anti-flicker settings)
  const [queryClient] = useState(() => getQueryClient());

  // Only enable dark mode for dashboard, settings, and order pages
  // Disable it for the main homepage to prevent logo dark mode issues
  const isAuthenticatedRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/order") ||
    pathname?.startsWith("/complete-profile") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up");

  // Use conditional rendering within a single return statement instead of multiple returns
  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticatedRoute ? (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ServiceWorkerRegistration>
            {children}
            <Toaster />
          </ServiceWorkerRegistration>
        </ThemeProvider>
      ) : (
        <ServiceWorkerRegistration>
          {children}
          <Toaster />
        </ServiceWorkerRegistration>
      )}
    </QueryClientProvider>
  );
}
