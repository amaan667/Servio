# Servio API Reference

## Base URL

```
Production: https://servio-production.up.railway.app
Development: http://localhost:3000
```

## Authentication

All authenticated endpoints require a valid session token sent via:
- **Cookie:** `sb-auth-token` (automatic)
- **Header:** `Authorization: Bearer YOUR_TOKEN`

### Get Session Token

```bash
POST /auth/sign-in
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

## Rate Limiting

| Tier | Requests/Minute | Applied To |
|------|-----------------|------------|
| Public | 30 | Unauthenticated endpoints |
| Standard | 60 | Most authenticated endpoints |
| Relaxed | 120 | Read-only operations |
| Strict | 10 | Sensitive operations |

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Tier`: Current tier
- `Retry-After`: Seconds to wait (429 responses)

## Error Responses

All errors follow this format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "fieldName",
    "issue": "validation error"
  }
}
```

### Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## API Endpoints

### Orders

#### Create Order

```bash
POST /api/orders
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "venue_id": "uuid",
  "table_id": "uuid",
  "items": [
    {
      "menu_item_id": "uuid",
      "item_name": "Pizza",
      "quantity": 2,
      "price": 15.99,
      "special_instructions": "Extra cheese"
    }
  ],
  "payment_method": "stripe",
  "total_amount": 31.98
}
```

Response:
```json
{
  "data": {
    "id": "uuid",
    "venue_id": "uuid",
    "status": "pending",
    "items": [...],
    "total_amount": 31.98,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

#### Get Orders

```bash
GET /api/orders?venue_id=uuid&status=pending&limit=20&page=1
Authorization: Bearer TOKEN
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Update Order Status

```bash
PATCH /api/orders/:id
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "status": "preparing",
  "notes": "Started cooking"
}
```

#### Search Orders

```bash
GET /api/orders/search?venue_id=uuid&q=john
Authorization: Bearer TOKEN
```

### Menu

#### Get Menu Items

```bash
GET /api/menu/:venueId
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Margherita Pizza",
      "description": "Classic tomato and mozzarella",
      "price": 12.99,
      "category": "Pizza",
      "image_url": "https://...",
      "is_available": true,
      "allergens": ["dairy", "gluten"],
      "dietary_tags": ["vegetarian"]
    }
  ]
}
```

#### Create Menu Item

```bash
POST /api/menu/items
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "venue_id": "uuid",
  "name": "Caesar Salad",
  "price": 8.99,
  "category": "Salads",
  "description": "Fresh romaine with caesar dressing",
  "is_available": true
}
```

#### Update Menu Item

```bash
PATCH /api/menu/items/:id
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "price": 9.99,
  "is_available": false
}
```

### Tables

#### Get Tables

```bash
GET /api/tables?venue_id=uuid
Authorization: Bearer TOKEN
```

#### Create Table

```bash
POST /api/tables
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "venue_id": "uuid",
  "table_number": "A1",
  "capacity": 4,
  "status": "available"
}
```

#### Update Table Status

```bash
PATCH /api/tables/:id
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "status": "occupied"
}
```

### Inventory

#### Get Ingredients

```bash
GET /api/inventory/ingredients?venue_id=uuid
Authorization: Bearer TOKEN
```

#### Adjust Stock

```bash
POST /api/inventory/stock/adjust
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "ingredient_id": "uuid",
  "quantity": 50,
  "reason": "purchase",
  "notes": "Weekly restock"
}
```

### Analytics

#### Get Order Stats

```bash
GET /api/analytics/orders?venue_id=uuid&start_date=2025-01-01&end_date=2025-01-31
Authorization: Bearer TOKEN
```

Response:
```json
{
  "data": {
    "total_orders": 450,
    "total_revenue": 12500.50,
    "avg_order_value": 27.78,
    "by_status": {
      "completed": 400,
      "cancelled": 50
    },
    "top_items": [
      {
        "name": "Margherita Pizza",
        "quantity": 150,
        "revenue": 1948.50
      }
    ]
  }
}
```

### Staff

#### Invite Staff Member

```bash
POST /api/staff/invitations
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "email": "staff@example.com",
  "role": "staff",
  "venue_id": "uuid"
}
```

#### Get Staff List

```bash
GET /api/staff/list?venue_id=uuid
Authorization: Bearer TOKEN
```

### Payments

#### Create Payment Intent

```bash
POST /api/payments/create-intent
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "amount": 50.00,
  "currency": "usd",
  "payment_method": "card"
}
```

#### Create Checkout Session

```bash
POST /api/stripe/create-checkout-session
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "price_id": "price_xxx",
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

### AI Assistant

#### Create Conversation

```bash
POST /api/ai-assistant/conversations
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "venue_id": "uuid",
  "title": "Order Management Help"
}
```

#### Send Message

```bash
POST /api/ai-assistant/conversations/:id/messages
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "content": "Show me today's orders"
}
```

## Webhooks

### Stripe Webhook

```bash
POST /api/stripe/webhook
Content-Type: application/json
Stripe-Signature: signature

{
  "type": "checkout.session.completed",
  "data": {
    "object": {...}
  }
}
```

## Interactive API Documentation

For interactive API testing, visit:
- **Swagger UI:** [/api-docs](/api-docs)
- **OpenAPI Spec:** [/api/docs](/api/docs)

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Make API request
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('venue_id', venueId);
```

### cURL Examples

```bash
# Get orders
curl -X GET \
  'https://servio-production.up.railway.app/api/orders?venue_id=uuid' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Create order
curl -X POST \
  'https://servio-production.up.railway.app/api/orders' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "venue_id": "uuid",
    "items": [...],
    "total_amount": 50.00
  }'
```

## Best Practices

1. **Always validate input** - Use Zod schemas for validation
2. **Handle errors gracefully** - Check error responses
3. **Implement retry logic** - For transient failures
4. **Cache responses** - Where appropriate
5. **Use pagination** - For large datasets
6. **Monitor rate limits** - Check headers
7. **Secure API keys** - Never commit to version control

## Support

- Interactive docs: [/api-docs](/api-docs)
- GitHub issues: [github.com/amaan667/Servio/issues](https://github.com/amaan667/Servio/issues)
- Email: api@servio.com

