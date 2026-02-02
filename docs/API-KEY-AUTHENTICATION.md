# API Key Authentication for External Access

This document describes the implementation of API key authentication for external access to the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Middleware](#middleware)
7. [Best Practices](#best-practices)

## Overview

API key authentication allows external applications and services to access the Servio API without requiring user authentication. API keys are:

- **Long-lived:** Can be valid for months or years
- **Scopes:** Limited to specific permissions
- **Revocable:** Can be revoked at any time
- **Trackable:** All requests are logged with the API key

## Features

### API Key Generation

```typescript
// lib/auth/api-keys.ts
import { supabase } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export async function generateAPIKey(
  userId: string,
  name: string,
  scopes: string[]
) {
  // Generate a secure random API key
  const key = `sk_${randomBytes(32).toString('hex')}`;

  // Hash the key for storage
  const hashedKey = await hashAPIKey(key);

  // Save to database
  const { data } = await supabase.from('api_keys').insert({
    userId,
    name,
    key: hashedKey,
    scopes,
    expiresAt: null, // Never expires
  }).select().single();

  return {
    id: data.id,
    key, // Return the unhashed key to the user
    name: data.name,
    scopes: data.scopes,
    createdAt: data.createdAt,
  };
}

async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### API Key Validation

```typescript
// lib/auth/api-keys.ts (continued)

export async function validateAPIKey(key: string) {
  // Hash the key
  const hashedKey = await hashAPIKey(key);

  // Look up the key in the database
  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key', hashedKey)
    .single();

  if (!data) {
    throw new Error('Invalid API key');
  }

  // Check if the key is revoked
  if (data.revokedAt) {
    throw new Error('API key has been revoked');
  }

  // Check if the key has expired
  if (data.expiresAt && data.expiresAt < new Date()) {
    throw new Error('API key has expired');
  }

  // Update last used timestamp
  await supabase
    .from('api_keys')
    .update({ lastUsedAt: new Date() })
    .eq('id', data.id);

  return data;
}

export function hasScope(apiKey: any, scope: string): boolean {
  return apiKey.scopes.includes(scope);
}

export function hasAnyScope(apiKey: any, scopes: string[]): boolean {
  return scopes.some(scope => apiKey.scopes.includes(scope));
}

export function hasAllScopes(apiKey: any, scopes: string[]): boolean {
  return scopes.every(scope => apiKey.scopes.includes(scope));
}
```

### API Key Revocation

```typescript
// lib/auth/api-keys.ts (continued)

export async function revokeAPIKey(id: string, userId: string) {
  const { error } = await supabase
    .from('api_keys')
    .update({ revokedAt: new Date() })
    .eq('id', id)
    .eq('userId', userId);

  if (error) {
    throw new Error('Failed to revoke API key');
  }
}

export async function deleteAPIKey(id: string, userId: string) {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('userId', userId);

  if (error) {
    throw new Error('Failed to delete API key');
  }
}
```

## Database Schema

```sql
-- Create api_keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  expiresAt TIMESTAMP WITH TIME ZONE,
  revokedAt TIMESTAMP WITH TIME ZONE,
  lastUsedAt TIMESTAMP WITH TIME ZONE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_key_usage table for tracking usage
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apiKeyId UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  statusCode INTEGER NOT NULL,
  responseTime INTEGER NOT NULL, -- in milliseconds
  ipAddress TEXT,
  userAgent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_api_keys_userId ON api_keys(userId);
CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_revokedAt ON api_keys(revokedAt);
CREATE INDEX idx_api_key_usage_apiKeyId ON api_key_usage(apiKeyId);
CREATE INDEX idx_api_key_usage_timestamp ON api_key_usage(timestamp);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Users can insert their own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can update their own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = userId);

CREATE POLICY "Users can view their own API key usage"
  ON api_key_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = api_key_usage.apiKeyId
      AND api_keys.userId = auth.uid()
    )
  );
```

## API Endpoints

### Create API Key

```typescript
// app/api/developer/keys/route.ts
import { requireAuth } from '@/lib/auth';
import { generateAPIKey } from '@/lib/auth/api-keys';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  const body = await request.json();
  const { name, scopes } = body;

  const apiKey = await generateAPIKey(
    session.user.id,
    name,
    scopes
  );

  return Response.json({ data: apiKey }, { status: 201 });
}
```

### List API Keys

```typescript
// app/api/developer/keys/route.ts (continued)

export async function GET(request: Request) {
  const session = await requireAuth(request);

  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('userId', session.user.id)
    .order('createdAt', { ascending: false });

  return Response.json({ data });
}
```

### Revoke API Key

```typescript
// app/api/developer/keys/[id]/revoke/route.ts
import { requireAuth } from '@/lib/auth';
import { revokeAPIKey } from '@/lib/auth/api-keys';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(request);

  await revokeAPIKey(params.id, session.user.id);

  return Response.json({ data: { message: 'API key revoked' } });
}
```

### Delete API Key

```typescript
// app/api/developer/keys/[id]/route.ts
import { requireAuth } from '@/lib/auth';
import { deleteAPIKey } from '@/lib/auth/api-keys';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(request);

  await deleteAPIKey(params.id, session.user.id);

  return Response.json({ data: { message: 'API key deleted' } });
}
```

## Middleware

### API Key Authentication Middleware

```typescript
// lib/middleware/api-key-auth.ts
import { validateAPIKey, hasScope } from '@/lib/auth/api-keys';
import { NextResponse } from 'next/server';

export async function withAPIKeyAuth(
  request: Request,
  requiredScopes: string[] = []
) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    // Validate API key
    const keyData = await validateAPIKey(apiKey);

    // Check scopes
    if (requiredScopes.length > 0) {
      const hasRequiredScope = hasAllScopes(keyData, requiredScopes);

      if (!hasRequiredScope) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Add API key data to request headers for use in route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-api-key-id', keyData.id);
    requestHeaders.set('x-api-key-user-id', keyData.userId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    );
  }
}
```

### Usage in API Routes

```typescript
// app/api/v1/venues/route.ts
import { withAPIKeyAuth } from '@/lib/middleware/api-key-auth';

export async function GET(request: Request) {
  // Authenticate with API key
  const authResponse = await withAPIKeyAuth(request, ['venues:read']);

  if (authResponse) {
    return authResponse;
  }

  // Get API key ID from headers
  const apiKeyId = request.headers.get('x-api-key-id');
  const userId = request.headers.get('x-api-key-user-id');

  // Get venues for the user
  const { data } = await supabase
    .from('venues')
    .select('*')
    .eq('userId', userId);

  return Response.json({ data });
}

export async function POST(request: Request) {
  // Authenticate with API key
  const authResponse = await withAPIKeyAuth(request, ['venues:write']);

  if (authResponse) {
    return authResponse;
  }

  // Get API key ID from headers
  const apiKeyId = request.headers.get('x-api-key-id');
  const userId = request.headers.get('x-api-key-user-id');

  // Create venue
  const body = await request.json();
  const { data } = await supabase
    .from('venues')
    .insert({ ...body, userId })
    .select()
    .single();

  // Log usage
  await logAPIKeyUsage(apiKeyId, '/api/v1/venues', 'POST', 201, 0);

  return Response.json({ data }, { status: 201 });
}

async function logAPIKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number
) {
  await supabase.from('api_key_usage').insert({
    apiKeyId,
    endpoint,
    method,
    statusCode,
    responseTime,
    ipAddress: getClientIP(),
    userAgent: request.headers.get('user-agent'),
  });
}
```

## Best Practices

### 1. Hash API Keys

Always hash API keys before storing them:

```typescript
// Good: Hash API keys
const hashedKey = await hashAPIKey(key);
await supabase.from('api_keys').insert({
  userId,
  name,
  key: hashedKey,
  scopes,
});

// Bad: Store API keys in plain text
await supabase.from('api_keys').insert({
  userId,
  name,
  key, // Plain text!
  scopes,
});
```

### 2. Use Secure Random Generation

Use cryptographically secure random generation:

```typescript
// Good: Use crypto.randomBytes
const key = `sk_${randomBytes(32).toString('hex')}`;

// Bad: Use Math.random()
const key = `sk_${Math.random().toString(36)}`;
```

### 3. Implement Scopes

Implement scopes to limit API key permissions:

```typescript
// Good: Use scopes
const apiKey = await generateAPIKey(userId, name, ['venues:read', 'orders:write']);

// Bad: No scopes
const apiKey = await generateAPIKey(userId, name, []);
```

### 4. Track Usage

Track API key usage for analytics and security:

```typescript
// Good: Track usage
await logAPIKeyUsage(apiKeyId, endpoint, method, statusCode, responseTime);

// Bad: No tracking
// No usage tracking
```

### 5. Provide Revocation

Provide a way to revoke API keys:

```typescript
// Good: Provide revocation
await revokeAPIKey(id, userId);

// Bad: No revocation
// No way to revoke API keys
```

### 6. Set Expiration Dates

Set expiration dates for temporary API keys:

```typescript
// Good: Set expiration
await supabase.from('api_keys').insert({
  userId,
  name,
  key: hashedKey,
  scopes,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
});

// Bad: No expiration
await supabase.from('api_keys').insert({
  userId,
  name,
  key: hashedKey,
  scopes,
  expiresAt: null, // Never expires
});
```

### 7. Rate Limit API Keys

Rate limit API keys to prevent abuse:

```typescript
// Good: Rate limit API keys
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const apiKeyId = request.headers.get('x-api-key-id');

  await rateLimit(`api-key:${apiKeyId}`, 1000, 60); // 1000 requests per minute

  // ... rest of the handler
}

// Bad: No rate limiting
export async function GET(request: Request) {
  // ... rest of the handler
}
```

## References

- [API Key Best Practices](https://owasp.org/www-project-api-security/)
- [API Authentication](https://oauth.net/2/)
- [API Security](https://apisecurity.io/)
- [API Design](https://restfulapi.net/)
