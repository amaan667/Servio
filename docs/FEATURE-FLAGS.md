# Feature Flags System

This document describes the feature flags strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Benefits](#benefits)
3. [Tools](#tools)
4. [Implementation](#implementation)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [Best Practices](#best-practices)

## Overview

Feature flags allow you to enable or disable features without deploying new code. This helps:

- **Gradual Rollouts**: Roll out features to users gradually
- **A/B Testing**: Test different variations of features
- **Emergency Disable**: Quickly disable problematic features
- **Targeted Rollouts**: Enable features for specific users or segments

## Benefits

### For Development Teams
- **Faster Iteration**: Ship features faster
- **Reduced Risk**: Test features in production safely
- **Better Control**: Control feature availability

### For Product Teams
- **Data-Driven Decisions**: Make decisions based on metrics
- **User Segmentation**: Target specific user groups
- **Quick Rollbacks**: Disable features instantly

## Tools

### LaunchDarkly

LaunchDarkly is a feature flag management platform.

**Pros:**
- Easy to use
- Good UI
- Real-time updates
- A/B testing support

**Cons:**
- Paid service
- Limited free tier

### Unleash

Unleash is an open-source feature flag management system.

**Pros:**
- Open source
- Self-hosted
- Good documentation
- Active community

**Cons:**
- Requires setup and maintenance
- Less polished UI

### Split

Split is a feature flag and experimentation platform.

**Pros:**
- Good documentation
- SDKs for multiple languages
- A/B testing support

**Cons:**
- Paid service
- Learning curve

### Custom Implementation

Build a custom feature flag system.

**Pros:**
- Full control
- No external dependencies
- Customizable

**Cons:**
- Requires development effort
- Maintenance overhead

## Implementation

### Option 1: LaunchDarkly

#### Installation

```bash
npm install launchdarkly-node-server-sdk
```

#### Configuration

```typescript
// lib/feature-flags/launchdarkly.ts
import { LaunchDarkly } from 'launchdarkly-node-server-sdk';

const client = LaunchDarkly.init({
  sdkKey: process.env.LAUNCHDARKLY_SDK_KEY,
});

export async function isFeatureEnabled(
  featureKey: string,
  userId?: string,
  context?: Record<string, any>
): Promise<boolean> {
  try {
    const flag = await client.variation(featureKey, userId, context);
    return flag;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false; // Default to disabled on error
  }
}

export async function getFeatureVariation<T>(
  featureKey: string,
  userId?: string,
  context?: Record<string, any>
): Promise<T | null> {
  try {
    const variation = await client.variation(featureKey, userId, context);
    return variation;
  } catch (error) {
    console.error('Error getting feature variation:', error);
    return null;
  }
}
```

#### Usage

```typescript
// app/dashboard/page.tsx
import { isFeatureEnabled } from '@/lib/feature-flags/launchdarkly';

export default async function DashboardPage({ userId }: { userId: string }) {
  const showNewDashboard = await isFeatureEnabled('new-dashboard', userId);

  return (
    <div>
      {showNewDashboard ? (
        <NewDashboard />
      ) : (
        <OldDashboard />
      )}
    </div>
  );
}
```

### Option 2: Unleash

#### Installation

```bash
npm install unleash-client
```

#### Configuration

```typescript
// lib/feature-flags/unleash.ts
import { UnleashClient } from 'unleash-client';

const client = new UnleashClient({
  url: process.env.UNLEASH_URL,
  appName: 'servio',
  environment: process.env.NODE_ENV || 'development',
  customHeaders: {
    'Authorization': process.env.UNLEASH_API_TOKEN,
  },
});

export async function isFeatureEnabled(
  featureKey: string,
  userId?: string
): Promise<boolean> {
  try {
    const enabled = await client.isEnabled(featureKey, userId);
    return enabled;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false;
  }
}

export async function getFeatureVariation<T>(
  featureKey: string,
  userId?: string
): Promise<T | null> {
  try {
    const variation = await client.getVariant(featureKey, userId);
    return variation.payload as T;
  } catch (error) {
    console.error('Error getting feature variation:', error);
    return null;
  }
}
```

#### Usage

```typescript
// app/orders/page.tsx
import { isFeatureEnabled, getFeatureVariation } from '@/lib/feature-flags/unleash';

export default async function OrdersPage({ userId }: { userId: string }) {
  const showAdvancedFilters = await isFeatureEnabled('advanced-filters', userId);
  const orderListVariant = await getFeatureVariation<{ layout: 'list' | 'grid' }>(
    'order-list-layout',
    userId
  );

  return (
    <div>
      {showAdvancedFilters && <AdvancedFilters />}
      {orderListVariant?.layout === 'grid' ? (
        <OrderGrid />
      ) : (
        <OrderList />
      )}
    </div>
  );
}
```

### Option 3: Custom Implementation

#### Database Schema

```sql
-- migrations/feature-flags.sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  type VARCHAR(50) DEFAULT 'boolean',
  variations JSONB,
  targeting_rules JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flag_user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL,
  variation JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feature_flag_id, user_id)
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flag_user_overrides ON feature_flag_user_overrides(user_id, feature_flag_id);
```

#### Service Implementation

```typescript
// lib/services/FeatureFlagService.ts
import { supabase } from '@/lib/supabase';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: 'boolean' | 'string' | 'number' | 'json';
  variations?: Record<string, any>;
  targetingRules?: any[];
}

export interface FeatureFlagUserOverride {
  id: string;
  featureFlagId: string;
  userId: string;
  enabled: boolean;
  variation?: any;
}

export class FeatureFlagService {
  async getFeatureFlag(key: string): Promise<FeatureFlag | null> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('key', key)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async createFeatureFlag(flag: Omit<FeatureFlag, 'id'>): Promise<FeatureFlag> {
    const { data, error } = await supabase
      .from('feature_flags')
      .insert(flag)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFeatureFlag(
    id: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag> {
    const { data, error } = await supabase
      .from('feature_flags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteFeatureFlag(id: string): Promise<void> {
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getUserOverride(
    featureFlagId: string,
    userId: string
  ): Promise<FeatureFlagUserOverride | null> {
    const { data, error } = await supabase
      .from('feature_flag_user_overrides')
      .select('*')
      .eq('feature_flag_id', featureFlagId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async setUserOverride(
    featureFlagId: string,
    userId: string,
    enabled: boolean,
    variation?: any
  ): Promise<FeatureFlagUserOverride> {
    const { data, error } = await supabase
      .from('feature_flag_user_overrides')
      .upsert({
        feature_flag_id: featureFlagId,
        user_id: userId,
        enabled,
        variation,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUserOverride(
    featureFlagId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('feature_flag_user_overrides')
      .delete()
      .eq('feature_flag_id', featureFlagId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async isFeatureEnabled(
    key: string,
    userId?: string
  ): Promise<boolean> {
    const flag = await this.getFeatureFlag(key);

    if (!flag) return false;

    // Check user override
    if (userId) {
      const override = await this.getUserOverride(flag.id, userId);
      if (override) return override.enabled;
    }

    // Check targeting rules
    if (flag.targetingRules && userId) {
      const user = await this.getUserContext(userId);
      for (const rule of flag.targetingRules) {
        if (this.evaluateRule(rule, user)) {
          return rule.enabled;
        }
      }
    }

    return flag.enabled;
  }

  async getFeatureVariation<T>(
    key: string,
    userId?: string
  ): Promise<T | null> {
    const flag = await this.getFeatureFlag(key);

    if (!flag || flag.type !== 'json') return null;

    // Check user override
    if (userId) {
      const override = await this.getUserOverride(flag.id, userId);
      if (override && override.variation) {
        return override.variation as T;
      }
    }

    // Return default variation
    return flag.variations?.default as T || null;
  }

  private async getUserContext(userId: string): Promise<any> {
    // Fetch user context for targeting rules
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return data;
  }

  private evaluateRule(rule: any, user: any): boolean {
    // Implement rule evaluation logic
    // This can include percentage rollouts, user segments, etc.
    return true;
  }
}

export const featureFlagService = new FeatureFlagService();
```

#### React Hook

```typescript
// hooks/useFeatureFlag.ts
import { useState, useEffect } from 'react';
import { featureFlagService } from '@/lib/services/FeatureFlagService';

export function useFeatureFlag(key: string, userId?: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkFlag() {
      setLoading(true);
      const isEnabled = await featureFlagService.isFeatureEnabled(key, userId);
      setEnabled(isEnabled);
      setLoading(false);
    }

    checkFlag();
  }, [key, userId]);

  return { enabled, loading };
}

export function useFeatureVariation<T>(key: string, userId?: string) {
  const [variation, setVariation] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getVariation() {
      setLoading(true);
      const var = await featureFlagService.getFeatureVariation<T>(key, userId);
      setVariation(var);
      setLoading(false);
    }

    getVariation();
  }, [key, userId]);

  return { variation, loading };
}
```

#### Usage

```typescript
// app/dashboard/page.tsx
import { useFeatureFlag, useFeatureVariation } from '@/hooks/useFeatureFlag';

export default function DashboardPage({ userId }: { userId: string }) {
  const { enabled: showNewDashboard, loading: dashboardLoading } = useFeatureFlag(
    'new-dashboard',
    userId
  );

  const { variation: layoutVariation, loading: layoutLoading } = useFeatureVariation<{
    layout: 'list' | 'grid';
  }>('dashboard-layout', userId);

  if (dashboardLoading || layoutLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {showNewDashboard ? (
        <NewDashboard layout={layoutVariation?.layout || 'list'} />
      ) : (
        <OldDashboard />
      )}
    </div>
  );
}
```

## Configuration

### Environment Variables

```bash
# LaunchDarkly
LAUNCHDARKLY_SDK_KEY=your-sdk-key

# Unleash
UNLEASH_URL=https://unleash.example.com
UNLEASH_API_TOKEN=your-api-token

# Custom
FEATURE_FLAGS_ENABLED=true
```

### Feature Flag Definitions

```typescript
// lib/feature-flags/definitions.ts
export const FEATURE_FLAGS = {
  // New Features
  NEW_DASHBOARD: {
    key: 'new-dashboard',
    name: 'New Dashboard',
    description: 'Enable the new dashboard UI',
    type: 'boolean',
    enabled: false,
  },

  // A/B Testing
  ORDER_LIST_LAYOUT: {
    key: 'order-list-layout',
    name: 'Order List Layout',
    description: 'A/B test for order list layout',
    type: 'json',
    enabled: true,
    variations: {
      default: { layout: 'list' },
      grid: { layout: 'grid' },
    },
    targetingRules: [
      {
        name: '50% rollout',
        percentage: 50,
        enabled: true,
        variation: 'grid',
      },
    ],
  },

  // Gradual Rollout
  ADVANCED_FILTERS: {
    key: 'advanced-filters',
    name: 'Advanced Filters',
    description: 'Enable advanced filtering options',
    type: 'boolean',
    enabled: false,
    targetingRules: [
      {
        name: '10% rollout',
        percentage: 10,
        enabled: true,
      },
    ],
  },

  // User Segmentation
  AI_ASSISTANT: {
    key: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Enable AI assistant feature',
    type: 'boolean',
    enabled: false,
    targetingRules: [
      {
        name: 'Premium users only',
        segment: 'premium',
        enabled: true,
      },
    ],
  },
} as const;
```

## Usage

### Server-Side

```typescript
// app/api/orders/route.ts
import { featureFlagService } from '@/lib/services/FeatureFlagService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const showAdvancedFilters = await featureFlagService.isFeatureEnabled(
    'advanced-filters',
    userId
  );

  // ... rest of the code
}
```

### Client-Side

```typescript
// components/OrderList.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function OrderList({ userId }: { userId: string }) {
  const { enabled: showAdvancedFilters } = useFeatureFlag('advanced-filters', userId);

  return (
    <div>
      {showAdvancedFilters && <AdvancedFilters />}
      <OrderItems />
    </div>
  );
}
```

### Admin Panel

```typescript
// app/admin/feature-flags/page.tsx
import { featureFlagService } from '@/lib/services/FeatureFlagService';

export default async function FeatureFlagsPage() {
  const flags = await featureFlagService.getAllFeatureFlags();

  return (
    <div>
      <h1>Feature Flags</h1>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Name</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => (
            <tr key={flag.id}>
              <td>{flag.key}</td>
              <td>{flag.name}</td>
              <td>{flag.enabled ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => toggleFlag(flag.id)}>
                  Toggle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function toggleFlag(id: string) {
  const flag = await featureFlagService.getFeatureFlag(id);
  if (flag) {
    await featureFlagService.updateFeatureFlag(id, {
      enabled: !flag.enabled,
    });
  }
}
```

## Best Practices

### 1. Use Descriptive Names

Use descriptive names for feature flags:

```typescript
// Good
const FEATURE_FLAGS = {
  NEW_DASHBOARD: { key: 'new-dashboard', name: 'New Dashboard' },
  ADVANCED_FILTERS: { key: 'advanced-filters', name: 'Advanced Filters' },
};

// Bad
const FEATURE_FLAGS = {
  FLAG_1: { key: 'flag1', name: 'Flag 1' },
  FLAG_2: { key: 'flag2', name: 'Flag 2' },
};
```

### 2. Clean Up Old Flags

Remove old feature flags:

```typescript
// After feature is fully rolled out
await featureFlagService.deleteFeatureFlag('new-dashboard');
```

### 3. Use Targeting Rules

Use targeting rules for gradual rollouts:

```typescript
const FEATURE_FLAGS = {
  NEW_FEATURE: {
    key: 'new-feature',
    targetingRules: [
      { percentage: 10, enabled: true },  // 10% of users
      { percentage: 25, enabled: true },  // 25% of users
      { percentage: 50, enabled: true },  // 50% of users
      { percentage: 100, enabled: true }, // 100% of users
    ],
  },
};
```

### 4. Monitor Feature Usage

Monitor feature flag usage:

```typescript
// Track feature usage
async function trackFeatureUsage(key: string, userId: string) {
  await supabase.from('feature_flag_usage').insert({
    featureKey: key,
    userId,
    timestamp: new Date(),
  });
}
```

### 5. Document Flags

Document all feature flags:

```markdown
# Feature Flags

## new-dashboard
- **Description**: Enable the new dashboard UI
- **Type**: Boolean
- **Enabled**: false
- **Targeting**: None
- **Rollout Plan**: Gradual rollout starting at 10%

## advanced-filters
- **Description**: Enable advanced filtering options
- **Type**: Boolean
- **Enabled**: false
- **Targeting**: Premium users only
- **Rollout Plan**: Premium users first, then all users
```

### 6. Test Flags

Test feature flags in all states:

```typescript
// Test with flag enabled
await featureFlagService.updateFeatureFlag('new-dashboard', { enabled: true });

// Test with flag disabled
await featureFlagService.updateFeatureFlag('new-dashboard', { enabled: false });

// Test with user override
await featureFlagService.setUserOverride('new-dashboard', userId, true);
```

### 7. Use Feature Gates

Use feature gates for complex features:

```typescript
// Good: Feature gates
if (await isFeatureEnabled('new-dashboard')) {
  return <NewDashboard />;
} else {
  return <OldDashboard />;
}

// Bad: Nested conditions
if (await isFeatureEnabled('new-dashboard')) {
  if (await isFeatureEnabled('advanced-filters')) {
    if (await isFeatureEnabled('ai-assistant')) {
      return <ComplexComponent />;
    }
  }
}
```

## References

- [LaunchDarkly Documentation](https://docs.launchdarkly.com/)
- [Unleash Documentation](https://docs.getunleash.io/)
- [Split Documentation](https://help.split.io/)
- [Feature Flag Best Practices](https://martinfowler.com/articles/feature-toggles.html)
