# API Reference

Complete API reference for the Servio platform.

## Table of Contents

- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Venues](#venues)
  - [Menus](#menus)
  - [Orders](#orders)
  - [Tables](#tables)
  - [Staff](#staff)
  - [Inventory](#inventory)
  - [Analytics](#analytics)
  - [AI Assistant](#ai-assistant)
- [Webhooks](#webhooks)
- [SDKs](#sdks)

## Authentication

### API Key Authentication

For external integrations, use API key authentication:

```http
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
```

### Session Authentication

For authenticated users, use session-based authentication:

```http
Cookie: session=YOUR_SESSION_TOKEN
```

### OAuth 2.0

For third-party applications, use OAuth 2.0:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Base URL

```
Production: https://api.servio.com
Staging: https://api-staging.servio.com
Development: http://localhost:3000/api
```

## Response Format

All API responses follow a standard format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Example"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

## Error Handling

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid input data | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource already exists | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |

### Handling Errors

```typescript
try {
  const response = await fetch('/api/venues', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  const data = await response.json();

  if (!data.success) {
    // Handle error
    console.error(data.error.code, data.error.message);
    return;
  }

  // Use data
  console.log(data.data);
} catch (error) {
  // Handle network error
  console.error('Network error:', error);
}
```

## Rate Limiting

API requests are rate limited to prevent abuse:

| Plan | Requests per Minute | Requests per Hour |
|------|---------------------|-------------------|
| Free | 60 | 1000 |
| Starter | 300 | 5000 |
| Professional | 1000 | 20000 |
| Enterprise | Unlimited | Unlimited |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## API Endpoints

### Venues

#### List Venues

```http
GET /api/venues
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `search` | string | No | Search query |

**Response:**

```json
{
  "success": true,
  "data": {
    "venues": [
      {
        "id": "venue_123",
        "name": "Restaurant Name",
        "address": "123 Main St",
        "city": "London",
        "country": "UK",
        "timezone": "Europe/London",
        "currency": "GBP",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### Get Venue

```http
GET /api/venues/:venueId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "venue_123",
    "name": "Restaurant Name",
    "address": "123 Main St",
    "city": "London",
    "country": "UK",
    "timezone": "Europe/London",
    "currency": "GBP",
    "settings": {
      "allowOnlineOrders": true,
      "allowReservations": true,
      "autoConfirmOrders": false
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Create Venue

```http
POST /api/venues
```

**Request Body:**

```json
{
  "name": "Restaurant Name",
  "address": "123 Main St",
  "city": "London",
  "country": "UK",
  "timezone": "Europe/London",
  "currency": "GBP"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "venue_123",
    "name": "Restaurant Name",
    "address": "123 Main St",
    "city": "London",
    "country": "UK",
    "timezone": "Europe/London",
    "currency": "GBP",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Venue

```http
PATCH /api/venues/:venueId
```

**Request Body:**

```json
{
  "name": "Updated Restaurant Name",
  "settings": {
    "allowOnlineOrders": false
  }
}
```

#### Delete Venue

```http
DELETE /api/venues/:venueId
```

### Menus

#### List Menus

```http
GET /api/venues/:venueId/menus
```

**Response:**

```json
{
  "success": true,
  "data": {
    "menus": [
      {
        "id": "menu_123",
        "name": "Main Menu",
        "description": "Our main menu",
        "isActive": true,
        "categories": [
          {
            "id": "cat_123",
            "name": "Starters",
            "items": [
              {
                "id": "item_123",
                "name": "Soup of the Day",
                "description": "Fresh daily soup",
                "price": 5.99,
                "currency": "GBP",
                "isAvailable": true,
                "allergens": ["gluten", "dairy"]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### Get Menu

```http
GET /api/venues/:venueId/menus/:menuId
```

#### Create Menu

```http
POST /api/venues/:venueId/menus
```

**Request Body:**

```json
{
  "name": "Main Menu",
  "description": "Our main menu",
  "isActive": true
}
```

#### Update Menu

```http
PATCH /api/venues/:venueId/menus/:menuId
```

#### Delete Menu

```http
DELETE /api/venues/:venueId/menus/:menuId
```

### Orders

#### List Orders

```http
GET /api/venues/:venueId/orders
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (pending, confirmed, preparing, ready, completed, cancelled) |
| `from` | string | No | Start date (ISO 8601) |
| `to` | string | No | End date (ISO 8601) |
| `page` | number | No | Page number |
| `limit` | number | No | Items per page |

**Response:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_123",
        "venueId": "venue_123",
        "tableId": "table_123",
        "status": "confirmed",
        "items": [
          {
            "id": "item_123",
            "name": "Soup of the Day",
            "quantity": 2,
            "price": 5.99,
            "total": 11.98
          }
        ],
        "subtotal": 11.98,
        "tax": 2.40,
        "total": 14.38,
        "currency": "GBP",
        "createdAt": "2024-01-01T12:00:00Z",
        "updatedAt": "2024-01-01T12:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### Get Order

```http
GET /api/venues/:venueId/orders/:orderId
```

#### Create Order

```http
POST /api/venues/:venueId/orders
```

**Request Body:**

```json
{
  "tableId": "table_123",
  "items": [
    {
      "itemId": "item_123",
      "quantity": 2,
      "notes": "No onions"
    }
  ],
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+44 7123 456789"
  }
}
```

#### Update Order

```http
PATCH /api/venues/:venueId/orders/:orderId
```

**Request Body:**

```json
{
  "status": "confirmed",
  "notes": "Customer requested extra napkins"
}
```

#### Cancel Order

```http
POST /api/venues/:venueId/orders/:orderId/cancel
```

### Tables

#### List Tables

```http
GET /api/venues/:venueId/tables
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "id": "table_123",
        "name": "Table 1",
        "capacity": 4,
        "status": "available",
        "location": "Main Floor",
        "qrCode": "https://servio.com/qr/table_123"
      }
    ]
  }
}
```

#### Get Table

```http
GET /api/venues/:venueId/tables/:tableId
```

#### Create Table

```http
POST /api/venues/:venueId/tables
```

**Request Body:**

```json
{
  "name": "Table 1",
  "capacity": 4,
  "location": "Main Floor"
}
```

#### Update Table

```http
PATCH /api/venues/:venueId/tables/:tableId
```

#### Delete Table

```http
DELETE /api/venues/:venueId/tables/:tableId
```

### Staff

#### List Staff

```http
GET /api/venues/:venueId/staff
```

**Response:**

```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": "staff_123",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "manager",
        "isActive": true,
        "permissions": ["orders:read", "orders:write", "staff:read"]
      }
    ]
  }
}
```

#### Get Staff Member

```http
GET /api/venues/:venueId/staff/:staffId
```

#### Create Staff Member

```http
POST /api/venues/:venueId/staff
```

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "manager",
  "permissions": ["orders:read", "orders:write"]
}
```

#### Update Staff Member

```http
PATCH /api/venues/:venueId/staff/:staffId
```

#### Delete Staff Member

```http
DELETE /api/venues/:venueId/staff/:staffId
```

### Inventory

#### List Inventory Items

```http
GET /api/venues/:venueId/inventory
```

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "inv_123",
        "name": "Tomatoes",
        "quantity": 50,
        "unit": "kg",
        "minQuantity": 10,
        "status": "in_stock",
        "lastRestocked": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Get Inventory Item

```http
GET /api/venues/:venueId/inventory/:itemId
```

#### Create Inventory Item

```http
POST /api/venues/:venueId/inventory
```

**Request Body:**

```json
{
  "name": "Tomatoes",
  "quantity": 50,
  "unit": "kg",
  "minQuantity": 10
}
```

#### Update Inventory Item

```http
PATCH /api/venues/:venueId/inventory/:itemId
```

#### Delete Inventory Item

```http
DELETE /api/venues/:venueId/inventory/:itemId
```

### Analytics

#### Get Revenue

```http
GET /api/venues/:venueId/analytics/revenue
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Start date (ISO 8601) |
| `to` | string | Yes | End date (ISO 8601) |
| `groupBy` | string | No | Group by (day, week, month) |

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 15000.00,
    "currency": "GBP",
    "breakdown": [
      {
        "date": "2024-01-01",
        "revenue": 500.00
      },
      {
        "date": "2024-01-02",
        "revenue": 750.00
      }
    ]
  }
}
```

#### Get Orders

```http
GET /api/venues/:venueId/analytics/orders
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Start date (ISO 8601) |
| `to` | string | Yes | End date (ISO 8601) |

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 500,
    "byStatus": {
      "pending": 10,
      "confirmed": 50,
      "preparing": 30,
      "ready": 20,
      "completed": 380,
      "cancelled": 10
    },
    "averageOrderValue": 30.00
  }
}
```

#### Get Popular Items

```http
GET /api/venues/:venueId/analytics/popular-items
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Start date (ISO 8601) |
| `to` | string | Yes | End date (ISO 8601) |
| `limit` | number | No | Number of items (default: 10) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "item_123",
        "name": "Burger",
        "orders": 150,
        "revenue": 1500.00
      }
    ]
  }
}
```

### AI Assistant

#### Create Conversation

```http
POST /api/ai-assistant/conversations
```

**Request Body:**

```json
{
  "venueId": "venue_123",
  "message": "What are our top selling items today?"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "conversationId": "conv_123",
    "message": "Based on today's data, your top selling items are: 1. Burger (45 orders), 2. Pizza (32 orders), 3. Salad (28 orders)",
    "context": {
      "venueId": "venue_123",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### Get Conversation

```http
GET /api/ai-assistant/conversations/:conversationId
```

#### Send Message

```http
POST /api/ai-assistant/conversations/:conversationId/messages
```

**Request Body:**

```json
{
  "message": "Show me the revenue for this week"
}
```

## Webhooks

### Webhook Events

| Event | Description |
|-------|-------------|
| `order.created` | A new order was created |
| `order.updated` | An order was updated |
| `order.completed` | An order was completed |
| `order.cancelled` | An order was cancelled |
| `table.occupied` | A table was occupied |
| `table.vacated` | A table was vacated |
| `inventory.low` | Inventory item is running low |
| `staff.created` | A staff member was created |
| `staff.updated` | A staff member was updated |

### Create Webhook

```http
POST /api/webhooks
```

**Request Body:**

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["order.created", "order.updated"],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload

```json
{
  "event": "order.created",
  "data": {
    "id": "order_123",
    "venueId": "venue_123",
    "status": "pending",
    "total": 14.38
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "signature": "sha256=..."
}
```

### Verify Webhook Signature

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  const expectedSignature = `sha256=${digest}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## SDKs

### JavaScript/TypeScript

```bash
npm install @servio/sdk
```

```typescript
import { ServioClient } from '@servio/sdk';

const client = new ServioClient({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.servio.com'
});

// Get venues
const venues = await client.venues.list();

// Create order
const order = await client.orders.create('venue_123', {
  tableId: 'table_123',
  items: [
    { itemId: 'item_123', quantity: 2 }
  ]
});
```

### Python

```bash
pip install servio-sdk
```

```python
from servio import ServioClient

client = ServioClient(
    api_key='your_api_key',
    base_url='https://api.servio.com'
)

# Get venues
venues = client.venues.list()

# Create order
order = client.orders.create('venue_123', {
    'table_id': 'table_123',
    'items': [
        {'item_id': 'item_123', 'quantity': 2}
    ]
})
```

### cURL Examples

```bash
# List venues
curl -X GET https://api.servio.com/venues \
  -H "Authorization: Bearer YOUR_API_KEY"

# Create order
curl -X POST https://api.servio.com/venues/venue_123/orders \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table_123",
    "items": [
      {"itemId": "item_123", "quantity": 2}
    ]
  }'
```

## Support

For API support, contact:

- Email: api-support@servio.com
- Documentation: https://docs.servio.com
- Status Page: https://status.servio.com
