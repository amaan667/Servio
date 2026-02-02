# Security Audit Logging to Database

This document describes the implementation of security audit logging to database for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Audit Events](#audit-events)
7. [Best Practices](#best-practices)

## Overview

Security audit logging provides a comprehensive record of all security-related events in the system. This includes:

- **Authentication events:** Logins, logouts, failed attempts
- **Authorization events:** Access granted/denied, permission changes
- **Data access events:** Read/write operations on sensitive data
- **Configuration changes:** Settings updates, feature flag changes
- **API key events:** Creation, revocation, usage

## Features

### Audit Logger

```typescript
// lib/security/audit-logger.ts
import { supabase } from '@/lib/supabase';

export interface AuditEvent {
  userId?: string;
  eventType: string;
  eventCategory: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export async function logAuditEvent(event: AuditEvent) {
  try {
    await supabase.from('security_audit_log').insert({
      userId: event.userId,
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      details: event.details,
      ipAddress: event.ipAddress || getClientIP(),
      userAgent: event.userAgent || getUserAgent(),
      success: event.success,
      errorMessage: event.errorMessage,
      timestamp: new Date(),
    });
  } catch (error) {
    // Log to console as fallback
    console.error('Failed to log audit event:', error);
    console.error('Event:', event);
  }
}

function getClientIP(): string {
  // In a real implementation, this would get the IP from the request
  return '127.0.0.1';
}

function getUserAgent(): string {
  // In a real implementation, this would get the user agent from the request
  return 'Unknown';
}
```

### Authentication Events

```typescript
// lib/security/audit-events/auth.ts
import { logAuditEvent } from '../audit-logger';

export async function logLoginSuccess(userId: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: 'login_success',
    eventCategory: 'authentication',
    details,
    success: true,
  });
}

export async function logLoginFailure(email: string, reason: string, details?: any) {
  await logAuditEvent({
    eventType: 'login_failure',
    eventCategory: 'authentication',
    details: {
      email,
      reason,
      ...details,
    },
    success: false,
    errorMessage: reason,
  });
}

export async function logLogout(userId: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: 'logout',
    eventCategory: 'authentication',
    details,
    success: true,
  });
}

export async function logPasswordResetRequest(userId: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: 'password_reset_request',
    eventCategory: 'authentication',
    details,
    success: true,
  });
}

export async function logPasswordResetSuccess(userId: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: 'password_reset_success',
    eventCategory: 'authentication',
    details,
    success: true,
  });
}

export async function log2FAEnabled(userId: string, type: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: '2fa_enabled',
    eventCategory: 'authentication',
    details: {
      type,
      ...details,
    },
    success: true,
  });
}

export async function log2FADisabled(userId: string, type: string, details?: any) {
  await logAuditEvent({
    userId,
    eventType: '2fa_disabled',
    eventCategory: 'authentication',
    details: {
      type,
      ...details,
    },
    success: true,
  });
}
```

### Authorization Events

```typescript
// lib/security/audit-events/authorization.ts
import { logAuditEvent } from '../audit-logger';

export async function logAccessGranted(
  userId: string,
  resource: string,
  action: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'access_granted',
    eventCategory: 'authorization',
    details: {
      resource,
      action,
      ...details,
    },
    success: true,
  });
}

export async function logAccessDenied(
  userId: string,
  resource: string,
  action: string,
  reason: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'access_denied',
    eventCategory: 'authorization',
    details: {
      resource,
      action,
      reason,
      ...details,
    },
    success: false,
    errorMessage: reason,
  });
}

export async function logRoleChange(
  userId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'role_change',
    eventCategory: 'authorization',
    details: {
      targetUserId,
      oldRole,
      newRole,
      ...details,
    },
    success: true,
  });
}

export async function logPermissionChange(
  userId: string,
  targetUserId: string,
  permission: string,
  granted: boolean,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'permission_change',
    eventCategory: 'authorization',
    details: {
      targetUserId,
      permission,
      granted,
      ...details,
    },
    success: true,
  });
}
```

### Data Access Events

```typescript
// lib/security/audit-events/data-access.ts
import { logAuditEvent } from '../audit-logger';

export async function logDataRead(
  userId: string,
  resource: string,
  resourceId: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'data_read',
    eventCategory: 'data_access',
    details: {
      resource,
      resourceId,
      ...details,
    },
    success: true,
  });
}

export async function logDataWrite(
  userId: string,
  resource: string,
  resourceId: string,
  operation: 'create' | 'update' | 'delete',
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'data_write',
    eventCategory: 'data_access',
    details: {
      resource,
      resourceId,
      operation,
      ...details,
    },
    success: true,
  });
}

export async function logSensitiveDataAccess(
  userId: string,
  resource: string,
  resourceId: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'sensitive_data_access',
    eventCategory: 'data_access',
    details: {
      resource,
      resourceId,
      ...details,
    },
    success: true,
  });
}
```

### API Key Events

```typescript
// lib/security/audit-events/api-keys.ts
import { logAuditEvent } from '../audit-logger';

export async function logAPIKeyCreated(
  userId: string,
  apiKeyId: string,
  name: string,
  scopes: string[],
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'api_key_created',
    eventCategory: 'api_keys',
    details: {
      apiKeyId,
      name,
      scopes,
      ...details,
    },
    success: true,
  });
}

export async function logAPIKeyRevoked(
  userId: string,
  apiKeyId: string,
  name: string,
  details?: any
) {
  await logAuditEvent({
    userId,
    eventType: 'api_key_revoked',
    eventCategory: 'api_keys',
    details: {
      apiKeyId,
      name,
      ...details,
    },
    success: true,
  });
}

export async function logAPIKeyUsed(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  details?: any
) {
  await logAuditEvent({
    eventType: 'api_key_used',
    eventCategory: 'api_keys',
    details: {
      apiKeyId,
      endpoint,
      method,
      statusCode,
      ...details,
    },
    success: statusCode < 400,
    errorMessage: statusCode >= 400 ? `HTTP ${statusCode}` : undefined,
  });
}
```

## Database Schema

```sql
-- Create security_audit_log table
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  eventType TEXT NOT NULL,
  eventCategory TEXT NOT NULL,
  details JSONB,
  ipAddress TEXT,
  userAgent TEXT,
  success BOOLEAN NOT NULL,
  errorMessage TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_security_audit_log_userId ON security_audit_log(userId);
CREATE INDEX idx_security_audit_log_eventType ON security_audit_log(eventType);
CREATE INDEX idx_security_audit_log_eventCategory ON security_audit_log(eventCategory);
CREATE INDEX idx_security_audit_log_timestamp ON security_audit_log(timestamp DESC);
CREATE INDEX idx_security_audit_log_success ON security_audit_log(success);
CREATE INDEX idx_security_audit_log_details ON security_audit_log USING GIN(details);

-- Enable RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own audit logs"
  ON security_audit_log FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Admins can view all audit logs"
  ON security_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON security_audit_log FOR INSERT
  WITH CHECK (true);

-- No update or delete policies - audit logs should be immutable
```

## API Endpoints

### Get Audit Logs

```typescript
// app/api/admin/audit-logs/route.ts
import { requireAdmin } from '@/lib/requireRole';

export async function GET(request: Request) {
  requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const userId = searchParams.get('userId');
  const eventType = searchParams.get('eventType');
  const eventCategory = searchParams.get('eventCategory');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let query = supabase
    .from('security_audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (userId) {
    query = query.eq('userId', userId);
  }

  if (eventType) {
    query = query.eq('eventType', eventType);
  }

  if (eventCategory) {
    query = query.eq('eventCategory', eventCategory);
  }

  if (startDate) {
    query = query.gte('timestamp', startDate);
  }

  if (endDate) {
    query = query.lte('timestamp', endDate);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }

  return Response.json({ data });
}
```

### Get Audit Log Statistics

```typescript
// app/api/admin/audit-logs/stats/route.ts
import { requireAdmin } from '@/lib/requireRole';

export async function GET(request: Request) {
  requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = searchParams.get('endDate') || new Date().toISOString();

  // Get total events
  const { count: totalEvents } = await supabase
    .from('security_audit_log')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  // Get events by category
  const { data: eventsByCategory } = await supabase
    .from('security_audit_log')
    .select('eventCategory')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  const categoryCounts = eventsByCategory?.reduce((acc, event) => {
    acc[event.eventCategory] = (acc[event.eventCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get events by type
  const { data: eventsByType } = await supabase
    .from('security_audit_log')
    .select('eventType')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  const typeCounts = eventsByType?.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get success rate
  const { count: successCount } = await supabase
    .from('security_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('success', true)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  const successRate = totalEvents ? (successCount || 0) / totalEvents : 0;

  return Response.json({
    data: {
      totalEvents,
      eventsByCategory: categoryCounts,
      eventsByType: typeCounts,
      successRate,
    },
  });
}
```

## Audit Events

### Authentication Events

- `login_success` - Successful login
- `login_failure` - Failed login
- `logout` - User logout
- `password_reset_request` - Password reset requested
- `password_reset_success` - Password reset successful
- `2fa_enabled` - 2FA enabled
- `2fa_disabled` - 2FA disabled

### Authorization Events

- `access_granted` - Access granted to resource
- `access_denied` - Access denied to resource
- `role_change` - User role changed
- `permission_change` - User permission changed

### Data Access Events

- `data_read` - Data read from database
- `data_write` - Data written to database
- `sensitive_data_access` - Sensitive data accessed

### API Key Events

- `api_key_created` - API key created
- `api_key_revoked` - API key revoked
- `api_key_used` - API key used

### Configuration Events

- `setting_changed` - Setting changed
- `feature_flag_changed` - Feature flag changed
- `webhook_configured` - Webhook configured
- `webhook_removed` - Webhook removed

## Best Practices

### 1. Log All Security Events

Log all security-related events:

```typescript
// Good: Log all security events
await logAuditEvent({
  userId,
  eventType: 'login_success',
  eventCategory: 'authentication',
  details,
  success: true,
});

// Bad: Don't log security events
// No logging
```

### 2. Include Context

Include relevant context in audit logs:

```typescript
// Good: Include context
await logAuditEvent({
  userId,
  eventType: 'access_denied',
  eventCategory: 'authorization',
  details: {
    resource: 'venues',
    action: 'read',
    reason: 'Insufficient permissions',
    venueId: '123',
  },
  success: false,
  errorMessage: 'Insufficient permissions',
});

// Bad: No context
await logAuditEvent({
  userId,
  eventType: 'access_denied',
  eventCategory: 'authorization',
  success: false,
});
```

### 3. Use Structured Data

Use structured data for details:

```typescript
// Good: Use structured data
details: {
  resource: 'venues',
  action: 'read',
  reason: 'Insufficient permissions',
  venueId: '123',
}

// Bad: Use unstructured strings
details: 'Access denied to venue 123 because of insufficient permissions'
```

### 4. Handle Failures Gracefully

Handle logging failures gracefully:

```typescript
// Good: Handle failures gracefully
try {
  await supabase.from('security_audit_log').insert({
    userId,
    eventType,
    eventCategory,
    details,
    success,
  });
} catch (error) {
  console.error('Failed to log audit event:', error);
  console.error('Event:', event);
}

// Bad: Don't handle failures
await supabase.from('security_audit_log').insert({
  userId,
  eventType,
  eventCategory,
  details,
  success,
});
```

### 5. Make Logs Immutable

Make audit logs immutable:

```sql
-- Good: No update or delete policies
CREATE POLICY "System can insert audit logs"
  ON security_audit_log FOR INSERT
  WITH CHECK (true);

-- No update or delete policies

-- Bad: Allow updates and deletes
CREATE POLICY "Users can update their own audit logs"
  ON security_audit_log FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Users can delete their own audit logs"
  ON security_audit_log FOR DELETE
  USING (auth.uid() = userId);
```

### 6. Index for Performance

Index audit logs for performance:

```sql
-- Good: Create indexes
CREATE INDEX idx_security_audit_log_userId ON security_audit_log(userId);
CREATE INDEX idx_security_audit_log_eventType ON security_audit_log(eventType);
CREATE INDEX idx_security_audit_log_timestamp ON security_audit_log(timestamp DESC);

-- Bad: No indexes
-- No indexes
```

### 7. Set Retention Policy

Set a retention policy for audit logs:

```sql
-- Good: Set retention policy
CREATE INDEX idx_security_audit_log_timestamp ON security_audit_log(timestamp DESC);

-- Delete logs older than 1 year
DELETE FROM security_audit_log
WHERE timestamp < NOW() - INTERVAL '1 year';

-- Bad: No retention policy
-- No retention policy
```

## References

- [Audit Logging Best Practices](https://owasp.org/www-project-audit-logging/)
- [Security Logging](https://csrc.nist.gov/publications/detail/sp/800-92)
- [Audit Trail](https://en.wikipedia.org/wiki/Audit_trail)
