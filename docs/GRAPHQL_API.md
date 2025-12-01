# GraphQL API Documentation

Servio provides a GraphQL API alongside the REST API for flexible data querying.

## Endpoint

```
POST /api/graphql
```

## Authentication

GraphQL endpoints require authentication via Supabase session (same as REST API).

## Example Query

```graphql
query GetOrders($venueId: ID!, $limit: Int) {
  orders(venueId: $venueId, limit: $limit) {
    id
    totalAmount
    orderStatus
    paymentStatus
    items {
      id
      itemName
      quantity
      price
    }
    createdAt
  }
}
```

Variables:
```json
{
  "venueId": "venue-uuid",
  "limit": 10
}
```

## Available Queries

### orders

Fetch orders for a venue.

```graphql
query {
  orders(venueId: "venue-id", limit: 50, offset: 0) {
    id
    totalAmount
    orderStatus
    items {
      itemName
      quantity
    }
  }
}
```

### order

Fetch a single order by ID.

```graphql
query {
  order(id: "order-id") {
    id
    totalAmount
    orderStatus
    items {
      itemName
      quantity
      price
    }
  }
}
```

### menu

Fetch menu items for a venue.

```graphql
query {
  menu(venueId: "venue-id") {
    id
    name
    description
    price
    category
    isAvailable
  }
}
```

### venue

Fetch venue information.

```graphql
query {
  venue(id: "venue-id") {
    id
    name
    businessType
    address
  }
}
```

## Mutations

### createOrder

Create a new order.

```graphql
mutation {
  createOrder(input: {
    venueId: "venue-id"
    items: [
      {
        menuItemId: "item-id"
        quantity: 2
        price: 15.99
        itemName: "Burger"
      }
    ]
    customerName: "John Doe"
    customerPhone: "+1234567890"
  }) {
    id
    totalAmount
    orderStatus
  }
}
```

### updateOrderStatus

Update order status.

```graphql
mutation {
  updateOrderStatus(id: "order-id", status: "READY") {
    id
    orderStatus
  }
}
```

## Using with JavaScript/TypeScript

```typescript
const query = `
  query GetOrders($venueId: ID!) {
    orders(venueId: $venueId) {
      id
      totalAmount
      orderStatus
    }
  }
`;

const response = await fetch('/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables: {
      venueId: 'venue-uuid',
    },
  }),
});

const { data, errors } = await response.json();
```

## Benefits of GraphQL

1. **Flexible Queries**: Request only the data you need
2. **Single Request**: Fetch related data in one query
3. **Type Safety**: Strongly typed schema
4. **Introspection**: Query the schema itself

## Limitations

- Currently supports core entities (Orders, Menu, Venue)
- More entities will be added over time
- For complex operations, use REST API

## Future Enhancements

- [ ] Real-time subscriptions
- [ ] More entities (Staff, Inventory, etc.)
- [ ] File uploads
- [ ] GraphQL Playground UI
- [ ] Query complexity limits
- [ ] Caching strategies


