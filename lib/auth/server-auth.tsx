/**
 * Server-side authentication helpers
 * Safe wrappers that never throw errors for expired/invalid tokens
 */

import React from "react";
import { createServerSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/**
 * Safely get the current authenticated user on the server
 * Returns null if no valid session exists (never throws)
 * Uses getUser() instead of getSession() for secure authentication
 *
 * @returns Promise<User | null>
 */
export async function getServerUser(): Promise<User | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    // Silently handle auth errors (expired tokens, etc.)
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch {
    // Silently handle all auth errors
    return null;
  }
}

/**
 * Safely get the current session on the server
 * Returns null if no valid session exists (never throws)
 *
 * @returns Promise<{ user: User | null, session: unknown }>
 */
export async function getServerSession(): Promise<{ user: User | null; session: unknown }> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      user: session?.user || null,
      session: session || null,
    };
  } catch {
    // Silently handle all auth errors
    return {
      user: null,
      session: null,
    };
  }
}

/**
 * Get server user and return an error component generator if not authenticated
 * Use this at the top of protected pages
 *
 * @returns Promise<{ user: User, getErrorComponent?: never } | { user: null, getErrorComponent: () => Promise<JSX.Element> }>
 */
export async function requireServerAuth() {
  const user = await getServerUser();

  if (!user) {
    return {
      user: null,
      getErrorComponent: async () => {
        const Link = (await import("next/link")).default;
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold text-destructive mb-4">Authentication Required</h2>
              <p className="text-muted-foreground mb-4">Please sign in to access this page.</p>
              <Link
                href="/sign-in"
                className="block w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        );
      },
    };
  }

  return { user, getErrorComponent: undefined };
}
