# API Specification

## Overview

This document provides an overview of the API structure. All API routes use the unified handler pattern (`createUnifiedHandler`) for consistency.

## Base URL

```
/api
```

## Authentication

Most endpoints require authentication via Supabase Auth. The unified handler automatically:
- Validates JWT tokens
- Extracts user context
- Enforces venue access when required

## Common Response Format

All endpoints return a standardized response:

```typescript
{
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  requestId?: string;
}
```

## Rate Limiting

All endpoints are rate-limited. Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Endpoints

### Orders

- `POST /api/orders` - Create new order
- `GET /api/orders/[orderId]` - Get order details
- `PATCH /api/orders/[orderId]` - Update order
- `POST /api/orders/update-status` - Update order status
- `POST /api/orders/update-payment-status` - Update payment status
- `POST /api/orders/serve` - Mark order as served
- `POST /api/orders/complete` - Complete order
- `POST /api/orders/bulk-complete` - Bulk complete orders
- `POST /api/orders/notify-ready` - Send order ready notification
- `POST /api/orders/pay-multiple` - Pay multiple orders
- `POST /api/orders/[orderId]/collect-payment` - Collect payment for order

### Payments

- `GET /api/payments` - Get payment data
- `POST /api/payments/create-intent` - Create payment intent

### Tables

- `GET /api/tables` - List all tables
- `POST /api/tables` - Create table
- `PUT /api/tables/[tableId]` - Update table
- `DELETE /api/tables/[tableId]` - Delete table
- `POST /api/tables/[tableId]/close` - Close table
- `POST /api/tables/clear` - Clear all table sessions
- `POST /api/tables/remove` - Remove tables

### Reservations

- `GET /api/reservations` - List reservations
- `POST /api/reservations/create` - Create reservation
- `POST /api/reservations/checkin` - Check in reservation

### KDS (Kitchen Display System)

- `GET /api/kds/stations` - List KDS stations
- `POST /api/kds/stations` - Create KDS station
- `GET /api/kds/tickets` - List KDS tickets
- `GET /api/kds/status` - Get KDS system status
- `PATCH /api/kds/tickets/bulk-update` - Bulk update tickets

### Staff

- `GET /api/staff/list` - List staff members
- `POST /api/staff/add` - Add staff member
- `POST /api/staff/setup-invitations` - Setup staff invitation system

### Venues

- `POST /api/venues/upsert` - Create or update venue
- `POST /api/venues/update-reset-time` - Update daily reset time

### Feedback

- `GET /api/feedback/questions` - List feedback questions
- `POST /api/feedback/questions` - Create feedback question
- `PATCH /api/feedback/questions` - Update feedback question
- `DELETE /api/feedback/questions` - Delete feedback question

### User

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### System

- `GET /api/tier-check` - Check subscription tier
- `GET /api/features/check` - Check feature access
- `POST /api/errors` - Log client errors
- `POST /api/pilot-feedback` - Submit pilot feedback
- `POST /api/support/submit` - Submit support request
- `POST /api/delete-account` - Delete user account

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Notes

- All endpoints use Zod for request validation
- Venue access is automatically verified when `requireVenueAccess: true`
- Role-based access control is enforced via `requireRole` option
- All database queries respect Row Level Security (RLS) policies
