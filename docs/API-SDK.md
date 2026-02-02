# API SDK for External Developers

This document describes the implementation of API SDK for external developers for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [JavaScript/TypeScript SDK](#javascripttypescript-sdk)
4. [Python SDK](#python-sdk)
5. [Documentation](#documentation)
6. [Best Practices](#best-practices)

## Overview

API SDK provides a convenient way for external developers to integrate with Servio API:

- **Type Safety:** Strongly typed SDKs
- **Authentication:** Built-in authentication support
- **Error Handling:** Comprehensive error handling
- **Documentation:** Well-documented SDKs

## Features

### JavaScript/TypeScript SDK

```typescript
// packages/servio-sdk/src/index.ts
import { fetch } from 'undici';

export interface ServioConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface ServioClient {
  venues: VenuesClient;
  menuItems: MenuItemsClient;
  orders: OrdersClient;
  tables: TablesClient;
  staff: StaffClient;
  inventory: InventoryClient;
}

export class ServioSDK implements ServioClient {
  private config: ServioConfig;
  private baseUrl: string;

  venues: VenuesClient;
  menuItems: MenuItemsClient;
  orders: OrdersClient;
  tables: TablesClient;
  staff: StaffClient;
  inventory: InventoryClient;

  constructor(config: ServioConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.SERVIO_API_KEY,
      baseUrl: config.baseUrl || 'https://api.servio.com/v1',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
    };

    this.baseUrl = this.config.baseUrl!;

    // Initialize clients
    this.venues = new VenuesClient(this);
    this.menuItems = new MenuItemsClient(this);
    this.orders = new OrdersClient(this);
    this.tables = new TablesClient(this);
    this.staff = new StaffClient(this);
    this.inventory = new InventoryClient(this);
  }

  async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'User-Agent': 'Servio-SDK/1.0.0',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.config.timeout!),
          ...options,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new ServioError(error.message, response.status, error);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retries!) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new ServioError('Request failed', 500);
  }
}

export class ServioError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ServioError';
  }
}

// Venues Client
export class VenuesClient {
  constructor(private sdk: ServioSDK) {}

  async list(options?: { limit?: number; offset?: number }): Promise<Venue[]> {
    return this.sdk.request<Venue[]>(
      'GET',
      `/venues?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<Venue> {
    return this.sdk.request<Venue>('GET', `/venues/${id}`);
  }

  async create(data: CreateVenueInput): Promise<Venue> {
    return this.sdk.request<Venue>('POST', '/venues', data);
  }

  async update(id: string, data: UpdateVenueInput): Promise<Venue> {
    return this.sdk.request<Venue>('PUT', `/venues/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/venues/${id}`);
  }
}

// Menu Items Client
export class MenuItemsClient {
  constructor(private sdk: ServioSDK) {}

  async list(venueId: string, options?: { limit?: number; offset?: number }): Promise<MenuItem[]> {
    return this.sdk.request<MenuItem[]>(
      'GET',
      `/venues/${venueId}/menu-items?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<MenuItem> {
    return this.sdk.request<MenuItem>('GET', `/menu-items/${id}`);
  }

  async create(data: CreateMenuItemInput): Promise<MenuItem> {
    return this.sdk.request<MenuItem>('POST', '/menu-items', data);
  }

  async update(id: string, data: UpdateMenuItemInput): Promise<MenuItem> {
    return this.sdk.request<MenuItem>('PUT', `/menu-items/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/menu-items/${id}`);
  }
}

// Orders Client
export class OrdersClient {
  constructor(private sdk: ServioSDK) {}

  async list(venueId: string, options?: { limit?: number; offset?: number }): Promise<Order[]> {
    return this.sdk.request<Order[]>(
      'GET',
      `/venues/${venueId}/orders?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<Order> {
    return this.sdk.request<Order>('GET', `/orders/${id}`);
  }

  async create(data: CreateOrderInput): Promise<Order> {
    return this.sdk.request<Order>('POST', '/orders', data);
  }

  async update(id: string, data: UpdateOrderInput): Promise<Order> {
    return this.sdk.request<Order>('PUT', `/orders/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/orders/${id}`);
  }
}

// Tables Client
export class TablesClient {
  constructor(private sdk: ServioSDK) {}

  async list(venueId: string, options?: { limit?: number; offset?: number }): Promise<Table[]> {
    return this.sdk.request<Table[]>(
      'GET',
      `/venues/${venueId}/tables?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<Table> {
    return this.sdk.request<Table>('GET', `/tables/${id}`);
  }

  async create(data: CreateTableInput): Promise<Table> {
    return this.sdk.request<Table>('POST', '/tables', data);
  }

  async update(id: string, data: UpdateTableInput): Promise<Table> {
    return this.sdk.request<Table>('PUT', `/tables/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/tables/${id}`);
  }
}

// Staff Client
export class StaffClient {
  constructor(private sdk: ServioSDK) {}

  async list(venueId: string, options?: { limit?: number; offset?: number }): Promise<Staff[]> {
    return this.sdk.request<Staff[]>(
      'GET',
      `/venues/${venueId}/staff?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<Staff> {
    return this.sdk.request<Staff>('GET', `/staff/${id}`);
  }

  async create(data: CreateStaffInput): Promise<Staff> {
    return this.sdk.request<Staff>('POST', '/staff', data);
  }

  async update(id: string, data: UpdateStaffInput): Promise<Staff> {
    return this.sdk.request<Staff>('PUT', `/staff/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/staff/${id}`);
  }
}

// Inventory Client
export class InventoryClient {
  constructor(private sdk: ServioSDK) {}

  async list(venueId: string, options?: { limit?: number; offset?: number }): Promise<Inventory[]> {
    return this.sdk.request<Inventory[]>(
      'GET',
      `/venues/${venueId}/inventory?limit=${options?.limit || 100}&offset=${options?.offset || 0}`
    );
  }

  async get(id: string): Promise<Inventory> {
    return this.sdk.request<Inventory>('GET', `/inventory/${id}`);
  }

  async create(data: CreateInventoryInput): Promise<Inventory> {
    return this.sdk.request<Inventory>('POST', '/inventory', data);
  }

  async update(id: string, data: UpdateInventoryInput): Promise<Inventory> {
    return this.sdk.request<Inventory>('PUT', `/inventory/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.sdk.request<void>('DELETE', `/inventory/${id}`);
  }
}

// Types
export interface Venue {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  venueId: string;
  tableId?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
}

export interface Table {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  venueId: string;
  name: string;
  email: string;
  role: 'manager' | 'server' | 'kitchen' | 'host';
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  venueId: string;
  name: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVenueInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface UpdateVenueInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CreateMenuItemInput {
  venueId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available?: boolean;
  imageUrl?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  available?: boolean;
  imageUrl?: string;
}

export interface CreateOrderInput {
  venueId: string;
  tableId?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
  }>;
}

export interface UpdateOrderInput {
  status?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface CreateTableInput {
  venueId: string;
  name: string;
  capacity: number;
}

export interface UpdateTableInput {
  name?: string;
  capacity?: number;
  status?: 'available' | 'occupied' | 'reserved' | 'cleaning';
}

export interface CreateStaffInput {
  venueId: string;
  name: string;
  email: string;
  role: 'manager' | 'server' | 'kitchen' | 'host';
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  role?: 'manager' | 'server' | 'kitchen' | 'host';
}

export interface CreateInventoryInput {
  venueId: string;
  name: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
}

export interface UpdateInventoryInput {
  name?: string;
  quantity?: number;
  unit?: string;
  lowStockThreshold?: number;
}

export default ServioSDK;
```

## Python SDK

```python
# packages/servio-sdk-python/servio_sdk/__init__.py
import requests
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

class ServioError(Exception):
    def __init__(self, message: str, status_code: int, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details

class ServioSDK:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.servio.com/v1",
        timeout: int = 30,
        retries: int = 3
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.retries = retries

        self.venues = VenuesClient(self)
        self.menu_items = MenuItemsClient(self)
        self.orders = OrdersClient(self)
        self.tables = TablesClient(self)
        self.staff = StaffClient(self)
        self.inventory = InventoryClient(self)

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Servio-SDK-Python/1.0.0"
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        last_error = None

        for attempt in range(1, self.retries + 1):
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body,
                    timeout=self.timeout
                )

                if not response.ok:
                    error = response.json()
                    raise ServioError(
                        error.get("message", "Request failed"),
                        response.status_code,
                        error
                    )

                return response.json()

            except Exception as e:
                last_error = e

                if attempt < self.retries:
                    # Exponential backoff
                    delay = 2 ** attempt
                    import time
                    time.sleep(delay)

        raise last_error or ServioError("Request failed", 500)

class VenuesClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/venues/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/venues", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/venues/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/venues/{id}")

class MenuItemsClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, venue_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues/{venue_id}/menu-items?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/menu-items/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/menu-items", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/menu-items/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/menu-items/{id}")

class OrdersClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, venue_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues/{venue_id}/orders?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/orders/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/orders", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/orders/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/orders/{id}")

class TablesClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, venue_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues/{venue_id}/tables?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/tables/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/tables", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/tables/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/tables/{id}")

class StaffClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, venue_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues/{venue_id}/staff?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/staff/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/staff", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/staff/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/staff/{id}")

class InventoryClient:
    def __init__(self, sdk: ServioSDK):
        self.sdk = sdk

    def list(self, venue_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self.sdk.request(
            "GET",
            f"/venues/{venue_id}/inventory?limit={limit}&offset={offset}"
        )

    def get(self, id: str) -> Dict[str, Any]:
        return self.sdk.request("GET", f"/inventory/{id}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("POST", "/inventory", data)

    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.sdk.request("PUT", f"/inventory/{id}", data)

    def delete(self, id: str) -> None:
        self.sdk.request("DELETE", f"/inventory/{id}")
```

## Documentation

### Usage Examples

```typescript
// JavaScript/TypeScript
import ServioSDK from '@servio/sdk';

const sdk = new ServioSDK({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.servio.com/v1',
});

// List venues
const venues = await sdk.venues.list();

// Get venue
const venue = await sdk.venues.get('venue-id');

// Create venue
const newVenue = await sdk.venues.create({
  name: 'My Restaurant',
  address: '123 Main St',
});

// Update venue
const updatedVenue = await sdk.venues.update('venue-id', {
  name: 'My Restaurant Updated',
});

// Delete venue
await sdk.venues.delete('venue-id');
```

```python
# Python
from servio_sdk import ServioSDK

sdk = ServioSDK(
    api_key="your-api-key",
    base_url="https://api.servio.com/v1"
)

# List venues
venues = sdk.venues.list()

# Get venue
venue = sdk.venues.get("venue-id")

# Create venue
new_venue = sdk.venues.create({
    "name": "My Restaurant",
    "address": "123 Main St"
})

# Update venue
updated_venue = sdk.venues.update("venue-id", {
    "name": "My Restaurant Updated"
})

# Delete venue
sdk.venues.delete("venue-id")
```

## Best Practices

### 1. Provide Type Safety

Provide type safety:

```typescript
// Good: Provide type safety
const venue: Venue = await sdk.venues.get('venue-id');

// Bad: No type safety
const venue = await sdk.venues.get('venue-id');
```

### 2. Handle Errors

Handle errors:

```typescript
// Good: Handle errors
try {
  const venue = await sdk.venues.get('venue-id');
} catch (error) {
  if (error instanceof ServioError) {
    console.error(`Servio error: ${error.message} (${error.statusCode})`);
  } else {
    console.error('Unknown error:', error);
  }
}

// Bad: No error handling
const venue = await sdk.venues.get('venue-id');
```

### 3. Use Retry Logic

Use retry logic:

```typescript
// Good: Use retry logic
const sdk = new ServioSDK({
  retries: 3,
});

// Bad: No retry logic
const sdk = new ServioSDK({
  retries: 0,
});
```

### 4. Provide Examples

Provide examples:

```typescript
// Good: Provide examples
// List venues
const venues = await sdk.venues.list();

// Bad: No examples
// No examples
```

### 5. Document SDK

Document SDK:

```markdown
# Good: Document SDK
## Servio SDK

### Installation

```bash
npm install @servio/sdk
```

### Usage

```typescript
import ServioSDK from '@servio/sdk';

const sdk = new ServioSDK({
  apiKey: 'your-api-key',
});

const venues = await sdk.venues.list();
```

# Bad: No documentation
# No documentation
```

### 6. Support Multiple Languages

Support multiple languages:

```typescript
// Good: Support multiple languages
// JavaScript/TypeScript SDK
// Python SDK
// Go SDK
// Java SDK

// Bad: Support only one language
// JavaScript/TypeScript SDK only
```

### 7. Version SDK

Version SDK:

```typescript
// Good: Version SDK
{
  "name": "@servio/sdk",
  "version": "1.0.0"
}

// Bad: No version
{
  "name": "@servio/sdk"
}
```

## References

- [SDK Design](https://sdk-design.com/)
- [API SDK Best Practices](https://www.twilio.com/blog/2015/03/17/how-to-build-your-own-twilio-sdk.html)
- [TypeScript SDK](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Python SDK](https://docs.python-guide.org/writing/structure/)
