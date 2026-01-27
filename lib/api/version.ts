/**
 * API Versioning Utilities
 * Helper functions for API versioning
 */

import { NextResponse } from "next/server";

export const API_VERSION = "v1";
export const LATEST_VERSION = "v1";

/**
 * Get API path with version
 */
export function getApiPath(path: string, version = LATEST_VERSION): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `/api/${version}/${cleanPath}`;
}

/**
 * Extract version from request path
 */
export function extractVersion(path: string): string | null {
  const match = path.match(/^\/api\/(v\d+)\//);
  const v = match?.[1];
  return v != null ? v : null;
}

/**
 * Check if path is versioned
 */
export function isVersionedPath(path: string): boolean {
  return /^\/api\/v\d+\//.test(path);
}

/**
 * Add version headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: string = API_VERSION
): NextResponse {
  response.headers.set("API-Version", version);
  response.headers.set("X-API-Version", version);
  return response;
}

/**
 * Add deprecation warning to response
 */
export function addDeprecationWarning(response: NextResponse, sunsetDate: string): NextResponse {
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", sunsetDate);
  response.headers.set("Link", '<https://docs.servio.com/api/v1>; rel="successor-version"');
  return response;
}
