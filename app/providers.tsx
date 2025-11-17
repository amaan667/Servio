"use client";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create optimized QueryClient instance (with anti-flicker settings)
  const [queryClient] = useState(() => getQueryClient());

  // Enable dark mode globally for all pages
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ServiceWorkerRegistration>
          {children}
          <Toaster />
        </ServiceWorkerRegistration>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
