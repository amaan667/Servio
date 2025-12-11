"use client";

import { useEffect } from "react";

export default function SessionClearer() {
  useEffect(() => {
    const clearSession = async () => {
      try {
        // Use server-side signout API instead of client-side auth.signOut()
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (_error) {
        // Error silently handled
      }
    };
    clearSession();
  }, []);

  return null;
}
