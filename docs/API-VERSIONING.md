# API Versioning (v1, v2, etc.)

This document describes the implementation of API versioning for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Versioning Strategies](#versioning-strategies)
4. [Implementation](#implementation)
5. [Deprecation](#deprecation)
6. [Best Practices](#best-practices)

## Overview

API versioning allows you to make changes to your API without breaking existing clients:

- **Backward Compatibility:** Maintain backward compatibility with existing clients
- **Gradual Migration:** Allow clients to migrate gradually
- **Feature Rollout:** Roll out new features gradually
- **Deprecation:** Deprecate old versions gracefully

## Features

### Versioning Strategies

```typescript
// lib/api/versioning.ts
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
  V3 = 'v3',
}

export interface ApiVersionConfig {
  version: ApiVersion;
  deprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  migrationGuide?: string;
}

export const API_VERSIONS: Record<ApiVersion, ApiVersionConfig> = {
  [ApiVersion.V1]: {
    version: ApiVersion.V1,
    deprecated: true,
    deprecationDate: new Date('2024-01-01'),
    sunsetDate: new Date('2024-06-01'),
    migrationGuide: 'https://docs.servio.com/migration/v1-to-v2',
  },
  [ApiVersion.V2]: {
    version: ApiVersion.V2,
    deprecated: false,
  },
  [ApiVersion.V3]: {
    version: ApiVersion.V3,
    deprecated: false,
  },
};

export function getApiVersion(version: string): ApiVersion {
  const normalizedVersion = version.toLowerCase();

  if (normalizedVersion === 'v1') return ApiVersion.V1;
  if (normalizedVersion === 'v2') return ApiVersion.V2;
  if (normalizedVersion === 'v3') return ApiVersion.V3;

  return ApiVersion.V2; // Default to v2
}

export function isVersionDeprecated(version: ApiVersion): boolean {
  return API_VERSIONS[version].deprecated;
}

export function getVersionConfig(version: ApiVersion): ApiVersionConfig {
  return API_VERSIONS[version];
}
```

## Implementation

### URL Path Versioning

```typescript
// app/api/v1/venues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VenueService } from '@/services/VenueService';

const venueService = new VenueService();

export async function GET(request: NextRequest) {
  const venues = await venueService.findAll();

  // Add version header
  const response = NextResponse.json(venues);
  response.headers.set('API-Version', 'v1');
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', '2024-06-01');
  response.headers.set('Link', '<https://docs.servio.com/migration/v1-to-v2>; rel="deprecation"; type="text/html"');

  return response;
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await venueService.create(data);

  const response = NextResponse.json(venue);
  response.headers.set('API-Version', 'v1');
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', '2024-06-01');
  response.headers.set('Link', '<https://docs.servio.com/migration/v1-to-v2>; rel="deprecation"; type="text/html"');

  return response;
}
```

```typescript
// app/api/v2/venues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VenueService } from '@/services/VenueService';

const venueService = new VenueService();

export async function GET(request: NextRequest) {
  const venues = await venueService.findAll();

  // Add version header
  const response = NextResponse.json(venues);
  response.headers.set('API-Version', 'v2');

  return response;
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await venueService.create(data);

  const response = NextResponse.json(venue);
  response.headers.set('API-Version', 'v2');

  return response;
}
```

### Header Versioning

```typescript
// lib/middleware/api-version.ts
import { NextRequest, NextResponse } from 'next/server';
import { getApiVersion, ApiVersion } from '../api/versioning';

export function withApiVersion(handler: (request: NextRequest, version: ApiVersion) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Get version from header
    const versionHeader = request.headers.get('API-Version') || request.headers.get('X-API-Version');

    // Get version from URL path
    const url = new URL(request.url);
    const pathVersion = url.pathname.match(/\/api\/(v\d+)\//)?.[1];

    // Determine version
    const version = getApiVersion(versionHeader || pathVersion || 'v2');

    // Check if version is deprecated
    const config = getVersionConfig(version);

    if (config.deprecated) {
      const response = await handler(request, version);

      // Add deprecation headers
      response.headers.set('Deprecation', 'true');
      response.headers.set('Sunset', config.sunsetDate?.toISOString() || '');
      response.headers.set('Link', `<${config.migrationGuide}>; rel="deprecation"; type="text/html"`);

      return response;
    }

    return handler(request, version);
  };
}
```

### Versioned Response Format

```typescript
// lib/api/versioned-response.ts
import { NextResponse } from 'next/server';
import { ApiVersion } from './versioning';

export interface VersionedResponse<T> {
  data: T;
  meta: {
    version: ApiVersion;
    timestamp: string;
    requestId: string;
  };
}

export function createVersionedResponse<T>(
  data: T,
  version: ApiVersion,
  requestId: string
): NextResponse<VersionedResponse<T>> {
  const response: VersionedResponse<T> = {
    data,
    meta: {
      version,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  const nextResponse = NextResponse.json(response);
  nextResponse.headers.set('API-Version', version);
  nextResponse.headers.set('X-Request-ID', requestId);

  return nextResponse;
}
```

## Deprecation

### Deprecation Headers

```typescript
// lib/api/deprecation.ts
import { ApiVersion, getVersionConfig } from './versioning';

export function addDeprecationHeaders(
  response: NextResponse,
  version: ApiVersion
): NextResponse {
  const config = getVersionConfig(version);

  if (config.deprecated) {
    response.headers.set('Deprecation', 'true');

    if (config.sunsetDate) {
      response.headers.set('Sunset', config.sunsetDate.toISOString());
    }

    if (config.migrationGuide) {
      response.headers.set(
        'Link',
        `<${config.migrationGuide}>; rel="deprecation"; type="text/html"`
      );
    }
  }

  return response;
}
```

### Deprecation Middleware

```typescript
// lib/middleware/deprecation.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApiVersion, getVersionConfig } from '../api/versioning';

export function withDeprecationWarning(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const response = await handler(request);

    // Get version from response
    const version = response.headers.get('API-Version') as ApiVersion;

    // Add deprecation headers
    const config = getVersionConfig(version);

    if (config.deprecated) {
      response.headers.set('Deprecation', 'true');

      if (config.sunsetDate) {
        response.headers.set('Sunset', config.sunsetDate.toISOString());
      }

      if (config.migrationGuide) {
        response.headers.set(
          'Link',
          `<${config.migrationGuide}>; rel="deprecation"; type="text/html"`
        );
      }

      // Add warning header
      const daysUntilSunset = config.sunsetDate
        ? Math.ceil((config.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      response.headers.set(
        'Warning',
        `299 - "Deprecated API version. Please migrate to v2. Sunset in ${daysUntilSunset} days."`
      );
    }

    return response;
  };
}
```

## Best Practices

### 1. Use Semantic Versioning

Use semantic versioning:

```typescript
// Good: Semantic versioning
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
  V3 = 'v3',
}

// Bad: Non-semantic versioning
export enum ApiVersion {
  V1 = '1.0',
  V2 = '2.0',
  V3 = '3.0',
}
```

### 2. Add Version Headers

Add version headers:

```typescript
// Good: Add version headers
const response = NextResponse.json(data);
response.headers.set('API-Version', 'v2');
return response;

// Bad: No version headers
const response = NextResponse.json(data);
return response;
```

### 3. Deprecate Old Versions

Deprecate old versions:

```typescript
// Good: Deprecate old versions
export const API_VERSIONS: Record<ApiVersion, ApiVersionConfig> = {
  [ApiVersion.V1]: {
    version: ApiVersion.V1,
    deprecated: true,
    deprecationDate: new Date('2024-01-01'),
    sunsetDate: new Date('2024-06-01'),
    migrationGuide: 'https://docs.servio.com/migration/v1-to-v2',
  },
  [ApiVersion.V2]: {
    version: ApiVersion.V2,
    deprecated: false,
  },
};

// Bad: No deprecation
export const API_VERSIONS: Record<ApiVersion, ApiVersionConfig> = {
  [ApiVersion.V1]: {
    version: ApiVersion.V1,
    deprecated: false,
  },
  [ApiVersion.V2]: {
    version: ApiVersion.V2,
    deprecated: false,
  },
};
```

### 4. Provide Migration Guides

Provide migration guides:

```typescript
// Good: Provide migration guides
export const API_VERSIONS: Record<ApiVersion, ApiVersionConfig> = {
  [ApiVersion.V1]: {
    version: ApiVersion.V1,
    deprecated: true,
    migrationGuide: 'https://docs.servio.com/migration/v1-to-v2',
  },
};

// Bad: No migration guides
export const API_VERSIONS: Record<ApiVersion, ApiVersionConfig> = {
  [ApiVersion.V1]: {
    version: ApiVersion.V1,
    deprecated: true,
  },
};
```

### 5. Use Sunset Headers

Use sunset headers:

```typescript
// Good: Use sunset headers
response.headers.set('Sunset', '2024-06-01');

// Bad: No sunset headers
// No sunset headers
```

### 6. Document Version Changes

Document version changes:

```markdown
# Good: Document version changes
## API Versioning

### v2 (Current)
- Added pagination support
- Added filtering and sorting
- Improved error handling

### v1 (Deprecated)
- Sunset date: 2024-06-01
- Migration guide: https://docs.servio.com/migration/v1-to-v2

# Bad: No documentation
# No documentation
```

### 7. Test All Versions

Test all versions:

```typescript
// Good: Test all versions
describe('API v1', () => {
  it('should return venues', async () => {
    const response = await fetch('/api/v1/venues');
    expect(response.ok).toBe(true);
  });
});

describe('API v2', () => {
  it('should return venues', async () => {
    const response = await fetch('/api/v2/venues');
    expect(response.ok).toBe(true);
  });
});

// Bad: Test only one version
describe('API', () => {
  it('should return venues', async () => {
    const response = await fetch('/api/v2/venues');
    expect(response.ok).toBe(true);
  });
});
```

## References

- [API Versioning](https://restfulapi.net/versioning/)
- [Semantic Versioning](https://semver.org/)
- [HTTP Deprecation Header](https://datatracker.ietf.org/doc/html/rfc8594)
- [API Design Best Practices](https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md)
