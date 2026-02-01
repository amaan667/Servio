# Servio API Documentation

## Overview

Servio provides a RESTful API for managing restaurants, orders, menus, and more. All API endpoints follow a consistent response format and include comprehensive error handling.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-app-domain.com`

## Authentication

Most API endpoints require authentication. Include your session token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

For public endpoints (like menu viewing), no authentication is required.

## Response Format

All API responses follow this standard format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid",
    "duration": 123
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|-------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Access denied to resource |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (duplicate, etc.) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `DATABASE_ERROR` | 500 | Database operation failed |

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets

### Rate Limits by Endpoint

| Endpoint Type | Limit | Window |
|----------------|--------|---------|
| Auth endpoints | 10 requests | 60 seconds |
| Payment endpoints | 20 requests | 60 seconds |
| Order creation | 30 requests | 60 seconds |
| General API | 100 requests | 60 seconds |
| KDS polling | 500 requests | 60 seconds |
| Public menu | 60 requests | 60 seconds |

## API Endpoints

### Health & Status

#### GET /api/health
Health check endpoint (no authentication required).

**Response**: `text/plain` - "ok"

#### GET /api/ready
Readiness check (validates database, Redis, Stripe).

**Response**: JSON with service status

### Authentication

#### POST /api/auth/sign-in
Sign in with email and password.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "session": { ... }
  }
}
```

#### POST /api/auth/sign-up
Create a new account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

#### POST /api/auth/sign-out
Sign out current session.

**Headers**: `Authorization: Bearer <token>`

### Venues

#### GET /api/venues
Get all venues for authenticated user.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "venue-1",
      "name": "Restaurant Name",
      "address": "123 Main St",
      "tier": "pro",
      "role": "owner"
    }
  ]
}
```

#### GET /api/venues/:venueId
Get venue details.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "venue-1",
    "name": "Restaurant Name",
    "address": "123 Main St",
    "phone": "+1234567890",
    "settings": { ... }
  }
}
```

#### POST /api/venues
Create a new venue.

**Request Body**:
```json
{
  "name": "New Restaurant",
  "address": "456 Oak Ave",
  "phone": "+1234567890",
  "timezone": "America/New_York"
}
```

### Menu Management

#### GET /api/venues/:venueId/menu
Get menu for a venue (public endpoint).

**Query Parameters**:
- `includeUnavailable` (boolean): Include unavailable items

**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [ ... ],
    "items": [ ... ]
  }
}
```

#### POST /api/venues/:venueId/menu/items
Create a new menu item.

**Request Body**:
```json
{
  "name": "Burger",
  "description": "Delicious burger",
  "price": 12.99,
  "categoryId": "cat-1",
  "imageUrl": "https://example.com/image.jpg",
  "isAvailable": true
}
```

#### PUT /api/venues/:venueId/menu/items/:itemId
Update a menu item.

**Request Body**:
```json
{
  "name": "Updated Burger",
  "price": 14.99
}
```

#### DELETE /api/venues/:venueId/menu/items/:itemId
Delete a menu item.

#### POST /api/venues/:venueId/menu/categories
Create a new category.

**Request Body**:
```json
{
  "name": "Burgers",
  "displayOrder": 1
}
```

### Orders

#### GET /api/venues/:venueId/orders
Get orders for a venue.

**Query Parameters**:
- `status` (string): Filter by order status
- `paymentStatus` (string[]): Filter by payment status
- `startDate` (string): ISO date string
- `endDate` (string): ISO date string
- `limit` (number): Maximum results

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "order-1",
      "customerName": "John Doe",
      "customerPhone": "+1234567890",
      "items": [ ... ],
      "totalAmount": 25.99,
      "orderStatus": "PLACED",
      "paymentStatus": "UNPAID",
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

#### GET /api/venues/:venueId/orders/:orderId
Get order details.

#### POST /api/venues/:venueId/orders
Create a new order.

**Request Body**:
```json
{
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customerEmail": "john@example.com",
  "tableNumber": 1,
  "items": [
    {
      "menuItemId": "item-1",
      "itemName": "Burger",
      "quantity": 2,
      "price": 12.99,
      "specialInstructions": "No onions"
    }
  ],
  "totalAmount": 25.98,
  "notes": "Table by window",
  "source": "qr",
  "paymentMethod": "PAY_NOW"
}
```

#### PUT /api/venues/:venueId/orders/:orderId/status
Update order status.

**Request Body**:
```json
{
  "status": "PREPARING"
}
```

#### POST /api/venues/:venueId/orders/:orderId/complete
Complete an order.

#### POST /api/venues/:venueId/orders/:orderId/cancel
Cancel an order.

### Tables

#### GET /api/venues/:venueId/tables
Get all tables for a venue.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "table-1",
      "tableNumber": 1,
      "label": "Table 1",
      "seatCount": 4,
      "area": "Main Dining",
      "status": "AVAILABLE"
    }
  ]
}
```

#### POST /api/venues/:venueId/tables
Create a new table.

**Request Body**:
```json
{
  "tableNumber": 5,
  "label": "Table 5",
  "seatCount": 6,
  "area": "Patio"
}
```

#### PUT /api/venues/:venueId/tables/:tableId
Update a table.

#### DELETE /api/venues/:venueId/tables/:tableId
Delete a table.

### Payments

#### POST /api/venues/:venueId/payments/create-intent
Create a payment intent.

**Request Body**:
```json
{
  "orderId": "order-1",
  "amount": 25.99,
  "currency": "usd"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_123...",
    "paymentIntentId": "pi_123..."
  }
}
```

#### POST /api/webhooks/stripe
Stripe webhook endpoint (server-to-server).

**Headers**:
- `Stripe-Signature`: Webhook signature

### Inventory

#### GET /api/venues/:venueId/inventory
Get inventory items.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "ing-1",
      "name": "Beef Patty",
      "onHand": 50,
      "unit": "pieces",
      "lowStockThreshold": 10,
      "status": "OK"
    }
  ]
}
```

#### POST /api/venues/:venueId/inventory/adjust
Adjust inventory stock.

**Request Body**:
```json
{
  "adjustments": [
    {
      "ingredientId": "ing-1",
      "delta": -5,
      "reason": "Used in order"
    }
  ]
}
```

### Staff

#### GET /api/venues/:venueId/staff
Get staff members.

#### POST /api/venues/:venueId/staff/invite
Invite a new staff member.

**Request Body**:
```json
{
  "email": "staff@example.com",
  "role": "manager"
}
```

#### PUT /api/venues/:venueId/staff/:staffId/role
Update staff role.

**Request Body**:
```json
{
  "role": "owner"
}
```

### Analytics

#### GET /api/venues/:venueId/analytics/revenue
Get revenue analytics.

**Query Parameters**:
- `startDate` (string): ISO date string
- `endDate` (string): ISO date string
- `groupBy` (string): "day", "week", "month"

**Response**:
```json
{
  "success": true,
  "data": {
    "totalRevenue": 12500.00,
    "orderCount": 500,
    "averageOrderValue": 25.00,
    "breakdown": [ ... ]
  }
}
```

#### GET /api/venues/:venueId/analytics/orders
Get order analytics.

#### GET /api/venues/:venueId/analytics/popular-items
Get popular menu items.

### AI Assistant

#### POST /api/ai-assistant/conversations
Create a new AI conversation.

**Request Body**:
```json
{
  "message": "What are my top selling items?",
  "venueId": "venue-1",
  "context": { ... }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv-1",
    "response": "Based on your data...",
    "suggestions": [ ... ]
  }
}
```

## Webhooks

### Stripe Webhooks

Servio processes Stripe webhooks at `/api/webhooks/stripe`.

**Events Handled**:
- `payment_intent.succeeded`
- `payment_intent.failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Idempotency

For POST, PUT, and DELETE operations, you can include an idempotency key to prevent duplicate operations:

```
X-Idempotency-Key: <unique-key>
```

If the same key is used multiple times, the same response will be returned.

## Pagination

List endpoints support pagination:

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response**:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## Filtering & Sorting

Many list endpoints support filtering and sorting:

**Query Parameters**:
- `filter[field]`: Filter by field value
- `sort`: Sort field
- `order`: Sort direction ("asc" or "desc")

Example:
```
GET /api/venues/:venueId/orders?status=PLACED&sort=createdAt&order=desc
```

## Real-time Updates

Servio supports real-time updates via Supabase subscriptions:

```javascript
const supabase = createClient();

// Subscribe to order updates
const subscription = supabase
  .channel('orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `venue_id=eq.${venueId}`
  }, (payload) => {
    console.log('Order changed:', payload);
  })
  .subscribe();
```

## Error Handling

### Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

### Rate Limit Errors

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "details": {
      "retryAfter": 30
    }
  }
}
```

## SDKs & Libraries

### JavaScript/TypeScript

```bash
npm install @servio/sdk
```

```typescript
import { ServioClient } from '@servio/sdk';

const client = new ServioClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.servio.com'
});

const orders = await client.orders.list({ venueId: 'venue-1' });
```

## Support

For API support:
- Documentation: https://docs.servio.com
- Email: api-support@servio.com
- Status Page: https://status.servio.com

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Core endpoints for orders, menu, tables
- Authentication and authorization
- Payment processing with Stripe
