/**
 * API Client Helper
 *
 * Automatically includes authentication token in all API requests
 */

import { supabaseBrowser } from "./supabase";

export interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Authenticated fetch - automatically includes auth token
 */
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {
    /* Empty */
  }
): Promise<Response> {
  const supabase = supabaseBrowser();

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Add auth token if available
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // Build URL with query params
  let finalUrl = url;
  if (options.params) {
    const params = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      finalUrl += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  // Make the request with credentials to ensure cookies are sent
  return fetch(finalUrl, {
    ...options,
    headers,
    credentials: "include", // Essential: sends cookies for server-side auth
  });
}

/**
 * Convenience methods
 */
export const apiClient = {
  get: (url: string, options?: FetchOptions) => fetchWithAuth(url, { ...options, method: "GET" }),

  post: (url: string, body?: unknown, options?: FetchOptions) =>
    fetchWithAuth(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (url: string, body?: unknown, options?: FetchOptions) =>
    fetchWithAuth(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: (url: string, body?: unknown, options?: FetchOptions) =>
    fetchWithAuth(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (url: string, options?: FetchOptions) =>
    fetchWithAuth(url, { ...options, method: "DELETE" }),
};
