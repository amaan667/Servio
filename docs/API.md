# API Documentation

**Base URL:** `https://your-app.com/api`  
**Version:** 1.0  
**Last Updated:** January 2024

---

## Table of Contents

- [Authentication](#authentication)
- [Orders](#orders)
- [Menu](#menu)
- [Venues](#venues)
- [Tables](#tables)
- [Staff](#staff)
- [Payments](#payments)
- [Error Handling](#error-handling)

---

## Authentication

### POST /api/auth/signin
Sign in with Google OAuth.

**Request:**
```json
{
  "provider": "google"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com"
  }
}
```

### POST /api/auth/signout
Sign out current user.

**Response:**
```json
{
  "ok": true,
  "message": "Signed out successfully"
}
```

---

## Orders

### GET /api/orders
Get orders for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID
- `status` (optional) - Filter by order status
- `limit` (optional) - Number of orders to return (default: 50)

**Response:**
```json
{
  "ok": true,
  "orders": [
    {
      "id": "order-123",
      "venue_id": "venue-123",
      "table_number": "1",
      "customer_name": "John Doe",
      "customer_phone": "1234567890",
      "items": [
        {
          "id": "item-1",
          "name": "Pizza",
          "quantity": 2,
          "price": 12.50
        }
      ],
      "total_amount": 25.00,
      "order_status": "PLACED",
      "payment_status": "UNPAID",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### POST /api/orders
Create a new order.

**Request:**
```json
{
  "venue_id": "venue-123",
  "table_number": "1",
  "customer_name": "John Doe",
  "customer_phone": "1234567890",
  "items": [
    {
      "id": "item-1",
      "name": "Pizza",
      "quantity": 2,
      "price": 12.50
    }
  ],
  "total_amount": 25.00,
  "payment_status": "UNPAID",
  "source": "table"
}
```

**Response:**
```json
{
  "ok": true,
  "order": {
    "id": "order-123",
    "venue_id": "venue-123",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

### PUT /api/orders/:orderId
Update an order.

**Request:**
```json
{
  "order_status": "COMPLETED",
  "payment_status": "PAID"
}
```

**Response:**
```json
{
  "ok": true,
  "order": {
    "id": "order-123",
    "order_status": "COMPLETED",
    "payment_status": "PAID"
  }
}
```

### DELETE /api/orders/:orderId
Delete an order.

**Response:**
```json
{
  "ok": true,
  "message": "Order deleted successfully"
}
```

---

## Menu

### GET /api/menu/:venueId
Get menu items for a venue.

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "item-123",
      "venue_id": "venue-123",
      "name": "Pizza",
      "description": "Delicious pizza",
      "price": 12.50,
      "category": "Food",
      "is_available": true
    }
  ]
}
```

### POST /api/menu/upload
Upload a menu (PDF or image).

**Request:** `multipart/form-data`
- `file` (required) - Menu file
- `venueId` (required) - Venue ID

**Response:**
```json
{
  "ok": true,
  "message": "Menu uploaded successfully",
  "uploadId": "upload-123"
}
```

### POST /api/menu/process
Process uploaded menu with AI.

**Request:**
```json
{
  "uploadId": "upload-123",
  "venueId": "venue-123"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Menu processed successfully",
  "itemsExtracted": 25
}
```

---

## Venues

### GET /api/venues
Get all venues for current user.

**Response:**
```json
{
  "ok": true,
  "venues": [
    {
      "venue_id": "venue-123",
      "name": "My Restaurant",
      "address": "123 Main St",
      "phone": "123-456-7890",
      "email": "info@restaurant.com"
    }
  ]
}
```

### POST /api/venues
Create a new venue.

**Request:**
```json
{
  "name": "My Restaurant",
  "address": "123 Main St",
  "phone": "123-456-7890",
  "email": "info@restaurant.com"
}
```

**Response:**
```json
{
  "ok": true,
  "venue": {
    "venue_id": "venue-123",
    "name": "My Restaurant"
  }
}
```

---

## Tables

### GET /api/tables
Get tables for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID

**Response:**
```json
{
  "ok": true,
  "tables": [
    {
      "id": "table-123",
      "venue_id": "venue-123",
      "label": "Table 1",
      "area": "Main Dining",
      "capacity": 4
    }
  ]
}
```

### POST /api/tables
Create a new table.

**Request:**
```json
{
  "venue_id": "venue-123",
  "label": "Table 1",
  "area": "Main Dining",
  "capacity": 4
}
```

**Response:**
```json
{
  "ok": true,
  "table": {
    "id": "table-123",
    "venue_id": "venue-123",
    "label": "Table 1"
  }
}
```

---

## Staff

### GET /api/staff/list
Get staff members for a venue.

**Query Parameters:**
- `venueId` (required) - Venue ID

**Response:**
```json
{
  "ok": true,
  "staff": [
    {
      "id": "staff-123",
      "user_id": "user-123",
      "venue_id": "venue-123",
      "role": "manager",
      "is_active": true
    }
  ]
}
```

### POST /api/staff/add
Add a staff member.

**Request:**
```json
{
  "venue_id": "venue-123",
  "email": "staff@example.com",
  "role": "server"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Staff member added successfully",
  "invitationId": "invite-123"
}
```

---

## Payments

### POST /api/payments/create-intent
Create a payment intent.

**Request:**
```json
{
  "venue_id": "venue-123",
  "order_id": "order-123",
  "amount": 25.00,
  "currency": "GBP"
}
```

**Response:**
```json
{
  "ok": true,
  "clientSecret": "pi_xxx_secret_xxx"
}
```

### POST /api/stripe/webhook
Stripe webhook endpoint.

**Request:** Stripe webhook payload

**Response:**
```json
{
  "ok": true,
  "message": "Webhook processed"
}
```

---

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `AUTHENTICATION_ERROR` | 401 | Not authenticated |
| `AUTHORIZATION_ERROR` | 403 | Not authorized |
| `NOT_FOUND_ERROR` | 404 | Resource not found |
| `CONFLICT_ERROR` | 409 | Resource conflict |
| `RATE_LIMIT_ERROR` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE_ERROR` | 503 | Service unavailable |

### Example Error Response

```json
{
  "ok": false,
  "error": "Order not found",
  "code": "NOT_FOUND_ERROR",
  "details": {
    "orderId": "order-123"
  }
}
```

---

## Rate Limiting

All API endpoints are rate limited:

- **Authenticated users:** 100 requests per minute
- **Unauthenticated users:** 20 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `limit` (optional) - Number of items per page (default: 50, max: 100)
- `offset` (optional) - Number of items to skip (default: 0)

**Response:**
```json
{
  "ok": true,
  "items": [],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

---

## Webhooks

### Order Status Update
Sent when an order status changes.

**Payload:**
```json
{
  "event": "order.status_changed",
  "data": {
    "order_id": "order-123",
    "old_status": "PLACED",
    "new_status": "IN_PREP",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Payment Completed
Sent when a payment is completed.

**Payload:**
```json
{
  "event": "payment.completed",
  "data": {
    "order_id": "order-123",
    "amount": 25.00,
    "payment_method": "card",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Create order
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    venue_id: 'venue-123',
    table_number: '1',
    customer_name: 'John Doe',
    customer_phone: '1234567890',
    items: [
      {
        id: 'item-1',
        name: 'Pizza',
        quantity: 2,
        price: 12.50
      }
    ],
    total_amount: 25.00,
    payment_status: 'UNPAID',
    source: 'table'
  })
});

const data = await response.json();
console.log(data);
```

### cURL

```bash
curl -X POST https://your-app.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "venue_id": "venue-123",
    "table_number": "1",
    "customer_name": "John Doe",
    "customer_phone": "1234567890",
    "items": [
      {
        "id": "item-1",
        "name": "Pizza",
        "quantity": 2,
        "price": 12.50
      }
    ],
    "total_amount": 25.00,
    "payment_status": "UNPAID",
    "source": "table"
  }'
```

---

## Support

For API support, please contact:
- **Email:** support@your-app.com
- **Documentation:** https://docs.your-app.com
- **Status Page:** https://status.your-app.com

