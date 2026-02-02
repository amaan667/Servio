# Contract Testing

This document describes the contract testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Benefits](#benefits)
3. [Tools](#tools)
4. [Setup](#setup)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Overview

Contract testing ensures that services (API providers and consumers) agree on the structure and behavior of their interactions. This helps:

- **Prevent Integration Issues**: Catch API contract violations early
- **Enable Independent Development**: Allow teams to work in parallel
- **Improve Documentation**: Generate API documentation from contracts
- **Reduce Testing Time**: Faster than full integration tests

## Benefits

### For API Providers
- **Confidence in Changes**: Know when changes break consumers
- **Better Documentation**: Auto-generated API docs
- **Faster Feedback**: Quick feedback on breaking changes

### For API Consumers
- **Early Detection**: Catch issues before deployment
- **Mock Generation**: Generate mocks from contracts
- **Independent Development**: Work without provider availability

## Tools

### Pact

Pact is a consumer-driven contract testing framework.

**Pros:**
- Consumer-driven approach
- Supports multiple languages
- Good documentation
- Active community

**Cons:**
- Requires Pact Broker for sharing contracts
- Learning curve for setup

### OpenAPI Schema Validation

Validate against OpenAPI/Swagger specifications.

**Pros:**
- Industry standard
- Good tooling support
- Easy to understand

**Cons:**
- Limited to REST APIs
- Doesn't test behavior

### GraphQL Schema Validation

Validate against GraphQL schemas.

**Pros:**
- Native to GraphQL
- Type-safe
- Good tooling

**Cons:**
- GraphQL-specific
- Limited ecosystem

## Setup

### Option 1: Pact

#### Installation

```bash
npm install --save-dev @pact-foundation/pact @pact-foundation/pact-node
```

#### Configuration

```typescript
// pact.config.ts
import { PactOptions } from '@pact-foundation/pact';

export const pactConfig: PactOptions = {
  consumer: 'servio-frontend',
  provider: 'servio-api',
  port: 1234,
  host: '127.0.0.1',
  log: './logs/pact.log',
  dir: './pacts',
  logLevel: 'INFO',
  spec: 2,
  cors: true,
};
```

#### Consumer Tests

```typescript
// __tests__/contract/orders.spec.ts
import { Pact } from '@pact-foundation/pact';
import { like, eachLike } from '@pact-foundation/pact/dsl/matchers';
import { OrdersClient } from '@/lib/api/orders';

const provider = new Pact({
  consumer: 'servio-frontend',
  provider: 'servio-api',
  port: 1234,
  log: './logs/pact.log',
  dir: './pacts',
  logLevel: 'INFO',
});

describe('Orders API Contract', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'orders exist',
        uponReceiving: 'a request for orders',
        withRequest: {
          method: 'GET',
          path: '/api/orders',
          headers: {
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            data: eachLike({
              id: like('order_123'),
              customerName: like('John Doe'),
              customerEmail: like('john@example.com'),
              total: like(100),
              status: like('pending'),
              createdAt: like('2024-01-15T10:30:00Z'),
            }),
          },
        },
      });
    });

    it('returns a list of orders', async () => {
      const client = new OrdersClient('http://localhost:1234');
      const orders = await client.getOrders('Bearer token');

      expect(orders.data).toBeDefined();
      expect(orders.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/orders', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'ready to create order',
        uponReceiving: 'a request to create an order',
        withRequest: {
          method: 'POST',
          path: '/api/orders',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer token'),
          },
          body: {
            customerName: like('John Doe'),
            customerEmail: like('john@example.com'),
            items: eachLike({
              menuItemId: like('menu_123'),
              quantity: like(2),
            }),
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            data: {
              id: like('order_123'),
              customerName: like('John Doe'),
              customerEmail: like('john@example.com'),
              total: like(100),
              status: like('pending'),
              createdAt: like('2024-01-15T10:30:00Z'),
            },
          },
        },
      });
    });

    it('creates a new order', async () => {
      const client = new OrdersClient('http://localhost:1234');
      const order = await client.createOrder(
        {
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          items: [
            {
              menuItemId: 'menu_123',
              quantity: 2,
            },
          ],
        },
        'Bearer token'
      );

      expect(order.data).toBeDefined();
      expect(order.data.id).toBeDefined();
    });
  });
});
```

#### Provider Tests

```typescript
// __tests__/contract/provider.spec.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('Orders API Provider Contract', () => {
  const verifier = new Verifier({
    providerBaseUrl: 'http://localhost:3000',
    provider: 'servio-api',
    pactUrls: [
      path.resolve(__dirname, '../../pacts/servio-frontend-servio-api.json'),
    ],
    providerVersion: '1.0.0',
    publishVerificationResults: true,
    pactBrokerUrl: process.env.PACT_BROKER_URL,
    pactBrokerToken: process.env.PACT_BROKER_TOKEN,
  });

  it('validates the expectations of Orders API', () => {
    return verifier.verify();
  });
});
```

### Option 2: OpenAPI Schema Validation

#### Installation

```bash
npm install --save-dev openapi-typescript openapi-validator
```

#### Generate Types

```bash
# Generate TypeScript types from OpenAPI spec
npx openapi-typescript openapi.yaml -o src/types/api.ts
```

#### Validate Responses

```typescript
// lib/api/validator.ts
import Ajv from 'ajv';
import openApiSpec from '@/openapi.json';

const ajv = new Ajv({ allErrors: true });

export function validateResponse(
  path: string,
  method: string,
  statusCode: number,
  response: any
): { valid: boolean; errors?: any[] } {
  const pathSpec = openApiSpec.paths[path]?.[method.toLowerCase()];
  if (!pathSpec) {
    return { valid: false, errors: [`Path ${path} ${method} not found in spec`] };
  }

  const responseSpec = pathSpec.responses[statusCode];
  if (!responseSpec) {
    return { valid: false, errors: [`Response ${statusCode} not found in spec`] };
  }

  const schema = responseSpec.content?.['application/json']?.schema;
  if (!schema) {
    return { valid: false, errors: [`Schema not found for ${statusCode}`] };
  }

  const validate = ajv.compile(schema);
  const valid = validate(response);

  return {
    valid,
    errors: validate.errors,
  };
}
```

#### Usage in Tests

```typescript
// __tests__/contract/openapi.spec.ts
import { validateResponse } from '@/lib/api/validator';
import { OrdersClient } from '@/lib/api/orders';

describe('OpenAPI Contract Tests', () => {
  let client: OrdersClient;

  beforeAll(() => {
    client = new OrdersClient('http://localhost:3000');
  });

  describe('GET /api/orders', () => {
    it('validates response against OpenAPI spec', async () => {
      const response = await client.getOrders('Bearer token');

      const validation = validateResponse(
        '/api/orders',
        'GET',
        200,
        response
      );

      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
    });
  });

  describe('POST /api/orders', () => {
    it('validates response against OpenAPI spec', async () => {
      const response = await client.createOrder(
        {
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          items: [
            {
              menuItemId: 'menu_123',
              quantity: 2,
            },
          ],
        },
        'Bearer token'
      );

      const validation = validateResponse(
        '/api/orders',
        'POST',
        201,
        response
      );

      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
    });
  });
});
```

### Option 3: GraphQL Schema Validation

#### Installation

```bash
npm install --save-dev graphql graphql-tag
```

#### Validate Queries

```typescript
// lib/api/graphql-validator.ts
import { buildSchema, validate } from 'graphql';
import { parse } from 'graphql';

const schema = buildSchema(`
  type Order {
    id: ID!
    customerName: String!
    customerEmail: String!
    total: Float!
    status: String!
    createdAt: String!
  }

  type Query {
    orders: [Order!]!
    order(id: ID!): Order
  }

  type Mutation {
    createOrder(
      customerName: String!
      customerEmail: String!
      items: [OrderItemInput!]!
    ): Order!
  }

  input OrderItemInput {
    menuItemId: ID!
    quantity: Int!
  }
`);

export function validateQuery(query: string): { valid: boolean; errors?: any[] } {
  const document = parse(query);
  const errors = validate(schema, document);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateResponse(
  query: string,
  response: any
): { valid: boolean; errors?: any[] } {
  const validation = validateQuery(query);
  if (!validation.valid) {
    return validation;
  }

  // Additional response validation can be added here
  return { valid: true };
}
```

#### Usage in Tests

```typescript
// __tests__/contract/graphql.spec.ts
import { validateQuery, validateResponse } from '@/lib/api/graphql-validator';
import { GraphQLClient } from '@/lib/api/graphql';

describe('GraphQL Contract Tests', () => {
  let client: GraphQLClient;

  beforeAll(() => {
    client = new GraphQLClient('http://localhost:3000/graphql');
  });

  describe('Query: orders', () => {
    const query = `
      query GetOrders {
        orders {
          id
          customerName
          customerEmail
          total
          status
          createdAt
        }
      }
    `;

    it('validates query against schema', () => {
      const validation = validateQuery(query);
      expect(validation.valid).toBe(true);
    });

    it('validates response against schema', async () => {
      const response = await client.query(query);
      const validation = validateResponse(query, response);

      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
    });
  });

  describe('Mutation: createOrder', () => {
    const mutation = `
      mutation CreateOrder($input: CreateOrderInput!) {
        createOrder(input: $input) {
          id
          customerName
          customerEmail
          total
          status
          createdAt
        }
      }
    `;

    it('validates mutation against schema', () => {
      const validation = validateQuery(mutation);
      expect(validation.valid).toBe(true);
    });

    it('validates response against schema', async () => {
      const response = await client.mutate(mutation, {
        input: {
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          items: [
            {
              menuItemId: 'menu_123',
              quantity: 2,
            },
          ],
        },
      });

      const validation = validateResponse(mutation, response);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
    });
  });
});
```

## Writing Tests

### Consumer Tests

```typescript
// __tests__/contract/consumer/orders.spec.ts
import { Pact } from '@pact-foundation/pact';
import { like, eachLike } from '@pact-foundation/pact/dsl/matchers';

const provider = new Pact({
  consumer: 'servio-frontend',
  provider: 'servio-api',
  port: 1234,
  log: './logs/pact.log',
  dir: './pacts',
  logLevel: 'INFO',
});

describe('Orders Consumer Contract', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('GET /api/orders/:id', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'order exists',
        uponReceiving: 'a request for a specific order',
        withRequest: {
          method: 'GET',
          path: '/api/orders/order_123',
          headers: {
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            data: {
              id: like('order_123'),
              customerName: like('John Doe'),
              customerEmail: like('john@example.com'),
              total: like(100),
              status: like('pending'),
              items: eachLike({
                id: like('item_123'),
                name: like('Burger'),
                quantity: like(2),
                price: like(50),
              }),
              createdAt: like('2024-01-15T10:30:00Z'),
            },
          },
        },
      });
    });

    it('returns a specific order', async () => {
      const response = await fetch('http://localhost:1234/api/orders/order_123', {
        headers: {
          Authorization: 'Bearer token',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe('order_123');
    });
  });
});
```

### Provider Tests

```typescript
// __tests__/contract/provider/orders.spec.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('Orders Provider Contract', () => {
  const verifier = new Verifier({
    providerBaseUrl: 'http://localhost:3000',
    provider: 'servio-api',
    pactUrls: [
      path.resolve(__dirname, '../../pacts/servio-frontend-servio-api.json'),
    ],
    providerVersion: '1.0.0',
    stateHandlers: {
      'order exists': async () => {
        // Setup test data
        await createTestOrder('order_123');
      },
      'ready to create order': async () => {
        // Setup for order creation
        await cleanupTestOrders();
      },
    },
  });

  it('validates the expectations of Orders API', () => {
    return verifier.verify();
  });
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run consumer contract tests
        run: npm run test:contract:consumer

      - name: Publish pacts
        run: npm run pact:publish
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  provider-tests:
    runs-on: ubuntu-latest
    needs: consumer-tests
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm run start &
        env:
          PORT: 3000

      - name: Wait for application
        run: npx wait-on http://localhost:3000

      - name: Run provider contract tests
        run: npm run test:contract:provider
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

### Pact Broker Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  pact-broker:
    image: pactfoundation/pact-broker
    ports:
      - "9292:9292"
    environment:
      - PACT_BROKER_DATABASE_USERNAME=pact
      - PACT_BROKER_DATABASE_PASSWORD=pact
      - PACT_BROKER_DATABASE_NAME=pact
      - PACT_BROKER_DATABASE_HOST=postgres
      - PACT_BROKER_DATABASE_PORT=5432
    depends_on:
      - postgres

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_USER=pact
      - POSTGRES_PASSWORD=pact
      - POSTGRES_DB=pact
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Best Practices

### 1. Consumer-Driven Contracts

Let consumers define the contracts:

```typescript
// Good: Consumer defines what it needs
await provider.addInteraction({
  uponReceiving: 'a request for orders',
  withRequest: {
    method: 'GET',
    path: '/api/orders',
  },
  willRespondWith: {
    status: 200,
    body: {
      data: eachLike({
        id: like('order_123'),
        customerName: like('John Doe'),
      }),
    },
  },
});

// Bad: Provider defines everything
await provider.addInteraction({
  uponReceiving: 'a request for orders',
  withRequest: {
    method: 'GET',
    path: '/api/orders',
  },
  willRespondWith: {
    status: 200,
    body: {
      data: eachLike({
        id: like('order_123'),
        customerName: like('John Doe'),
        customerEmail: like('john@example.com'),
        customerPhone: like('123-456-7890'), // Consumer doesn't need this
        createdAt: like('2024-01-15T10:30:00Z'),
        updatedAt: like('2024-01-15T10:30:00Z'),
        // ... many more fields
      }),
    },
  },
});
```

### 2. Use Matchers

Use Pact matchers for flexible validation:

```typescript
// Good: Use matchers
body: {
  id: like('order_123'),
  customerName: like('John Doe'),
  total: like(100),
  items: eachLike({
    id: like('item_123'),
    quantity: like(2),
  }),
}

// Bad: Hardcoded values
body: {
  id: 'order_123',
  customerName: 'John Doe',
  total: 100,
  items: [
    {
      id: 'item_123',
      quantity: 2,
    },
  ],
}
```

### 3. Test Happy Path and Edge Cases

Test both success and failure scenarios:

```typescript
// Happy path
await provider.addInteraction({
  uponReceiving: 'a request for an existing order',
  withRequest: {
    method: 'GET',
    path: '/api/orders/order_123',
  },
  willRespondWith: {
    status: 200,
    body: { /* ... */ },
  },
});

// Edge case: Not found
await provider.addInteraction({
  uponReceiving: 'a request for a non-existent order',
  withRequest: {
    method: 'GET',
    path: '/api/orders/order_999',
  },
  willRespondWith: {
    status: 404,
    body: {
      error: 'Order not found',
    },
  },
});
```

### 4. Version Your Contracts

Version your contracts and APIs:

```typescript
const verifier = new Verifier({
  providerBaseUrl: 'http://localhost:3000',
  provider: 'servio-api',
  providerVersion: '1.0.0', // Version your provider
  pactUrls: [
    path.resolve(__dirname, '../../pacts/servio-frontend-servio-api.json'),
  ],
});
```

### 5. Run Tests in CI

Run contract tests in CI for every PR:

```yaml
# Run consumer tests on every PR
- name: Run consumer contract tests
  run: npm run test:contract:consumer

# Run provider tests on every PR
- name: Run provider contract tests
  run: npm run test:contract:provider
```

### 6. Use Pact Broker

Use Pact Broker to share contracts:

```bash
# Publish pacts to broker
npx pact-broker publish ./pacts \
  --consumer-app-version=1.0.0 \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN

# Verify provider against broker
npx pact-provider-verifier \
  --provider-base-url=http://localhost:3000 \
  --provider-app-version=1.0.0 \
  --pact-broker-url=$PACT_BROKER_URL \
  --pact-broker-token=$PACT_BROKER_TOKEN
```

### 7. Document Breaking Changes

Document breaking changes in contracts:

```typescript
// Add description to interactions
await provider.addInteraction({
  uponReceiving: 'a request for orders (v2 - includes customer phone)',
  withRequest: {
    method: 'GET',
    path: '/api/orders',
  },
  willRespondWith: {
    status: 200,
    body: {
      data: eachLike({
        id: like('order_123'),
        customerName: like('John Doe'),
        customerPhone: like('123-456-7890'), // New field
      }),
    },
  },
});
```

## References

- [Pact Documentation](https://docs.pact.io/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [GraphQL Specification](https://graphql.org/learn/)
- [Contract Testing Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html#ContractTests)
