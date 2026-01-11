"use client";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create optimized QueryClient instance (with anti-flicker settings)
  const [queryClient] = useState(() => getQueryClient());

  // Global chunk-load error handler to force-refresh when a stale chunk is requested.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: ErrorEvent) => {
      const message = event?.message || "";
      const isChunkError = message.includes("Loading chunk") || message.includes("ChunkLoadError");

      if (isChunkError) {
        const hasRetried = sessionStorage.getItem("chunk-retry-done");
        if (hasRetried) {
          return; // Avoid loops
        }
        sessionStorage.setItem("chunk-retry-done", "true");

        // Clear relevant caches to force fresh assets
        if (typeof caches !== "undefined") {
          caches.keys().then((names) => {
            names
              .filter(
                (name) =>
                  name.startsWith("next") ||
                  name.startsWith("_next") ||
                  name.includes("static") ||
                  name.startsWith("servio-") ||
                  name.includes(process.env.NEXT_PUBLIC_SW_CACHE_VERSION || "v-current")
              )
              .forEach((name) => caches.delete(name));

        }

        const url = new URL(window.location.href);
        url.searchParams.set("cache-bust", Date.now().toString());
        window.location.replace(url.toString());
      }
    };

    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

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
