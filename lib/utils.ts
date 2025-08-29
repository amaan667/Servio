import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if the request has any Supabase auth cookies
 * This helps prevent unnecessary auth calls on requests that obviously won't have a session
 */
export function hasSbAuthCookie(cookies: any) {
  return cookies.getAll().some((c: any) => c.name.includes('-auth-token'))
}

/**
 * Server-side utility to check for Supabase auth cookies
 * Use this before making auth calls in server components
 */
export async function hasServerAuthCookie() {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  return cookieStore.getAll().some((c) => c.name.includes('-auth-token'));
}
