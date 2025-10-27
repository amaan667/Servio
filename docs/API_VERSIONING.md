# API Versioning Strategy

Plan for versioning Servio API to maintain backward compatibility.

## Current Status

**Current**: Unversioned API (`/api/*`)

**Target**: Versioned API (`/api/v1/*`, `/api/v2/*`)

## Migration Plan

### Phase 1: Add Version Support (Next Release)

1. Create `/app/api/v1/*` routes that mirror current routes
2. Keep `/app/api/*` routes as legacy (deprecated)
3. Update documentation

### Phase 2: Migrate Clients (Over 6 months)

1. Update all internal clients to use `/api/v1/*`
2. Notify external API users
3. Provide migration guide

### Phase 3: Deprecate Legacy (After 12 months)

1. Mark `/api/*` as deprecated
2. Return deprecation warnings
3. Eventually remove legacy routes

## Version Structure

```
app/api/
├── v1/              # Version 1 API
│   ├── orders/
│   ├── menu/
│   └── staff/
├── v2/              # Future version
│   └── orders/
└── [legacy]/        # Current unversioned (to be deprecated)
    ├── orders/
    └── menu/
```

## Version Format

### URL Structure
```
/api/v{version}/{resource}/{action}
```

Examples:
- `/api/v1/orders`
- `/api/v1/orders/{id}`
- `/api/v2/orders` (future)

### Version Header (Alternative)
```
Accept: application/vnd.servio.v1+json
```

## Breaking Changes Policy

### Major Version (v1 → v2)

Breaking changes require new major version:
- Removing endpoints
- Changing response structure
- Removing required fields
- Changing authentication method

### Minor Updates (v1.0 → v1.1)

Non-breaking changes:
- Adding optional fields
- Adding new endpoints
- Performance improvements
- Bug fixes

## Version Lifecycle

1. **Active** - Current version, actively maintained
2. **Maintenance** - Security fixes only, no new features
3. **Deprecated** - Sunset date announced, migration recommended
4. **Retired** - No longer available

## Example: Version 2 Plans

Proposed changes for v2:
- GraphQL endpoint (`/api/v2/graphql`)
- WebSocket support for real-time
- Bulk operations
- Improved pagination
- Standardized error codes

## Implementation

### Step 1: Create Version Infrastructure

```typescript
// lib/api/version.ts
export const API_VERSION = 'v1';
export const LATEST_VERSION = 'v1';

export function getApiPath(path: string, version = LATEST_VERSION) {
  return `/api/${version}${path}`;
}
```

### Step 2: Create Versioned Routes

```typescript
// app/api/v1/orders/route.ts
import { handler } from '@/app/api/orders/route';

export { GET, POST } from '@/app/api/orders/route';
```

### Step 3: Add Version Middleware

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // Redirect legacy routes to v1
  if (path.startsWith('/api/orders') && !path.startsWith('/api/v')) {
    return NextResponse.redirect(
      new URL(`/api/v1${path.replace('/api', '')}`, req.url)
    );
  }
}
```

## Deprecation Warnings

Include deprecation header in responses:

```
Deprecation: true
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Link: <https://docs.servio.com/api/v1>; rel="successor-version"
```

## Documentation

- Maintain changelog per version
- Document migration guides
- Provide code examples for each version

## Rollout Timeline

- **Q1 2024**: Implement v1 structure
- **Q2 2024**: Migrate internal clients
- **Q3 2024**: External API migration
- **Q4 2024**: Deprecate legacy routes
- **Q1 2025**: Remove legacy routes

