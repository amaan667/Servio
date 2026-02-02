# A/B Testing Framework

This document describes the A/B testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Benefits](#benefits)
3. [Tools](#tools)
4. [Implementation](#implementation)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [Best Practices](#best-practices)

## Overview

A/B testing allows you to compare two versions of a feature to determine which performs better. This helps:

- **Data-Driven Decisions**: Make decisions based on metrics
- **Optimize Conversions**: Improve conversion rates
- **Reduce Risk**: Test changes before full rollout
- **Continuous Improvement**: Iterate on features

## Benefits

### For Product Teams
- **Better UX**: Identify which design performs better
- **Higher Conversions**: Optimize for conversions
- **Reduced Churn**: Improve user retention

### For Engineering Teams
- **Safe Rollouts**: Test changes safely
- **Quick Feedback**: Get feedback quickly
- **Evidence-Based**: Make decisions with data

## Tools

### Optimizely

Optimizely is a leading experimentation platform.

**Pros:**
- Easy to use
- Good UI
- Real-time results
- Advanced targeting

**Cons:**
- Paid service
- Learning curve

### VWO

VWO is a conversion optimization platform.

**Pros:**
- Good documentation
- A/B testing support
- Heatmaps and recordings

**Cons:**
- Paid service
- Limited free tier

### Custom Implementation

Build a custom A/B testing framework.

**Pros:**
- Full control
- No external dependencies
- Customizable

**Cons:**
- Requires development effort
- Maintenance overhead

## Implementation

### Database Schema

```sql
-- migrations/ab-testing.sql
CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  allocation_percentage INTEGER DEFAULT 50,
  is_control BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES ab_variants(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(experiment_id, user_id)
);

CREATE TABLE IF NOT EXISTS ab_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES ab_variants(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ab_experiments_key ON ab_experiments(key);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX idx_ab_assignments_user ON ab_assignments(user_id);
CREATE INDEX idx_ab_events_experiment ON ab_events(experiment_id);
CREATE INDEX idx_ab_events_user ON ab_events(user_id);
```

### Service Implementation

```typescript
// lib/services/ABTestingService.ts
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/structured-logger';

const logger = createLogger('ab-testing');

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
}

export interface Variant {
  id: string;
  experimentId: string;
  key: string;
  name: string;
  description?: string;
  allocationPercentage: number;
  isControl: boolean;
}

export interface Assignment {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
}

export interface Event {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  eventType: string;
  eventData?: any;
  timestamp: Date;
}

export class ABTestingService {
  async getExperiment(key: string): Promise<Experiment | null> {
    const { data, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .eq('key', key)
      .eq('status', 'running')
      .single();

    if (error) throw error;
    return data;
  }

  async getAllExperiments(): Promise<Experiment[]> {
    const { data, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createExperiment(experiment: Omit<Experiment, 'id'>): Promise<Experiment> {
    const { data, error } = await supabase
      .from('ab_experiments')
      .insert(experiment)
      .select()
      .single();

    if (error) throw error;
    logger.info('Experiment created', { key: experiment.key });
    return data;
  }

  async updateExperiment(
    id: string,
    updates: Partial<Experiment>
  ): Promise<Experiment> {
    const { data, error } = await supabase
      .from('ab_experiments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    logger.info('Experiment updated', { id, updates });
    return data;
  }

  async deleteExperiment(id: string): Promise<void> {
    const { error } = await supabase
      .from('ab_experiments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    logger.info('Experiment deleted', { id });
  }

  async getVariants(experimentId: string): Promise<Variant[]> {
    const { data, error } = await supabase
      .from('ab_variants')
      .select('*')
      .eq('experiment_id', experimentId);

    if (error) throw error;
    return data || [];
  }

  async createVariant(variant: Omit<Variant, 'id'>): Promise<Variant> {
    const { data, error } = await supabase
      .from('ab_variants')
      .insert(variant)
      .select()
      .single();

    if (error) throw error;
    logger.info('Variant created', { key: variant.key });
    return data;
  }

  async assignVariant(
    experimentKey: string,
    userId: string
  ): Promise<Variant | null> {
    // Check if user already assigned
    const { data: existingAssignment } = await supabase
      .from('ab_assignments')
      .select('*, variants(*)')
      .eq('user_id', userId)
      .eq('experiment_id', (await this.getExperiment(experimentKey))?.id)
      .single();

    if (existingAssignment) {
      return existingAssignment.variants;
    }

    // Get experiment and variants
    const experiment = await this.getExperiment(experimentKey);
    if (!experiment) return null;

    const variants = await this.getVariants(experiment.id);
    if (variants.length === 0) return null;

    // Assign variant based on allocation percentage
    const variant = this.assignVariantByPercentage(variants, userId);

    // Save assignment
    await supabase.from('ab_assignments').insert({
      experimentId: experiment.id,
      variantId: variant.id,
      userId,
    });

    logger.info('Variant assigned', {
      experimentKey,
      userId,
      variantKey: variant.key,
    });

    return variant;
  }

  private assignVariantByPercentage(variants: Variant[], userId: string): Variant {
    // Use consistent hashing for deterministic assignment
    const hash = this.hashString(userId);
    const percentage = hash % 100;

    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.allocationPercentage;
      if (percentage < cumulativePercentage) {
        return variant;
      }
    }

    // Default to first variant
    return variants[0];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async trackEvent(
    experimentKey: string,
    userId: string,
    eventType: string,
    eventData?: any
  ): Promise<void> {
    const experiment = await this.getExperiment(experimentKey);
    if (!experiment) return;

    const assignment = await this.getAssignment(experiment.id, userId);
    if (!assignment) return;

    await supabase.from('ab_events').insert({
      experimentId: experiment.id,
      variantId: assignment.variantId,
      userId,
      eventType,
      eventData,
    });

    logger.info('Event tracked', {
      experimentKey,
      userId,
      eventType,
    });
  }

  private async getAssignment(
    experimentId: string,
    userId: string
  ): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('ab_assignments')
      .select('*')
      .eq('experiment_id', experimentId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async getResults(experimentId: string): Promise<any> {
    const { data, error } = await supabase.rpc('get_ab_experiment_results', {
      experiment_id: experimentId,
    });

    if (error) throw error;
    return data;
  }

  async getConversionRate(
    experimentId: string,
    variantId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('get_ab_conversion_rate', {
      experiment_id: experimentId,
      variant_id: variantId,
    });

    if (error) throw error;
    return data;
  }
}

export const abTestingService = new ABTestingService();
```

### React Hook

```typescript
// hooks/useABTest.ts
import { useState, useEffect } from 'react';
import { abTestingService } from '@/lib/services/ABTestingService';

export function useABTest(experimentKey: string, userId: string) {
  const [variant, setVariant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function assignVariant() {
      setLoading(true);
      const assignedVariant = await abTestingService.assignVariant(
        experimentKey,
        userId
      );
      setVariant(assignedVariant);
      setLoading(false);
    }

    assignVariant();
  }, [experimentKey, userId]);

  const trackEvent = async (eventType: string, eventData?: any) => {
    await abTestingService.trackEvent(experimentKey, userId, eventType, eventData);
  };

  return { variant, loading, trackEvent };
}
```

### Usage

```typescript
// app/orders/page.tsx
import { useABTest } from '@/hooks/useABTest';

export default function OrdersPage({ userId }: { userId: string }) {
  const { variant, loading, trackEvent } = useABTest('order-list-layout', userId);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {variant?.key === 'grid' ? (
        <OrderGrid onOrderClick={() => trackEvent('order_clicked')} />
      ) : (
        <OrderList onOrderClick={() => trackEvent('order_clicked')} />
      )}
    </div>
  );
}
```

## Configuration

### Experiment Definitions

```typescript
// lib/ab-testing/experiments.ts
export const EXPERIMENTS = {
  ORDER_LIST_LAYOUT: {
    key: 'order-list-layout',
    name: 'Order List Layout',
    description: 'A/B test for order list layout (list vs grid)',
    variants: [
      {
        key: 'list',
        name: 'List Layout',
        allocationPercentage: 50,
        isControl: true,
      },
      {
        key: 'grid',
        name: 'Grid Layout',
        allocationPercentage: 50,
        isControl: false,
      },
    ],
  },

  CHECKOUT_BUTTON_COLOR: {
    key: 'checkout-button-color',
    name: 'Checkout Button Color',
    description: 'A/B test for checkout button color',
    variants: [
      {
        key: 'blue',
        name: 'Blue Button',
        allocationPercentage: 33,
        isControl: true,
      },
      {
        key: 'green',
        name: 'Green Button',
        allocationPercentage: 33,
        isControl: false,
      },
      {
        key: 'red',
        name: 'Red Button',
        allocationPercentage: 34,
        isControl: false,
      },
    ],
  },

  PRICING_DISPLAY: {
    key: 'pricing-display',
    name: 'Pricing Display',
    description: 'A/B test for pricing display format',
    variants: [
      {
        key: 'with-tax',
        name: 'With Tax',
        allocationPercentage: 50,
        isControl: true,
      },
      {
        key: 'without-tax',
        name: 'Without Tax',
        allocationPercentage: 50,
        isControl: false,
      },
    ],
  },
} as const;
```

### Event Types

```typescript
// lib/ab-testing/events.ts
export const EVENT_TYPES = {
  // Page View Events
  PAGE_VIEW: 'page_view',
  HOME_PAGE_VIEW: 'home_page_view',
  ORDERS_PAGE_VIEW: 'orders_page_view',

  // Interaction Events
  BUTTON_CLICK: 'button_click',
  LINK_CLICK: 'link_click',
  FORM_SUBMIT: 'form_submit',

  // Conversion Events
  SIGN_UP: 'sign_up',
  LOGIN: 'login',
  ORDER_CREATED: 'order_created',
  PAYMENT_COMPLETED: 'payment_completed',

  // Engagement Events
  TIME_ON_PAGE: 'time_on_page',
  SCROLL_DEPTH: 'scroll_depth',
  FEATURE_USED: 'feature_used',
} as const;
```

## Usage

### Server-Side

```typescript
// app/api/orders/route.ts
import { abTestingService } from '@/lib/services/ABTestingService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const variant = await abTestingService.assignVariant('order-list-layout', userId);

  // Track page view
  await abTestingService.trackEvent('order-list-layout', userId, 'page_view');

  // ... rest of the code
}
```

### Client-Side

```typescript
// components/CheckoutButton.tsx
import { useABTest } from '@/hooks/useABTest';

export function CheckoutButton({ userId }: { userId: string }) {
  const { variant, trackEvent } = useABTest('checkout-button-color', userId);

  const handleClick = async () => {
    await trackEvent('button_click', { buttonColor: variant?.key });
    // ... handle checkout
  };

  const getButtonColor = () => {
    switch (variant?.key) {
      case 'blue':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'green':
        return 'bg-green-500 hover:bg-green-600';
      case 'red':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`px-4 py-2 rounded text-white ${getButtonColor()}`}
    >
      Checkout
    </button>
  );
}
```

### Admin Panel

```typescript
// app/admin/ab-testing/page.tsx
import { abTestingService } from '@/lib/services/ABTestingService';

export default async function ABTestingPage() {
  const experiments = await abTestingService.getAllExperiments();

  return (
    <div>
      <h1>A/B Testing</h1>
      <button onClick={createExperiment}>Create Experiment</button>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {experiments.map((experiment) => (
            <tr key={experiment.id}>
              <td>{experiment.key}</td>
              <td>{experiment.name}</td>
              <td>{experiment.status}</td>
              <td>
                <button onClick={() => viewResults(experiment.id)}>
                  Results
                </button>
                <button onClick={() => pauseExperiment(experiment.id)}>
                  Pause
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function createExperiment() {
  await abTestingService.createExperiment({
    key: 'new-experiment',
    name: 'New Experiment',
    status: 'draft',
  });
}

async function viewResults(experimentId: string) {
  const results = await abTestingService.getResults(experimentId);
  // Display results
}

async function pauseExperiment(experimentId: string) {
  await abTestingService.updateExperiment(experimentId, {
    status: 'paused',
  });
}
```

## Best Practices

### 1. Use Control Groups

Always have a control group:

```typescript
// Good: Control group
const variants = [
  { key: 'control', isControl: true, allocationPercentage: 50 },
  { key: 'variant', isControl: false, allocationPercentage: 50 },
];

// Bad: No control group
const variants = [
  { key: 'variant1', allocationPercentage: 50 },
  { key: 'variant2', allocationPercentage: 50 },
];
```

### 2. Run Tests Long Enough

Run tests for sufficient time:

```typescript
// Good: Run for 2 weeks
const experiment = {
  startDate: new Date(),
  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
};

// Bad: Run for 1 day
const experiment = {
  startDate: new Date(),
  endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
};
```

### 3. Track Relevant Metrics

Track metrics that matter:

```typescript
// Good: Track conversion metrics
await trackEvent('order_created');
await trackEvent('payment_completed');

// Bad: Track irrelevant metrics
await trackEvent('page_loaded');
await trackEvent('mouse_moved');
```

### 4. Statistical Significance

Use statistical significance:

```typescript
// Calculate statistical significance
function calculateSignificance(
  controlConversions: number,
  controlTotal: number,
  variantConversions: number,
  variantTotal: number
): { significant: boolean; pValue: number } {
  // Implement statistical test (e.g., chi-squared test)
  const pValue = calculatePValue(
    controlConversions,
    controlTotal,
    variantConversions,
    variantTotal
  );

  return {
    significant: pValue < 0.05,
    pValue,
  };
}
```

### 5. Don't Change Mid-Test

Don't change experiments mid-test:

```typescript
// Good: Keep experiment stable
const experiment = {
  status: 'running',
  variants: [
    { key: 'control', allocationPercentage: 50 },
    { key: 'variant', allocationPercentage: 50 },
  ],
};

// Bad: Change allocation mid-test
const experiment = {
  status: 'running',
  variants: [
    { key: 'control', allocationPercentage: 30 }, // Changed from 50
    { key: 'variant', allocationPercentage: 70 }, // Changed from 50
  ],
};
```

### 6. Segment Users

Segment users for targeted tests:

```typescript
// Good: Target specific segments
const experiment = {
  targetingRules: [
    { segment: 'premium', percentage: 100 },
    { segment: 'new', percentage: 50 },
  ],
};

// Bad: No segmentation
const experiment = {
  targetingRules: [],
};
```

### 7. Document Results

Document experiment results:

```markdown
# Experiment Results: Order List Layout

## Overview
- **Experiment**: order-list-layout
- **Duration**: 2 weeks
- **Users**: 10,000
- **Control**: List Layout (50%)
- **Variant**: Grid Layout (50%)

## Results
- **Control Conversion Rate**: 5.2%
- **Variant Conversion Rate**: 6.1%
- **Improvement**: +17.3%
- **Statistical Significance**: p < 0.01

## Conclusion
The grid layout variant performed significantly better than the control. We recommend rolling out the grid layout to all users.
```

## References

- [Optimizely Documentation](https://docs.developers.optimizely.com/)
- [VWO Documentation](https://vwo.com/knowledge-base/)
- [A/B Testing Best Practices](https://optimizely.com/ab-testing/)
- [Statistical Significance](https://www.optimizely.com/ab-testing-statistics/)
