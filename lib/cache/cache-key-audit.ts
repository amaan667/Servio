// ============================================================================
// CACHE KEY AUDIT - MULTI-TENANT ISOLATION VERIFICATION
// Ensures all cache keys are properly namespaced by tenant
// ============================================================================

export interface CacheKeyPattern {
  pattern: RegExp;
  description: string;
  tenantRequired: boolean;
  namespace?: string;
}

export interface CacheKeyViolation {
  key: string;
  pattern: string;
  issue: 'missing_tenant' | 'invalid_format' | 'potential_collision';
  severity: 'critical' | 'high' | 'medium';
  suggestion: string;
}

// Known cache key patterns in the codebase
export const CACHE_KEY_PATTERNS: CacheKeyPattern[] = [
  { pattern: /^menu:\w+:\w+$/, description: 'Menu cache keys', tenantRequired: true, namespace: 'menu' },
  { pattern: /^venue:\w+:\w+$/, description: 'Venue cache keys', tenantRequired: true, namespace: 'venue' },
  { pattern: /^order:\w+:\w+$/, description: 'Order cache keys', tenantRequired: true, namespace: 'order' },
  { pattern: /^inventory:\w+:\w+$/, description: 'Inventory cache keys', tenantRequired: true, namespace: 'inventory' },
  { pattern: /^session:\w+$/, description: 'Session keys', tenantRequired: false, namespace: 'session' },
  { pattern: /^count:\w+:\w+$/, description: 'Count cache keys', tenantRequired: true, namespace: 'count' },
  { pattern: /^realtime:\w+:\w+$/, description: 'Realtime subscription keys', tenantRequired: true, namespace: 'realtime' },
  { pattern: /^table:\w+:\w+$/, description: 'Table cache keys', tenantRequired: true, namespace: 'table' },
  { pattern: /^staff:\w+:\w+$/, description: 'Staff cache keys', tenantRequired: true, namespace: 'staff' },
  { pattern: /^payment:\w+:\w+$/, description: 'Payment cache keys', tenantRequired: true, namespace: 'payment' },
  { pattern: /^kds:\w+:\w+$/, description: 'KDS (Kitchen Display) keys', tenantRequired: true, namespace: 'kds' },
  { pattern: /^reservation:\w+:\w+$/, description: 'Reservation keys', tenantRequired: true, namespace: 'reservation' },
];

// Prefixes that indicate a potential tenant isolation issue
const SUSPICIOUS_PREFIXES = [
  'menu', 'venue', 'order', 'inventory', 'count', 'table', 
  'staff', 'payment', 'kds', 'reservation'
];

/**
 * Audit a single cache key for tenant isolation
 */
export function auditCacheKey(key: string): CacheKeyViolation | null {
  // Check if key matches any known pattern
  for (const patternDef of CACHE_KEY_PATTERNS) {
    if (patternDef.pattern.test(key)) {
      // If pattern requires tenant but key doesn't have it
      if (patternDef.tenantRequired && !containsTenantIdentifier(key)) {
        return {
          key,
          pattern: patternDef.pattern.source,
          issue: 'missing_tenant',
          severity: 'critical',
          suggestion: `Add tenant ID to key format: ${patternDef.namespace}:{tenantId}:{resourceId}`,
        };
      }
      return null; // Valid key
    }
  }

  // Check for suspicious patterns that might indicate missing tenant isolation
  for (const prefix of SUSPICIOUS_PREFIXES) {
    if (key.startsWith(`${prefix}:`) && !containsTenantIdentifier(key)) {
      return {
        key,
        pattern: `^${prefix}:[^:]+$`,
        issue: 'missing_tenant',
        severity: 'critical',
        suggestion: `Add tenant ID: ${prefix}:{tenantId}:{resourceId}`,
      };
    }
  }

  // Check for potential collisions (very short keys)
  if (key.length < 10) {
    return {
      key,
      pattern: '.+',
      issue: 'potential_collision',
      severity: 'medium',
      suggestion: 'Key is very short and may cause collisions',
    };
  }

  return null;
}

/**
 * Check if a key contains a tenant identifier pattern
 */
function containsTenantIdentifier(key: string): boolean {
  // UUID format (36 chars with dashes)
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(key)) {
    return true;
  }

  // Tenant prefix pattern (e.g., "tenant_abc123")
  if (/tenant[_-][a-z0-9]+/i.test(key)) {
    return true;
  }

  // Check for two colons after the namespace (namespace:tenantId:resourceId)
  const parts = key.split(':');
  if (parts.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Audit a list of cache keys
 */
export function auditCacheKeys(keys: string[]): CacheKeyViolation[] {
  const violations: CacheKeyViolation[] = [];

  for (const key of keys) {
    const violation = auditCacheKey(key);
    if (violation) {
      violations.push(violation);
    }
  }

  return violations;
}

/**
 * Generate a properly namespaced cache key
 */
export function generateCacheKey(
  namespace: string,
  tenantId: string,
  ...parts: string[]
): string {
  return [namespace, tenantId, ...parts].join(':');
}

/**
 * Validate cache key format
 */
export function validateCacheKeyFormat(key: string): {
  valid: boolean;
  namespace?: string;
  tenantId?: string;
  resourceId?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const parts = key.split(':');

  if (parts.length < 2) {
    errors.push('Key must have at least 2 parts (namespace:...)');
    return { valid: false, errors };
  }

  const namespace = parts[0];

  // Check if namespace requires tenant isolation
  const patternDef = CACHE_KEY_PATTERNS.find((p) => p.pattern.test(key));
  
  if (patternDef?.tenantRequired && parts.length < 3) {
    errors.push('Tenant isolation required but missing tenant ID');
  }

  return {
    valid: errors.length === 0,
    namespace,
    tenantId: parts[1],
    resourceId: parts.slice(2).join(':'),
    errors,
  };
}

// ============================================================================
// CACHE KEY GENERATOR FOR COMMON PATTERNS
// ============================================================================

export const CacheKeyGenerators = {
  menu: (tenantId: string, menuId: string) => `menu:${tenantId}:${menuId}`,
  venue: (tenantId: string, venueId: string) => `venue:${tenantId}:${venueId}`,
  order: (tenantId: string, orderId: string) => `order:${tenantId}:${orderId}`,
  inventory: (tenantId: string, inventoryId: string) => `inventory:${tenantId}:${inventoryId}`,
  count: (tenantId: string, countType: string) => `count:${tenantId}:${countType}`,
  table: (tenantId: string, tableId: string) => `table:${tenantId}:${tableId}`,
  staff: (tenantId: string, staffId: string) => `staff:${tenantId}:${staffId}`,
  payment: (tenantId: string, paymentId: string) => `payment:${tenantId}:${paymentId}`,
  kds: (tenantId: string, venueId: string) => `kds:${tenantId}:${venueId}`,
  reservation: (tenantId: string, reservationId: string) => 
    `reservation:${tenantId}:${reservationId}`,
  realtime: (tenantId: string, channel: string) => `realtime:${tenantId}:${channel}`,
  session: (sessionId: string) => `session:${sessionId}`,
};

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Audit all keys in a cache store and generate migration report
 */
export function auditCacheStore(
  keys: string[],
  tenantId: string
): {
  totalKeys: number;
  violations: CacheKeyViolation[];
  needsMigration: boolean;
  migrationScript: string;
} {
  const violations = auditCacheKeys(keys);
  const needsMigration = violations.some((v) => v.severity === 'critical');

  // Generate migration script
  const migrationScript = violations
    .filter((v) => v.issue === 'missing_tenant')
    .map((v) => {
      const namespace = v.key.split(':')[0];
      return `RENAME ${v.key} TO ${namespace}:${tenantId}:${v.key.split(':').slice(1).join(':')}`;
    })
    .join('\n');

  return {
    totalKeys: keys.length,
    violations,
    needsMigration,
    migrationScript,
  };
}

/**
 * Check if a key is properly isolated for the given tenant
 */
export function isIsolatedForTenant(key: string, tenantId: string): boolean {
  // Check if key starts with tenant ID
  if (key.includes(tenantId)) {
    return true;
  }

  // Check if key has the correct namespace:tenantId format
  const parts = key.split(':');
  if (parts.length >= 2 && parts[1] === tenantId) {
    return true;
  }

  return false;
}

/**
 * Filter keys that are not isolated for a tenant
 */
export function filterKeysForTenant(keys: string[], tenantId: string): string[] {
  return keys.filter((key) => !isIsolatedForTenant(key, tenantId));
}
