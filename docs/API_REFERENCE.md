# API Reference

Complete API documentation for Servio platform.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Most endpoints require authentication via Supabase session cookie or Bearer token.

```typescript
// Cookie-based (browser)
fetch('/api/orders', { credentials: 'include' })

// Bearer token (API clients)
fetch('/api/orders', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

## Response Format

All API responses follow this structure:

```typescript
{
  ok: boolean;
  data?: T;           // Success data
  error?: string;     // Error message
  message?: string;   // Additional info
}
```

## Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

## Endpoints

### Orders

#### Get Orders
```
GET /api/orders?venueId={venueId}&status={status}
```

**Query Parameters**:
- `venueId` (required) - Venue ID
- `status` (optional) - Filter by status
- `limit` (optional) - Results limit

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "venue_id": "uuid",
      "table_number": 5,
      "items": [...],
      "total_amount": 45.99,
      "order_status": "pending",
      "payment_status": "UNPAID",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Order
```
POST /api/orders
```

**Body**:
```json
{
  "venueId": "uuid",
  "tableNumber": 5,
  "items": [
    {
      "item_id": "uuid",
      "quantity": 2,
      "specialInstructions": "No onions"
    }
  ]
}
```

### Menu

#### Get Menu
```
GET /api/menu/{venueId}
```

#### Upload Menu
```
POST /api/menu/upload
Content-Type: multipart/form-data
```

**Form Data**:
- `file` - PDF/image file
- `venueId` - Venue ID

### Staff

#### List Staff
```
GET /api/staff/list?venueId={venueId}
```

#### Add Staff
```
POST /api/staff/add
```

**Body**:
```json
{
  "venueId": "uuid",
  "email": "staff@example.com",
  "role": "server"
}
```

### Tables

#### Get Tables
```
GET /api/tables?venueId={venueId}
```

#### Create Table
```
POST /api/tables
```

**Body**:
```json
{
  "venueId": "uuid",
  "tableNumber": 1,
  "capacity": 4,
  "area": "Main Dining"
}
```

### Payments

#### Create Payment Intent
```
POST /api/payments/create-intent
```

**Body**:
```json
{
  "orderId": "uuid",
  "amount": 45.99
}
```

### Stripe Webhooks

```
POST /api/stripe/webhooks
```

Webhook endpoint for Stripe events. Configure in Stripe dashboard.

## Rate Limiting

API endpoints are rate-limited:
- **Public**: 60 requests/minute
- **Authenticated**: 120 requests/minute
- **Premium**: Higher limits

Rate limit headers:
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Error Handling

### Validation Error (400)
```json
{
  "ok": false,
  "error": "Validation error",
  "message": "venueId is required"
}
```

### Unauthorized (401)
```json
{
  "ok": false,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### Rate Limited (429)
```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Webhooks

### Order Status Changed
```
POST /api/webhooks/order-status
```

## Testing

Use Postman collection or `curl`:

```bash
# Get orders
curl -X GET \
  'http://localhost:3000/api/orders?venueId=xxx' \
  -H 'Authorization: Bearer TOKEN'

# Create order
curl -X POST \
  'http://localhost:3000/api/orders' \
  -H 'Content-Type: application/json' \
  -d '{"venueId": "xxx", "tableNumber": 1, "items": []}'
```

## Versioning

Currently using unversioned endpoints. Future versioning will use:
- `/api/v1/orders`
- `/api/v2/orders`

See `docs/API_VERSIONING.md` for migration guide.

