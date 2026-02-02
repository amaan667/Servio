# Session Timeout and Refresh Token Rotation

This document describes the implementation of session timeout and refresh token rotation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Middleware](#middleware)
7. [Best Practices](#best-practices)

## Overview

Session timeout and refresh token rotation are critical security features that help prevent session hijacking and unauthorized access:

- **Session Timeout:** Automatically expire sessions after a period of inactivity
- **Refresh Token Rotation:** Rotate refresh tokens on each use to prevent replay attacks
- **Token Revocation:** Allow users to revoke all sessions
- **Device Tracking:** Track sessions across multiple devices

## Features

### Session Management

```typescript
// lib/auth/session.ts
import { supabase } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  lastUsedAt: Date;
  ipAddress: string;
  userAgent: string;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<Session> {
  // Generate access token
  const accessToken = generateAccessToken(userId);

  // Generate refresh token
  const refreshToken = generateRefreshToken();

  // Calculate expiration
  const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);

  // Save session to database
  const { data } = await supabase.from('sessions').insert({
    userId,
    accessToken: await hashToken(accessToken),
    refreshToken: await hashToken(refreshToken),
    expiresAt,
    lastUsedAt: new Date(),
    ipAddress,
    userAgent,
  }).select().single();

  return {
    id: data.id,
    userId: data.userId,
    accessToken,
    refreshToken,
    expiresAt: data.expiresAt,
    lastUsedAt: data.lastUsedAt,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  };
}

export async function refreshSession(
  refreshToken: string,
  ipAddress: string,
  userAgent: string
): Promise<Session> {
  // Hash refresh token
  const hashedRefreshToken = await hashToken(refreshToken);

  // Look up session
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('refreshToken', hashedRefreshToken)
    .single();

  if (!session) {
    throw new Error('Invalid refresh token');
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    throw new Error('Session expired');
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(session.userId);
  const newRefreshToken = generateRefreshToken();

  // Update session with new tokens
  const { data: updatedSession } = await supabase
    .from('sessions')
    .update({
      accessToken: await hashToken(newAccessToken),
      refreshToken: await hashToken(newRefreshToken),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TIMEOUT),
    })
    .eq('id', session.id)
    .select()
    .single();

  return {
    id: updatedSession.id,
    userId: updatedSession.userId,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: updatedSession.expiresAt,
    lastUsedAt: updatedSession.lastUsedAt,
    ipAddress: updatedSession.ipAddress,
    userAgent: updatedSession.userAgent,
  };
}

export async function validateSession(
  accessToken: string
): Promise<Session> {
  // Hash access token
  const hashedAccessToken = await hashToken(accessToken);

  // Look up session
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('accessToken', hashedAccessToken)
    .single();

  if (!session) {
    throw new Error('Invalid access token');
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    throw new Error('Session expired');
  }

  // Update last used time
  await supabase
    .from('sessions')
    .update({ lastUsedAt: new Date() })
    .eq('id', session.id);

  return {
    id: session.id,
    userId: session.userId,
    accessToken,
    expiresAt: session.expiresAt,
    lastUsedAt: session.lastUsedAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
  };
}

export async function revokeSession(sessionId: string, userId: string) {
  await supabase
    .from('sessions')
    .update({ revokedAt: new Date() })
    .eq('id', sessionId)
    .eq('userId', userId);
}

export async function revokeAllSessions(userId: string) {
  await supabase
    .from('sessions')
    .update({ revokedAt: new Date() })
    .eq('userId', userId);
}

export async function getUserSessions(userId: string) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('userId', userId)
    .is('revokedAt', null)
    .order('lastUsedAt', { ascending: false });

  return data;
}

function generateAccessToken(userId: string): string {
  const payload = {
    userId,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  };

  return signJWT(payload);
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function signJWT(payload: any): string {
  // In a real implementation, this would use a JWT library
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
```

### Session Cleanup

```typescript
// lib/auth/session-cleanup.ts
import { supabase } from '@/lib/supabase';

export async function cleanupExpiredSessions() {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .lt('expiresAt', new Date());

  if (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}

export async function cleanupRevokedSessions() {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .not('revokedAt', null)
    .lt('revokedAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago

  if (error) {
    console.error('Failed to cleanup revoked sessions:', error);
  }
}
```

## Database Schema

```sql
-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessToken TEXT NOT NULL UNIQUE,
  refreshToken TEXT NOT NULL UNIQUE,
  expiresAt TIMESTAMP WITH TIME ZONE NOT NULL,
  lastUsedAt TIMESTAMP WITH TIME ZONE NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  revokedAt TIMESTAMP WITH TIME ZONE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_accessToken ON sessions(accessToken);
CREATE INDEX idx_sessions_refreshToken ON sessions(refreshToken);
CREATE INDEX idx_sessions_expiresAt ON sessions(expiresAt);
CREATE INDEX idx_sessions_revokedAt ON sessions(revokedAt);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Users can insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can update their own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = userId);
```

## API Endpoints

### Login

```typescript
// app/api/auth/login/route.ts
import { createSession } from '@/lib/auth/session';
import { logLoginSuccess, logLoginFailure } from '@/lib/security/audit-events/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body;

  // Authenticate user
  const user = await authenticateUser(email, password);

  if (!user) {
    await logLoginFailure(email, 'Invalid credentials');
    return Response.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  // Create session
  const session = await createSession(
    user.id,
    getClientIP(request),
    request.headers.get('user-agent') || 'Unknown'
  );

  await logLoginSuccess(user.id);

  return Response.json({
    data: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    },
  });
}

function getClientIP(request: Request): string {
  // In a real implementation, this would get the IP from the request
  return '127.0.0.1';
}
```

### Refresh Token

```typescript
// app/api/auth/refresh/route.ts
import { refreshSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  const body = await request.json();
  const { refreshToken } = body;

  try {
    const session = await refreshSession(
      refreshToken,
      getClientIP(request),
      request.headers.get('user-agent') || 'Unknown'
    );

    return Response.json({
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    );
  }
}
```

### Logout

```typescript
// app/api/auth/logout/route.ts
import { validateSession, revokeSession } from '@/lib/auth/session';
import { logLogout } from '@/lib/security/audit-events/auth';

export async function POST(request: Request) {
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    return Response.json(
      { error: 'Missing access token' },
      { status: 401 }
    );
  }

  try {
    const session = await validateSession(accessToken);

    await revokeSession(session.id, session.userId);
    await logLogout(session.userId);

    return Response.json({
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    );
  }
}
```

### Get Sessions

```typescript
// app/api/auth/sessions/route.ts
import { requireAuth } from '@/lib/auth';
import { getUserSessions } from '@/lib/auth/session';

export async function GET(request: Request) {
  const session = await requireAuth(request);

  const sessions = await getUserSessions(session.user.id);

  return Response.json({ data: sessions });
}
```

### Revoke Session

```typescript
// app/api/auth/sessions/[id]/revoke/route.ts
import { requireAuth } from '@/lib/auth';
import { revokeSession } from '@/lib/auth/session';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(request);

  await revokeSession(params.id, session.user.id);

  return Response.json({
    data: { message: 'Session revoked' },
  });
}
```

### Revoke All Sessions

```typescript
// app/api/auth/sessions/revoke-all/route.ts
import { requireAuth } from '@/lib/auth';
import { revokeAllSessions } from '@/lib/auth/session';

export async function POST(request: Request) {
  const session = await requireAuth(request);

  await revokeAllSessions(session.user.id);

  return Response.json({
    data: { message: 'All sessions revoked' },
  });
}
```

## Middleware

### Session Validation Middleware

```typescript
// lib/middleware/session-auth.ts
import { validateSession } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function withSessionAuth(
  request: Request
) {
  try {
    // Get access token from header
    const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await validateSession(accessToken);

    // Add session data to request headers for use in route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-session-id', session.id);
    requestHeaders.set('x-user-id', session.userId);

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
// app/api/venues/route.ts
import { withSessionAuth } from '@/lib/middleware/session-auth';

export async function GET(request: Request) {
  // Authenticate with session
  const authResponse = await withSessionAuth(request);

  if (authResponse) {
    return authResponse;
  }

  // Get user ID from headers
  const userId = request.headers.get('x-user-id');

  // Get venues for user
  const { data } = await supabase
    .from('venues')
    .select('*')
    .eq('userId', userId);

  return Response.json({ data });
}
```

## Best Practices

### 1. Use Short Access Token Expiration

Use short expiration times for access tokens:

```typescript
// Good: 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Bad: 24 hours
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
```

### 2. Rotate Refresh Tokens

Rotate refresh tokens on each use:

```typescript
// Good: Rotate refresh tokens
const newRefreshToken = generateRefreshToken();

await supabase
  .from('sessions')
  .update({
    refreshToken: await hashToken(newRefreshToken),
    lastUsedAt: new Date(),
  })
  .eq('id', session.id);

// Bad: Don't rotate refresh tokens
await supabase
  .from('sessions')
  .update({
    lastUsedAt: new Date(),
  })
  .eq('id', session.id);
```

### 3. Hash Tokens

Always hash tokens before storing them:

```typescript
// Good: Hash tokens
const hashedToken = await hashToken(token);
await supabase.from('sessions').insert({
  accessToken: hashedToken,
});

// Bad: Store tokens in plain text
await supabase.from('sessions').insert({
  accessToken: token, // Plain text!
});
```

### 4. Track Session Metadata

Track session metadata for security:

```typescript
// Good: Track metadata
await supabase.from('sessions').insert({
  userId,
  accessToken: hashedToken,
  refreshToken: hashedRefreshToken,
  expiresAt,
  lastUsedAt: new Date(),
  ipAddress,
  userAgent,
});

// Bad: No metadata
await supabase.from('sessions').insert({
  userId,
  accessToken: hashedToken,
  refreshToken: hashedRefreshToken,
  expiresAt,
});
```

### 5. Implement Session Cleanup

Implement session cleanup to remove expired sessions:

```typescript
// Good: Cleanup expired sessions
export async function cleanupExpiredSessions() {
  await supabase
    .from('sessions')
    .delete()
    .lt('expiresAt', new Date());
}

// Bad: No cleanup
// No cleanup function
```

### 6. Provide Session Management

Provide a way for users to manage their sessions:

```typescript
// Good: Provide session management
export async function getUserSessions(userId: string) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('userId', userId)
    .is('revokedAt', null);

  return data;
}

// Bad: No session management
// No way to view or revoke sessions
```

### 7. Use Secure Random Generation

Use cryptographically secure random generation:

```typescript
// Good: Use crypto.randomBytes
const refreshToken = randomBytes(32).toString('hex');

// Bad: Use Math.random()
const refreshToken = Math.random().toString(36);
```

## References

- [OWASP Session Management](https://owasp.org/www-project-session-management/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Session Security](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens)
