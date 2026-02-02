# Microservices Architecture for Scaling

This document describes the implementation of microservices architecture for scaling the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Services](#services)
5. [Communication](#communication)
6. [Best Practices](#best-practices)

## Overview

Microservices architecture is an approach to building applications as a collection of small, independent services:

- **Scalability:** Scale individual services independently
- **Resilience:** Isolate failures to individual services
- **Flexibility:** Use different technologies for different services
- **Team Autonomy:** Teams can work independently on services

## Features

### Architecture

```typescript
// lib/microservices/types.ts
export interface Microservice {
  name: string;
  version: string;
  port: number;
  healthCheck: string;
  dependencies: string[];
  environment: Record<string, string>;
}

export interface ServiceDiscovery {
  register(service: Microservice): Promise<void>;
  deregister(service: Microservice): Promise<void>;
  discover(serviceName: string): Promise<Microservice[]>;
  healthCheck(service: Microservice): Promise<boolean>;
}

export interface ServiceRegistry {
  services: Map<string, Microservice[]>;
  register(service: Microservice): Promise<void>;
  deregister(service: Microservice): Promise<void>;
  discover(serviceName: string): Promise<Microservice[]>;
  healthCheck(service: Microservice): Promise<boolean>;
}
```

### Service Registry

```typescript
// lib/microservices/registry.ts
import { Microservice, ServiceRegistry } from './types';

export class InMemoryServiceRegistry implements ServiceRegistry {
  services: Map<string, Microservice[]> = new Map();

  async register(service: Microservice): Promise<void> {
    const services = this.services.get(service.name) || [];
    services.push(service);
    this.services.set(service.name, services);

    console.log(`Service registered: ${service.name} v${service.version}`);
  }

  async deregister(service: Microservice): Promise<void> {
    const services = this.services.get(service.name) || [];
    const index = services.findIndex(s => s.port === service.port);

    if (index !== -1) {
      services.splice(index, 1);
      this.services.set(service.name, services);

      console.log(`Service deregistered: ${service.name} v${service.version}`);
    }
  }

  async discover(serviceName: string): Promise<Microservice[]> {
    const services = this.services.get(serviceName) || [];

    // Filter healthy services
    const healthyServices = await Promise.all(
      services.map(async (service) => {
        const healthy = await this.healthCheck(service);
        return healthy ? service : null;
      })
    );

    return healthyServices.filter((s): s is Microservice => s !== null);
  }

  async healthCheck(service: Microservice): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${service.port}${service.healthCheck}`);

      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${service.name}:`, error);
      return false;
    }
  }
}

// Singleton instance
let serviceRegistry: ServiceRegistry | null = null;

export function getServiceRegistry(): ServiceRegistry {
  if (!serviceRegistry) {
    serviceRegistry = new InMemoryServiceRegistry();
  }

  return serviceRegistry;
}
```

## Services

### Order Service

```typescript
// services/order-service/index.ts
import express from 'express';
import { getServiceRegistry } from '../../lib/microservices/registry';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// Create order
app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  res.json(order);
});

// Get order
app.get('/orders/:id', async (req, res) => {
  const order = await getOrder(req.params.id);
  res.json(order);
});

// List orders
app.get('/orders', async (req, res) => {
  const orders = await listOrders(req.query);
  res.json(orders);
});

// Start service
async function start() {
  const registry = getServiceRegistry();

  // Register service
  await registry.register({
    name: 'order-service',
    version: '1.0.0',
    port: PORT,
    healthCheck: '/health',
    dependencies: ['menu-service', 'inventory-service'],
    environment: process.env,
  });

  app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
  });
}

start().catch(console.error);
```

### Menu Service

```typescript
// services/menu-service/index.ts
import express from 'express';
import { getServiceRegistry } from '../../lib/microservices/registry';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'menu-service' });
});

// Create menu item
app.post('/menu-items', async (req, res) => {
  const menuItem = await createMenuItem(req.body);
  res.json(menuItem);
});

// Get menu item
app.get('/menu-items/:id', async (req, res) => {
  const menuItem = await getMenuItem(req.params.id);
  res.json(menuItem);
});

// List menu items
app.get('/menu-items', async (req, res) => {
  const menuItems = await listMenuItems(req.query);
  res.json(menuItems);
});

// Start service
async function start() {
  const registry = getServiceRegistry();

  // Register service
  await registry.register({
    name: 'menu-service',
    version: '1.0.0',
    port: PORT,
    healthCheck: '/health',
    dependencies: [],
    environment: process.env,
  });

  app.listen(PORT, () => {
    console.log(`Menu service listening on port ${PORT}`);
  });
}

start().catch(console.error);
```

### Inventory Service

```typescript
// services/inventory-service/index.ts
import express from 'express';
import { getServiceRegistry } from '../../lib/microservices/registry';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// Update inventory
app.post('/inventory', async (req, res) => {
  const inventory = await updateInventory(req.body);
  res.json(inventory);
});

// Get inventory
app.get('/inventory/:id', async (req, res) => {
  const inventory = await getInventory(req.params.id);
  res.json(inventory);
});

// List inventory
app.get('/inventory', async (req, res) => {
  const inventory = await listInventory(req.query);
  res.json(inventory);
});

// Start service
async function start() {
  const registry = getServiceRegistry();

  // Register service
  await registry.register({
    name: 'inventory-service',
    version: '1.0.0',
    port: PORT,
    healthCheck: '/health',
    dependencies: [],
    environment: process.env,
  });

  app.listen(PORT, () => {
    console.log(`Inventory service listening on port ${PORT}`);
  });
}

start().catch(console.error);
```

## Communication

### Service Client

```typescript
// lib/microservices/client.ts
import { getServiceRegistry } from './registry';

export class ServiceClient {
  private serviceName: string;
  private registry = getServiceRegistry();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  async get(path: string, options?: RequestInit): Promise<Response> {
    const service = await this.getService();

    const url = `http://localhost:${service.port}${path}`;

    return fetch(url, {
      ...options,
      method: 'GET',
    });
  }

  async post(path: string, body: any, options?: RequestInit): Promise<Response> {
    const service = await this.getService();

    const url = `http://localhost:${service.port}${path}`;

    return fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
  }

  async put(path: string, body: any, options?: RequestInit): Promise<Response> {
    const service = await this.getService();

    const url = `http://localhost:${service.port}${path}`;

    return fetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
  }

  async delete(path: string, options?: RequestInit): Promise<Response> {
    const service = await this.getService();

    const url = `http://localhost:${service.port}${path}`;

    return fetch(url, {
      ...options,
      method: 'DELETE',
    });
  }

  private async getService(): Promise<any> {
    const services = await this.registry.discover(this.serviceName);

    if (services.length === 0) {
      throw new Error(`No healthy services found for ${this.serviceName}`);
    }

    // Load balancing: round-robin
    const index = Math.floor(Math.random() * services.length);
    return services[index];
  }
}

// Service clients
export const orderServiceClient = new ServiceClient('order-service');
export const menuServiceClient = new ServiceClient('menu-service');
export const inventoryServiceClient = new ServiceClient('inventory-service');
```

### API Gateway

```typescript
// lib/microservices/gateway.ts
import express from 'express';
import { orderServiceClient, menuServiceClient, inventoryServiceClient } from './client';

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

// Order routes
app.post('/api/orders', async (req, res) => {
  const response = await orderServiceClient.post('/orders', req.body);
  const data = await response.json();
  res.json(data);
});

app.get('/api/orders/:id', async (req, res) => {
  const response = await orderServiceClient.get(`/orders/${req.params.id}`);
  const data = await response.json();
  res.json(data);
});

app.get('/api/orders', async (req, res) => {
  const response = await orderServiceClient.get('/orders', {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  res.json(data);
});

// Menu routes
app.post('/api/menu-items', async (req, res) => {
  const response = await menuServiceClient.post('/menu-items', req.body);
  const data = await response.json();
  res.json(data);
});

app.get('/api/menu-items/:id', async (req, res) => {
  const response = await menuServiceClient.get(`/menu-items/${req.params.id}`);
  const data = await response.json();
  res.json(data);
});

app.get('/api/menu-items', async (req, res) => {
  const response = await menuServiceClient.get('/menu-items', {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  res.json(data);
});

// Inventory routes
app.post('/api/inventory', async (req, res) => {
  const response = await inventoryServiceClient.post('/inventory', req.body);
  const data = await response.json();
  res.json(data);
});

app.get('/api/inventory/:id', async (req, res) => {
  const response = await inventoryServiceClient.get(`/inventory/${req.params.id}`);
  const data = await response.json();
  res.json(data);
});

app.get('/api/inventory', async (req, res) => {
  const response = await inventoryServiceClient.get('/inventory', {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  res.json(data);
});

// Start gateway
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
```

## Best Practices

### 1. Keep Services Small

Keep services small and focused:

```typescript
// Good: Small, focused service
app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  res.json(order);
});

// Bad: Large, monolithic service
app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  const menu = await getMenu(order.menuId);
  const inventory = await updateInventory(order.items);
  const notification = await sendNotification(order.userId);
  res.json({ order, menu, inventory, notification });
});
```

### 2. Use Service Discovery

Use service discovery:

```typescript
// Good: Use service discovery
const services = await registry.discover('order-service');
const service = services[0];
const response = await fetch(`http://localhost:${service.port}/orders`);

// Bad: Hardcode service URLs
const response = await fetch('http://localhost:3001/orders');
```

### 3. Implement Health Checks

Implement health checks:

```typescript
// Good: Implement health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// Bad: No health checks
// No health checks
```

### 4. Use Load Balancing

Use load balancing:

```typescript
// Good: Use load balancing
const services = await registry.discover('order-service');
const index = Math.floor(Math.random() * services.length);
const service = services[index];

// Bad: No load balancing
const service = services[0];
```

### 5. Handle Failures Gracefully

Handle failures gracefully:

```typescript
// Good: Handle failures gracefully
try {
  const response = await orderServiceClient.get('/orders');
  const data = await response.json();
  res.json(data);
} catch (error) {
  console.error('Failed to fetch orders:', error);
  res.status(503).json({ error: 'Service unavailable' });
}

// Bad: No error handling
const response = await orderServiceClient.get('/orders');
const data = await response.json();
res.json(data);
```

### 6. Use Circuit Breakers

Use circuit breakers:

```typescript
// Good: Use circuit breakers
const circuitBreaker = new CircuitBreaker(orderServiceClient);

try {
  const response = await circuitBreaker.execute(() => orderServiceClient.get('/orders'));
  const data = await response.json();
  res.json(data);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    res.status(503).json({ error: 'Circuit breaker open' });
  } else {
    throw error;
  }
}

// Bad: No circuit breakers
const response = await orderServiceClient.get('/orders');
const data = await response.json();
res.json(data);
```

### 7. Document Service Contracts

Document service contracts:

```markdown
# Good: Document service contracts
## Order Service

### POST /orders

Creates a new order.

**Request:**
```json
{
  "venueId": "string",
  "items": [
    {
      "menuItemId": "string",
      "quantity": 1
    }
  ]
}
```

**Response:**
```json
{
  "id": "string",
  "venueId": "string",
  "status": "pending",
  "items": [...]
}
```

# Bad: No documentation
# No documentation
```

## References

- [Microservices](https://martinfowler.com/articles/microservices.html)
- [Service Discovery](https://microservices.io/patterns/service-discovery.html)
- [API Gateway](https://microservices.io/patterns/apigateway.html)
- [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
