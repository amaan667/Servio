# Integration Tests for API Endpoints

This document describes integration tests for API endpoints in the Servio platform.

## Overview

Integration tests verify that different parts of the application work together correctly. These tests:

- Test API endpoints end-to-end
- Verify database interactions
- Test authentication and authorization
- Validate request/response formats
- Test error handling

## Test Structure

```
__tests__/
├── integration/
│   ├── api/
│   │   ├── orders.test.ts
│   │   ├── menus.test.ts
│   │   ├── tables.test.ts
│   │   ├── staff.test.ts
│   │   ├── inventory.test.ts
│   │   ├── auth.test.ts
│   │   └── webhooks.test.ts
│   ├── fixtures/
│   │   ├── users.ts
│   │   ├── venues.ts
│   │   └── tokens.ts
│   └── helpers/
│       ├── setup.ts
│       ├── teardown.ts
│       └── auth.ts
```

## Setup and Teardown

```typescript
// __tests__/integration/helpers/setup.ts
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/structured-logger';

const logger = createLogger('test-integration');

export async function setupTestDatabase() {
  // Create test database
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Run migrations
  await supabase.rpc('run_test_migrations');

  logger.info('Test database setup complete');
}

export async function teardownTestDatabase() {
  // Clean up test data
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase.rpc('cleanup_test_data');

  logger.info('Test database teardown complete');
}

export async function createTestUser() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.auth.signUp({
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
  });

  if (error) throw error;

  return data.user;
}

export async function createTestVenue(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('venues')
    .insert({
      name: 'Test Venue',
      userId,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
```

```typescript
// __tests__/integration/helpers/auth.ts
import { createClient } from '@supabase/supabase-js';

export async function getAuthToken(email: string, password: string): Promise<string> {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data.session.access_token;
}

export async function createTestAuthToken(): Promise<string> {
  return getAuthToken('test@example.com', 'testpassword123');
}
```

## Orders API Tests

```typescript
// __tests__/integration/api/orders.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, createTestUser, createTestVenue, createTestAuthToken } from '../helpers/setup';
import { createClient } from '@supabase/supabase-js';

describe('Orders API Integration Tests', () => {
  let supabase: any;
  let authToken: string;
  let testUserId: string;
  let testVenueId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    const user = await createTestUser();
    testUserId = user.id;
    const venue = await createTestVenue(testUserId);
    testVenueId = venue.id;
    authToken = await createTestAuthToken();
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('orders').delete().eq('venueId', testVenueId);
  });

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: testVenueId,
        items: [
          {
            menuItemId: 'menu_123',
            quantity: 2,
          },
        ],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(orderData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.customerName).toBe(orderData.customerName);
      expect(data.data.status).toBe('pending');
    });

    it('should return 400 if customer name is missing', async () => {
      const orderData = {
        customerName: '',
        customerEmail: 'john@example.com',
        venueId: testVenueId,
        items: [],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(orderData),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Customer name is required');
    });

    it('should return 401 if not authenticated', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: testVenueId,
        items: [],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      expect(response.status).toBe(401);
    });

    it('should return 403 if venue access denied', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: 'other_venue_123',
        items: [],
      };

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(orderData),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/orders', () => {
    it('should return orders for venue', async () => {
      const response = await fetch(`http://localhost:3000/api/orders?venueId=${testVenueId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch(`http://localhost:3000/api/orders?venueId=${testVenueId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order by id', async () => {
      // Create an order first
      const createResponse = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          venueId: testVenueId,
          items: [{ menuItemId: 'menu_123', quantity: 1 }],
        }),
      });

      const createData = await createResponse.json();
      const orderId = createData.data.id;

      // Get the order
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe(orderId);
    });

    it('should return 404 if order not found', async () => {
      const response = await fetch('http://localhost:3000/api/orders/order_999', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update order status', async () => {
      // Create an order first
      const createResponse = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          venueId: testVenueId,
          items: [{ menuItemId: 'menu_123', quantity: 1 }],
        }),
      });

      const createData = await createResponse.json();
      const orderId = createData.data.id;

      // Update the order
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.status).toBe('completed');
    });

    it('should return 400 if invalid status', async () => {
      const response = await fetch('http://localhost:3000/api/orders/order_123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: 'invalid_status' }),
      });

      expect(response.status).toBe(400);
    });
  });
});
```

## Menus API Tests

```typescript
// __tests__/integration/api/menus.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, createTestUser, createTestVenue, createTestAuthToken } from '../helpers/setup';

describe('Menus API Integration Tests', () => {
  let authToken: string;
  let testVenueId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    const user = await createTestUser();
    const venue = await createTestVenue(user.id);
    testVenueId = venue.id;
    authToken = await createTestAuthToken();
  });

  afterEach(async () => {
    // Clean up test data
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    await supabase.from('menu_items').delete().eq('venueId', testVenueId);
  });

  describe('POST /api/menu/items', () => {
    it('should create a menu item successfully', async () => {
      const menuItemData = {
        name: 'Burger',
        description: 'Delicious burger',
        price: 10.99,
        venueId: testVenueId,
        categoryId: 'category_123',
      };

      const response = await fetch('http://localhost:3000/api/menu/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(menuItemData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.name).toBe(menuItemData.name);
      expect(data.data.price).toBe(menuItemData.price);
    });

    it('should return 400 if price is negative', async () => {
      const menuItemData = {
        name: 'Burger',
        price: -10,
        venueId: testVenueId,
      };

      const response = await fetch('http://localhost:3000/api/menu/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(menuItemData),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/menu', () => {
    it('should return menu for venue', async () => {
      const response = await fetch(`http://localhost:3000/api/menu?venueId=${testVenueId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.categories).toBeDefined();
      expect(data.data.items).toBeDefined();
    });
  });
});
```

## Authentication API Tests

```typescript
// __tests__/integration/api/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/setup';

describe('Authentication API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
      };

      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.user).toBeDefined();
      expect(data.data.token).toBeDefined();
    });

    it('should return 400 if email is invalid', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      };

      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 if password is too short', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: '123',
        name: 'Test User',
      };

      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.token).toBeDefined();
      expect(data.data.user).toBeDefined();
    });

    it('should return 401 with invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      expect(response.status).toBe(401);
    });
  });
});
```

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific API tests
npm run test:integration -- orders
npm run test:integration -- menus

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch
```

## Test Environment Setup

```bash
# Set up test environment variables
export SUPABASE_URL=http://localhost:54321
export SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run migrations
npm run migrate:test

# Run tests
npm run test:integration
```

## Test Coverage Goals

- **API Coverage**: 100%
- **Endpoint Coverage**: 100%
- **Happy Path Coverage**: 100%
- **Error Path Coverage**: 90%
- **Authentication Coverage**: 100%

## References

- [Vitest Integration Testing](https://vitest.dev/guide/)
- [API Testing Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Integration Testing Patterns](https://testingjavascript.com/)
