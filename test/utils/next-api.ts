/**
 * Next.js API Route Testing Utilities
 * Helper functions for testing Next.js API routes in isolation
 */

export interface CallRouteOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

/**
 * Call a Next.js API route handler and return the response
 * @param handler - The Next.js API route handler function
 * @param options - Request options (method, body, headers, query)
 * @returns Promise with status and parsed JSON response
 */
export async function callRoute<T = unknown>(
  handler: (req: Request) => Promise<Response>,
  options: CallRouteOptions = {}
): Promise<{ status: number; json: T; headers: Headers }> {
  const { method = 'GET', body, headers = {}, query } = options;

  // Build URL with query params
  const url = new URL('http://localhost/api/test');
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Prepare request init
  const init: RequestInit = { method, headers };
  
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }

  // Create request
  const req = new Request(url.toString(), init);

  // Call handler
  const res = await handler(req);

  // Parse response
  const json = await res.json() as T;

  return {
    status: res.status,
    json,
    headers: res.headers,
  };
}

/**
 * Helper to test API routes with context (params, searchParams)
 * For Next.js 15+ App Router with dynamic segments
 */
export function createMockContext(params: Record<string, string> = {}) {
  return {
    params: Promise.resolve(params),
  };
}

/**
 * Helper to test API routes with search params
 */
export function createMockSearchParams(params: Record<string, string> = {}) {
  return new URLSearchParams(params);
}

