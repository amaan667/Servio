/**
 * @fileoverview API Versioning System
 * Provides version negotiation and backward compatibility
 */

import { NextRequest, NextResponse } from "next/server";

export const API_VERSIONS = ["v1"] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];
export const CURRENT_API_VERSION: ApiVersion = "v1";
export const DEPRECATED_API_VERSIONS: ApiVersion[] = [];

export interface ApiVersionInfo {
  version: ApiVersion;
  deprecated: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  supportedUntil?: string;
}

export const API_VERSION_INFO: Record<ApiVersion, ApiVersionInfo> = {
  v1: {
    version: "v1",
    deprecated: false,
  },
};

/**
 * Extract API version from request
 */
export function getApiVersionFromRequest(req: NextRequest): ApiVersion {
  // Check URL path for version
  const url = req.nextUrl.pathname;
  const versionMatch = url.match(/^\/api\/(v\d+)\//);

  if (versionMatch) {
    const version = versionMatch[1] as ApiVersion;
    if (API_VERSIONS.includes(version)) {
      return version;
    }
  }

  // Check Accept header for version
  const acceptHeader = req.headers.get("Accept");
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.servio\.(v\d+)\+json/);
    if (versionMatch) {
      const version = versionMatch[1] as ApiVersion;
      if (API_VERSIONS.includes(version)) {
        return version;
      }
    }
  }

  // Check custom header
  const versionHeader = req.headers.get("X-API-Version");
  if (versionHeader && API_VERSIONS.includes(versionHeader as ApiVersion)) {
    return versionHeader as ApiVersion;
  }

  // Default to current version
  return CURRENT_API_VERSION;
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: ApiVersion): boolean {
  return DEPRECATED_API_VERSIONS.includes(version) || API_VERSION_INFO[version]?.deprecated || false;
}

/**
 * Get version info
 */
export function getVersionInfo(version: ApiVersion): ApiVersionInfo | undefined {
  return API_VERSION_INFO[version];
}

/**
 * Create versioned response headers
 */
export function createVersionHeaders(version: ApiVersion): HeadersInit {
  const headers: HeadersInit = {
    "X-API-Version": version,
  };

  const versionInfo = getVersionInfo(version);

  if (versionInfo?.deprecated) {
    headers["X-API-Deprecated"] = "true";
    headers["X-API-Deprecation-Date"] = versionInfo.deprecationDate || "";
    headers["X-API-Sunset-Date"] = versionInfo.sunsetDate || "";
    headers["Link"] = `<${process.env.NEXT_PUBLIC_APP_URL}/docs/api-changelog>; rel="deprecation"`;
  }

  return headers;
}

/**
 * Create versioned response
 */
export function createVersionedResponse<T>(
  version: ApiVersion,
  data: T,
  status: number = 200
): NextResponse {
  const headers = createVersionHeaders(version);

  return NextResponse.json(data, {
    status,
    headers,
  });
}

/**
 * Handle unsupported version
 */
export function createUnsupportedVersionResponse(requestedVersion: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "UNSUPPORTED_API_VERSION",
        message: `API version '${requestedVersion}' is not supported`,
        details: {
          supportedVersions: API_VERSIONS,
          currentVersion: CURRENT_API_VERSION,
        },
      },
    },
    {
      status: 400,
      headers: {
        "X-Supported-Versions": API_VERSIONS.join(", "),
        "X-Current-Version": CURRENT_API_VERSION,
      },
    }
  );
}

/**
 * Middleware for API versioning
 */
export function withApiVersioning(handler: (req: NextRequest, version: ApiVersion) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const version = getApiVersionFromRequest(req);

    // Check if version is supported
    if (!API_VERSIONS.includes(version)) {
      return createUnsupportedVersionResponse(version);
    }

    // Check if version is deprecated
    if (isVersionDeprecated(version)) {
      const versionInfo = getVersionInfo(version);
      const headers = createVersionHeaders(version);

      // Add deprecation warning header
      (headers as Record<string, string>)["Warning"] = `299 - "Deprecated API Version" - "${version}" is deprecated and will be removed on ${versionInfo?.sunsetDate || "TBD"}`;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DEPRECATED_API_VERSION",
            message: `API version '${version}' is deprecated`,
            details: {
              deprecationDate: versionInfo?.deprecationDate,
              sunsetDate: versionInfo?.sunsetDate,
              migrationGuide: `${process.env.NEXT_PUBLIC_APP_URL}/docs/api-migration`,
            },
          },
        },
        {
          status: 410, // Gone
          headers,
        }
      );
    }

    // Call handler with version
    return handler(req, version);
  };
}

/**
 * Get versioned route path
 */
export function getVersionedPath(basePath: string, version: ApiVersion = CURRENT_API_VERSION): string {
  return `/api/${version}${basePath}`;
}

/**
 * Check if client should upgrade
 */
export function shouldClientUpgrade(version: ApiVersion): boolean {
  const versionInfo = getVersionInfo(version);

  if (!versionInfo || !versionInfo.deprecated) {
    return false;
  }

  // If sunset date has passed, client must upgrade
  if (versionInfo.sunsetDate) {
    const sunsetDate = new Date(versionInfo.sunsetDate);
    const now = new Date();
    return now >= sunsetDate;
  }

  return false;
}

/**
 * Get migration guide URL
 */
export function getMigrationGuideUrl(fromVersion: ApiVersion, toVersion: ApiVersion): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/docs/api-migration?from=${fromVersion}&to=${toVersion}`;
}
