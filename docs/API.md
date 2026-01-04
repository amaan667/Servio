# Servio API Documentation

**Version:** 0.1.6  
**Base URL:** `https://servio-production.up.railway.app/api`

## Authentication

All API endpoints (except public endpoints) require authentication via Supabase session cookies. The authentication is handled by middleware and `withUnifiedAuth` wrapper.

### Headers

```
Content-Type: application/json
Cookie: sb-access-token=<token> (set automatically by Supabase)
```

### Authentication Flow

1. User authenticates via Supabase Auth (OAuth 2.0 with PKCE)
2. Session cookie is set automatically
3. Middleware validates session and sets `x-user-id` header
4. API routes use `withUnifiedAuth` for access control

## Response Format

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-12-19T12:00:00.000Z",
    "requestId": "optional-correlation-id"
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
    "details": {}
  },
  "meta": {
    "timestamp": "2025-12-19T12:00:00.000Z"
  }
}
```

### Error Codes

- `VALIDATION_ERROR` (400) - Input validation failed
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Resource conflict
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `BAD_REQUEST` (400) - Invalid request
- `DATABASE_ERROR` (500) - Database operation failed
- `INTERNAL_ERROR` (500) - Internal server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General Endpoints**: 100 requests per minute per IP/user
- **Auth Endpoints**: 10 requests per minute per IP
- **Payment Endpoints**: 20 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1639939200
Retry-After: 60
```

## Endpoints

### Orders

#### `GET /api/orders`
Get orders for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID
- `status` (optional) - Filter by status (PLACED, ACCEPTED, IN_PREP, READY, COMPLETED)
- `since` (optional) - Filter by date (today, yesterday, week, month)

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "venue_id": "venue-xxx",
        "status": "PLACED",
        "total": 25.99,
        "items": [...],
        "created_at": "2025-12-19T12:00:00.000Z"
      }
    ]
  }
}
```

#### `POST /api/orders`
Create a new order.

**Request Body:**
```json
{
  "venueId": "venue-xxx",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2,
      "price": 12.99,
      "specialInstructions": "No onions"
    }
  ],
  "tableId": "uuid",
  "paymentMethod": "card"
}
```

#### `POST /api/orders/:orderId/complete`
Mark an order as complete.

**Path Parameters:**
- `orderId` (required) - Order ID

### Staff Management

#### `GET /api/staff/list`
Get staff members for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID

**Response:**
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": "uuid",
        "venue_id": "venue-xxx",
        "name": "John Doe",
        "role": "server",
        "active": true,
        "created_at": "2025-12-19T12:00:00.000Z"
      }
    ]
  }
}
```

#### `POST /api/staff/add`
Add a new staff member.

**Request Body:**
```json
{
  "venueId": "venue-xxx",
  "name": "Jane Smith",
  "role": "server"
}
```

#### `POST /api/staff/toggle`
Toggle staff member active status.

**Request Body:**
```json
{
  "staffId": "uuid",
  "active": true
}
```

### Menu Management

#### `GET /api/menu/items`
Get menu items for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID
- `category` (optional) - Filter by category

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "venue_id": "venue-xxx",
        "name": "Burger",
        "description": "Delicious burger",
        "price": 12.99,
        "category": "Main",
        "available": true,
        "image_url": "https://..."
      }
    ]
  }
}
```

#### `POST /api/menu/items`
Create a menu item.

**Request Body:**
```json
{
  "venueId": "venue-xxx",
  "name": "New Item",
  "description": "Item description",
  "price": 9.99,
  "category": "Appetizers",
  "available": true
}
```

### Tables

#### `GET /api/tables`
Get tables for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID

#### `POST /api/tables`
Create a new table.

**Request Body:**
```json
{
  "venueId": "venue-xxx",
  "label": "Table 5",
  "seatCount": 4
}
```

#### `GET /api/tables/:tableId/sessions`
Get active sessions for a table.

#### `POST /api/tables/:tableId/close`
Close a table session.

### Analytics

#### `GET /api/analytics`
Get analytics data for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID
- `period` (optional) - Time period (today, week, month, year)

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": 1250.50,
    "orders": 45,
    "averageOrderValue": 27.79,
    "topItems": [...],
    "revenueByCategory": {...},
    "ordersByHour": [...]
  }
}
```

### Payments

#### `POST /api/stripe/create-checkout-session`
Create a Stripe checkout session.

**Request Body:**
```json
{
  "venueId": "venue-xxx",
  "orderId": "uuid",
  "amount": 25.99,
  "currency": "gbp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_xxx",
    "url": "https://checkout.stripe.com/..."
  }
}
```

#### `POST /api/stripe/webhook`
Stripe webhook endpoint (handles payment events).

**Headers:**
- `stripe-signature` (required) - Stripe webhook signature

### KDS (Kitchen Display System)

#### `GET /api/kds/tickets`
Get KDS tickets for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID
- `station` (optional) - Filter by station (Grill, Fryer, Barista, etc.)

#### `POST /api/kds/tickets/bulk-update`
Update multiple tickets.

**Request Body:**
```json
{
  "ticketIds": ["uuid1", "uuid2"],
  "status": "READY"
}
```

### Health & Status

#### `GET /api/health`
Health check endpoint (public).

**Response:**
```
ok
```

#### `GET /api/ready`
Readiness check endpoint (public).

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": {
      "supabase": { "status": "ok", "responseTime": 45 },
      "redis": { "status": "ok", "responseTime": 12 },
      "stripe": { "status": "ok", "responseTime": 234 }
    }
  }
}
```

## Access Control

### Venue Access

Most endpoints require venue access. The `withUnifiedAuth` wrapper enforces:
1. User authentication
2. Venue access verification (owner or staff role)
3. Role-based feature access

### Role-Based Access

Different roles have different permissions:

- **Owner**: Full access to all endpoints
- **Manager**: Most endpoints (except billing)
- **Server**: Order and table management
- **Staff**: Limited read access
- **Viewer**: Read-only access

### Tier-Based Features

Some features are tier-restricted:

- **Starter**: Basic features
- **Pro**: Advanced features (custom branding, analytics)
- **Enterprise**: All features (multi-venue, API access, AI assistant)

## Webhooks

### Stripe Webhooks

The application handles the following Stripe webhook events:

- `checkout.session.completed` - Payment completed
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Invoice paid
- `invoice.payment_failed` - Payment failed

Webhook URL: `https://servio-production.up.railway.app/api/stripe/webhook`

## Error Handling

### Validation Errors

When validation fails, the error response includes field-level details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "name",
        "message": "Name is required"
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
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

## Best Practices

1. **Always include `venueId`** in requests where required
2. **Handle rate limits** - Check `X-RateLimit-Remaining` header
3. **Use correlation IDs** for debugging (optional `X-Correlation-Id` header)
4. **Validate inputs** client-side before sending
5. **Handle errors gracefully** - Check `success` field first
6. **Use pagination** for large datasets
7. **Cache responses** when appropriate (respect cache headers)

## SDKs & Libraries

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/orders?venueId=venue-xxx', {
  credentials: 'include', // Required for cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
if (data.success) {
  console.log(data.data.orders);
} else {
  console.error(data.error.message);
}
```

## Support

For API questions or issues:
- **Documentation**: See this file
- **Support**: support@servio.uk
- **GitHub Issues**: For bugs and feature requests

