"use client";

import { useEffect } from "react";

/**
 * Loads Eruda DevTools console on all pages if debug mode is enabled
 * Enable debug mode by visiting /debug-mobile
 */
export function ErudaLoader() {
  useEffect(() => {
    // Check if debug mode is enabled
    const debugMode = localStorage.getItem("servio-debug-mode");

    if (debugMode === "true") {
      // Check if Eruda is already loaded
      // @ts-expect-error - Eruda is loaded dynamically
      if (window.eruda) {
        return;
      }

      // Inject Eruda for mobile debugging
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      document.body.appendChild(script);
      script.onload = () => {
        // @ts-expect-error - Eruda is loaded dynamically
        if (window.eruda) {
          // @ts-expect-error - Eruda global
          window.eruda.init();
          // @ts-expect-error - Eruda global
          window.eruda.show();

          // eslint-disable-next-line no-console
          console.log("🔍 Eruda DevTools loaded - tap gear icon to open console");
        }
      };
    }
  }, []);

  return null;
}
