"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function ClearSessionPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"clearing" | "cleared" | "error">("clearing");

  useEffect(() => {
    const clearSession = async () => {
      try {
        // Sign out from Supabase
        const supabase = supabaseBrowser();
        await supabase.auth.signOut();

        // Clear all Supabase cookies
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          if (name.trim().startsWith("sb-")) {
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        }

        // Clear localStorage
        Object.keys(localStorage).forEach((key) => {
          if (key.includes("sb-") || key.includes("supabase")) {
            localStorage.removeItem(key);
          }
        });

        // Clear sessionStorage
        Object.keys(sessionStorage).forEach((key) => {
          if (key.includes("sb-") || key.includes("supabase")) {
            sessionStorage.removeItem(key);
          }
        });

        setStatus("cleared");
      } catch (error) {
        console.error("Error clearing session:", error);
        setStatus("error");
      }
    };

    clearSession();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg text-center">
        {status === "clearing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-4">Clearing Session...</h2>
            <p className="text-muted-foreground">
              Removing old authentication tokens to enable fresh sign-in.
            </p>
          </>
        )}

        {status === "cleared" && (
          <>
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-green-600 mb-4">Session Cleared!</h2>
            <p className="text-muted-foreground mb-6">
              Your old session has been completely cleared. You can now sign in with fresh
              credentials.
            </p>
            <div className="space-y-3">
              <Button onClick={() => router.push("/sign-in")} className="w-full" size="lg">
                Go to Sign In
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Go to Home
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-red-500 text-6xl mb-4">✕</div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-muted-foreground mb-6">
              There was an error clearing your session. Try manually clearing your browser data.
            </p>
            <Button onClick={() => router.push("/")} variant="outline" className="w-full">
              Go to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
