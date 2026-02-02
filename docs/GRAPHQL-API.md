# GraphQL API for Complex Queries

This document describes the implementation of GraphQL API for complex queries for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Schema](#schema)
4. [Resolvers](#resolvers)
5. [Queries](#queries)
6. [Best Practices](#best-practices)

## Overview

GraphQL is a query language for APIs that allows clients to request exactly the data they need:

- **Flexible Queries:** Request exactly the data you need
- **Single Endpoint:** Single endpoint for all queries
- **Type Safety:** Strongly typed schema
- **Efficient:** Reduce over-fetching and under-fetching

## Features

### Schema

```typescript
// lib/graphql/schema.ts
import { gql } from 'apollo-server';

export const typeDefs = gql`
  type Query {
    # Venues
    venues(limit: Int, offset: Int): [Venue!]!
    venue(id: ID!): Venue

    # Menu items
    menuItems(venueId: ID!, limit: Int, offset: Int): [MenuItem!]!
    menuItem(id: ID!): MenuItem

    # Orders
    orders(venueId: ID!, limit: Int, offset: Int): [Order!]!
    order(id: ID!): Order

    # Tables
    tables(venueId: ID!, limit: Int, offset: Int): [Table!]!
    table(id: ID!): Table

    # Staff
    staff(venueId: ID!, limit: Int, offset: Int): [Staff!]!
    staffMember(id: ID!): Staff

    # Inventory
    inventory(venueId: ID!, limit: Int, offset: Int): [Inventory!]!
    inventoryItem(id: ID!): Inventory
  }

  type Mutation {
    # Venues
    createVenue(input: CreateVenueInput!): Venue!
    updateVenue(id: ID!, input: UpdateVenueInput!): Venue!
    deleteVenue(id: ID!): Boolean!

    # Menu items
    createMenuItem(input: CreateMenuItemInput!): MenuItem!
    updateMenuItem(id: ID!, input: UpdateMenuItemInput!): MenuItem!
    deleteMenuItem(id: ID!): Boolean!

    # Orders
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    deleteOrder(id: ID!): Boolean!

    # Tables
    createTable(input: CreateTableInput!): Table!
    updateTable(id: ID!, input: UpdateTableInput!): Table!
    deleteTable(id: ID!): Boolean!

    # Staff
    createStaff(input: CreateStaffInput!): Staff!
    updateStaff(id: ID!, input: UpdateStaffInput!): Staff!
    deleteStaff(id: ID!): Boolean!

    # Inventory
    createInventory(input: CreateInventoryInput!): Inventory!
    updateInventory(id: ID!, input: UpdateInventoryInput!): Inventory!
    deleteInventory(id: ID!): Boolean!
  }

  type Subscription {
    # Orders
    orderCreated(venueId: ID!): Order!
    orderUpdated(venueId: ID!): Order!
    orderDeleted(venueId: ID!): Order!

    # Tables
    tableUpdated(venueId: ID!): Table!
  }

  # Types
  type Venue {
    id: ID!
    name: String!
    address: String
    phone: String
    email: String
    createdAt: DateTime!
    updatedAt: DateTime!
    menuItems(limit: Int, offset: Int): [MenuItem!]!
    orders(limit: Int, offset: Int): [Order!]!
    tables(limit: Int, offset: Int): [Table!]!
    staff(limit: Int, offset: Int): [Staff!]!
    inventory(limit: Int, offset: Int): [Inventory!]!
  }

  type MenuItem {
    id: ID!
    venueId: ID!
    name: String!
    description: String
    price: Float!
    category: String!
    available: Boolean!
    imageUrl: String
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
  }

  type Order {
    id: ID!
    venueId: ID!
    tableId: ID
    status: OrderStatus!
    total: Float!
    items: [OrderItem!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
    table: Table
  }

  type OrderItem {
    id: ID!
    orderId: ID!
    menuItemId: ID!
    quantity: Int!
    price: Float!
    menuItem: MenuItem!
  }

  type Table {
    id: ID!
    venueId: ID!
    name: String!
    capacity: Int!
    status: TableStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
  }

  type Staff {
    id: ID!
    venueId: ID!
    name: String!
    email: String!
    role: StaffRole!
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
  }

  type Inventory {
    id: ID!
    venueId: ID!
    name: String!
    quantity: Int!
    unit: String!
    lowStockThreshold: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
  }

  # Enums
  enum OrderStatus {
    PENDING
    PREPARING
    READY
    SERVED
    CANCELLED
  }

  enum TableStatus {
    AVAILABLE
    OCCUPIED
    RESERVED
    CLEANING
  }

  enum StaffRole {
    MANAGER
    SERVER
    KITCHEN
    HOST
  }

  # Scalars
  scalar DateTime

  # Inputs
  input CreateVenueInput {
    name: String!
    address: String
    phone: String
    email: String
  }

  input UpdateVenueInput {
    name: String
    address: String
    phone: String
    email: String
  }

  input CreateMenuItemInput {
    venueId: ID!
    name: String!
    description: String
    price: Float!
    category: String!
    available: Boolean!
    imageUrl: String
  }

  input UpdateMenuItemInput {
    name: String
    description: String
    price: Float
    category: String
    available: Boolean
    imageUrl: String
  }

  input CreateOrderInput {
    venueId: ID!
    tableId: ID
    items: [CreateOrderItemInput!]!
  }

  input CreateOrderItemInput {
    menuItemId: ID!
    quantity: Int!
  }

  input UpdateOrderInput {
    status: OrderStatus
  }

  input CreateTableInput {
    venueId: ID!
    name: String!
    capacity: Int!
  }

  input UpdateTableInput {
    name: String
    capacity: Int
    status: TableStatus
  }

  input CreateStaffInput {
    venueId: ID!
    name: String!
    email: String!
    role: StaffRole!
  }

  input UpdateStaffInput {
    name: String
    email: String
    role: StaffRole
  }

  input CreateInventoryInput {
    venueId: ID!
    name: String!
    quantity: Int!
    unit: String!
    lowStockThreshold: Int!
  }

  input UpdateInventoryInput {
    name: String
    quantity: Int
    unit: String
    lowStockThreshold: Int!
  }
`;
```

## Resolvers

```typescript
// lib/graphql/resolvers.ts
import { VenueService } from '../services/VenueService';
import { MenuService } from '../services/MenuService';
import { OrderService } from '../services/OrderService';
import { TableService } from '../services/TableService';
import { StaffService } from '../services/StaffService';
import { InventoryService } from '../services/InventoryService';

const venueService = new VenueService();
const menuService = new MenuService();
const orderService = new OrderService();
const tableService = new TableService();
const staffService = new StaffService();
const inventoryService = new InventoryService();

export const resolvers = {
  Query: {
    venues: async (_: any, { limit, offset }: any) => {
      return venueService.findAll({ limit, offset });
    },

    venue: async (_: any, { id }: any) => {
      return venueService.findById(id);
    },

    menuItems: async (_: any, { venueId, limit, offset }: any) => {
      return menuService.findByVenue(venueId, { limit, offset });
    },

    menuItem: async (_: any, { id }: any) => {
      return menuService.findById(id);
    },

    orders: async (_: any, { venueId, limit, offset }: any) => {
      return orderService.findByVenue(venueId, { limit, offset });
    },

    order: async (_: any, { id }: any) => {
      return orderService.findById(id);
    },

    tables: async (_: any, { venueId, limit, offset }: any) => {
      return tableService.findByVenue(venueId, { limit, offset });
    },

    table: async (_: any, { id }: any) => {
      return tableService.findById(id);
    },

    staff: async (_: any, { venueId, limit, offset }: any) => {
      return staffService.findByVenue(venueId, { limit, offset });
    },

    staffMember: async (_: any, { id }: any) => {
      return staffService.findById(id);
    },

    inventory: async (_: any, { venueId, limit, offset }: any) => {
      return inventoryService.findByVenue(venueId, { limit, offset });
    },

    inventoryItem: async (_: any, { id }: any) => {
      return inventoryService.findById(id);
    },
  },

  Mutation: {
    createVenue: async (_: any, { input }: any) => {
      return venueService.create(input);
    },

    updateVenue: async (_: any, { id, input }: any) => {
      return venueService.update(id, input);
    },

    deleteVenue: async (_: any, { id }: any) => {
      await venueService.delete(id);
      return true;
    },

    createMenuItem: async (_: any, { input }: any) => {
      return menuService.create(input);
    },

    updateMenuItem: async (_: any, { id, input }: any) => {
      return menuService.update(id, input);
    },

    deleteMenuItem: async (_: any, { id }: any) => {
      await menuService.delete(id);
      return true;
    },

    createOrder: async (_: any, { input }: any) => {
      return orderService.create(input);
    },

    updateOrder: async (_: any, { id, input }: any) => {
      return orderService.update(id, input);
    },

    deleteOrder: async (_: any, { id }: any) => {
      await orderService.delete(id);
      return true;
    },

    createTable: async (_: any, { input }: any) => {
      return tableService.create(input);
    },

    updateTable: async (_: any, { id, input }: any) => {
      return tableService.update(id, input);
    },

    deleteTable: async (_: any, { id }: any) => {
      await tableService.delete(id);
      return true;
    },

    createStaff: async (_: any, { input }: any) => {
      return staffService.create(input);
    },

    updateStaff: async (_: any, { id, input }: any) => {
      return staffService.update(id, input);
    },

    deleteStaff: async (_: any, { id }: any) => {
      await staffService.delete(id);
      return true;
    },

    createInventory: async (_: any, { input }: any) => {
      return inventoryService.create(input);
    },

    updateInventory: async (_: any, { id, input }: any) => {
      return inventoryService.update(id, input);
    },

    deleteInventory: async (_: any, { id }: any) => {
      await inventoryService.delete(id);
      return true;
    },
  },

  Subscription: {
    orderCreated: {
      subscribe: (_: any, { venueId }: any) => {
        return orderService.subscribeToOrderCreated(venueId);
      },
    },

    orderUpdated: {
      subscribe: (_: any, { venueId }: any) => {
        return orderService.subscribeToOrderUpdated(venueId);
      },
    },

    orderDeleted: {
      subscribe: (_: any, { venueId }: any) => {
        return orderService.subscribeToOrderDeleted(venueId);
      },
    },

    tableUpdated: {
      subscribe: (_: any, { venueId }: any) => {
        return tableService.subscribeToTableUpdated(venueId);
      },
    },
  },

  Venue: {
    menuItems: async (venue: any, { limit, offset }: any) => {
      return menuService.findByVenue(venue.id, { limit, offset });
    },

    orders: async (venue: any, { limit, offset }: any) => {
      return orderService.findByVenue(venue.id, { limit, offset });
    },

    tables: async (venue: any, { limit, offset }: any) => {
      return tableService.findByVenue(venue.id, { limit, offset });
    },

    staff: async (venue: any, { limit, offset }: any) => {
      return staffService.findByVenue(venue.id, { limit, offset });
    },

    inventory: async (venue: any, { limit, offset }: any) => {
      return inventoryService.findByVenue(venue.id, { limit, offset });
    },
  },

  MenuItem: {
    venue: async (menuItem: any) => {
      return venueService.findById(menuItem.venueId);
    },
  },

  Order: {
    venue: async (order: any) => {
      return venueService.findById(order.venueId);
    },

    table: async (order: any) => {
      if (!order.tableId) return null;
      return tableService.findById(order.tableId);
    },
  },

  OrderItem: {
    menuItem: async (orderItem: any) => {
      return menuService.findById(orderItem.menuItemId);
    },
  },

  Table: {
    venue: async (table: any) => {
      return venueService.findById(table.venueId);
    },
  },

  Staff: {
    venue: async (staff: any) => {
      return venueService.findById(staff.venueId);
    },
  },

  Inventory: {
    venue: async (inventory: any) => {
      return venueService.findById(inventory.venueId);
    },
  },

  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'DateTime scalar type',
    parseValue: (value: any) => new Date(value),
    serialize: (value: any) => value.toISOString(),
    parseLiteral: (ast: any) => {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      return null;
    },
  }),
};
```

## Queries

### Example Queries

```graphql
# Get venue with menu items and orders
query GetVenueWithMenuAndOrders($id: ID!) {
  venue(id: $id) {
    id
    name
    address
    menuItems(limit: 10) {
      id
      name
      price
      category
      available
    }
    orders(limit: 10) {
      id
      status
      total
      items {
        menuItem {
          name
          price
        }
        quantity
      }
    }
  }
}

# Get orders with venue and table
query GetOrdersWithVenueAndTable($venueId: ID!) {
  orders(venueId: $venueId, limit: 10) {
    id
    status
    total
    venue {
      id
      name
    }
    table {
      id
      name
      status
    }
    items {
      menuItem {
        name
        price
      }
      quantity
    }
  }
}

# Create order
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    status
    total
    venue {
      id
      name
    }
    table {
      id
      name
    }
    items {
      menuItem {
        name
        price
      }
      quantity
    }
  }
}

# Subscribe to order updates
subscription OnOrderUpdated($venueId: ID!) {
  orderUpdated(venueId: $venueId) {
    id
    status
    total
    venue {
      id
      name
    }
    table {
      id
      name
    }
    items {
      menuItem {
        name
        price
      }
      quantity
    }
  }
}
```

## Best Practices

### 1. Use Descriptive Field Names

Use descriptive field names:

```graphql
# Good: Descriptive field names
type Venue {
  id: ID!
  name: String!
  address: String
  phone: String
  email: String
}

# Bad: Non-descriptive field names
type Venue {
  id: ID!
  n: String!
  a: String
  p: String
  e: String
}
```

### 2. Use Proper Types

Use proper types:

```graphql
# Good: Proper types
type Order {
  id: ID!
  status: OrderStatus!
  total: Float!
  createdAt: DateTime!
}

# Bad: String types
type Order {
  id: ID!
  status: String!
  total: String!
  createdAt: String!
}
```

### 3. Use Pagination

Use pagination:

```graphql
# Good: Use pagination
query GetVenues($limit: Int, $offset: Int) {
  venues(limit: $limit, offset: $offset) {
    id
    name
  }
}

# Bad: No pagination
query GetVenues {
  venues {
    id
    name
  }
}
```

### 4. Use Input Types

Use input types:

```graphql
# Good: Use input types
mutation CreateVenue($input: CreateVenueInput!) {
  createVenue(input: $input) {
    id
    name
  }
}

# Bad: Multiple arguments
mutation CreateVenue($name: String!, $address: String, $phone: String, $email: String) {
  createVenue(name: $name, address: $address, phone: $phone, email: $email) {
    id
    name
  }
}
```

### 5. Use Error Handling

Use error handling:

```typescript
// Good: Use error handling
try {
  const venue = await venueService.create(input);
  return venue;
} catch (error) {
  throw new GraphQLError('Failed to create venue', {
    extensions: {
      code: 'VENUE_CREATE_FAILED',
      details: error.message,
    },
  });
}

// Bad: No error handling
const venue = await venueService.create(input);
return venue;
```

### 6. Use DataLoader

Use DataLoader for batching:

```typescript
// Good: Use DataLoader
const venueLoader = new DataLoader(async (ids: string[]) => {
  const venues = await venueService.findByIds(ids);
  return ids.map(id => venues.find(v => v.id === id));
});

// Bad: No batching
const venue = await venueService.findById(venueId);
```

### 7. Document Schema

Document schema:

```graphql
# Good: Document schema
"""
A venue represents a restaurant or food service location.
"""
type Venue {
  """
  The unique identifier for the venue.
  """
  id: ID!

  """
  The name of the venue.
  """
  name: String!
}

# Bad: No documentation
type Venue {
  id: ID!
  name: String!
}
```

## References

- [GraphQL](https://graphql.org/)
- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [DataLoader](https://github.com/graphql/dataloader)
