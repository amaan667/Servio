"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function DashboardAuthLoader() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          // Refresh the page to load with auth
          router.refresh();
        } else {
          setChecking(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setChecking(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const supabase = supabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        router.refresh();
      } else {
        setUser(null);
        setChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (checking || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // No session found - show minimal dashboard shell
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Checking your authentication status...</p>
        <p className="text-sm text-muted-foreground">
          If this persists, try{" "}
          <a href="/clear-session" className="text-primary underline">
            clearing your session
          </a>{" "}
          and signing in again.
        </p>
      </div>
    </div>
  );
}
