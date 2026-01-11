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

    };
  } catch {
    // Silently handle all auth errors
    return {

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

      },
    };
  }

  return { user, getErrorComponent: undefined };
}
