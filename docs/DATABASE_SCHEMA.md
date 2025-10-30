# Database Schema Documentation

## Overview
This document provides a comprehensive overview of the Servio database schema, including all tables, columns, indexes, foreign keys, and Row Level Security (RLS) policies.

## Core Tables

### venues
Primary table for restaurant/venue information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Human-readable venue identifier |
| venue_name | varchar | NO | - | Display name of the venue |
| business_type | varchar | NO | - | Type of business (restaurant, cafe, etc) |
| owner_user_id | uuid | NO | - | Foreign key to auth.users |
| address | text | YES | null | Physical address |
| phone | varchar | YES | null | Contact phone number |
| email | varchar | YES | null | Contact email |
| slug | varchar | YES | null | URL-friendly identifier |
| timezone | varchar | NO | 'UTC' | Venue timezone |
| currency | varchar | NO | 'USD' | Currency code |
| logo_url | text | YES | null | Logo image URL |
| subscription_tier | varchar | NO | 'free' | Subscription level |
| trial_ends_at | timestamptz | YES | null | Trial expiration |
| daily_reset_time | time | NO | '04:00' | Daily reset time |
| last_reset_at | timestamptz | YES | null | Last reset timestamp |
| is_active | boolean | NO | true | Venue active status |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_venues_owner_user` ON owner_user_id
- `idx_venues_venue_id` ON venue_id (UNIQUE)
- `idx_venues_slug` ON slug

**RLS Policies:**
- Owners can SELECT, UPDATE their venues
- Public can SELECT active venues by slug
- Authenticated users can INSERT new venues

---

### user_venue_roles
Maps users to venues with assigned roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | Foreign key to auth.users |
| venue_id | varchar | NO | - | Foreign key to venues.venue_id |
| role | varchar | NO | - | User role (owner, manager, staff, server, kitchen) |
| permissions | jsonb | NO | '{}' | Custom permissions object |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_user_venue_roles_user_id` ON user_id
- `idx_user_venue_roles_venue_id` ON venue_id
- `idx_user_venue_roles_role` ON role

**Unique Constraint:**
- (user_id, venue_id) - One role per user per venue

---

### tables
Physical tables in the venue.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Foreign key to venues |
| label | varchar | NO | - | Table number/name |
| seats | int | NO | 4 | Number of seats |
| section | varchar | YES | null | Section name (patio, indoor, etc) |
| status | varchar | NO | 'available' | Current status |
| is_active | boolean | NO | true | Active status |
| qr_code_url | text | YES | null | QR code image URL |
| merged_with_table_id | uuid | YES | null | If merged, points to parent table |
| position_x | int | YES | null | X coordinate for visual layout |
| position_y | int | YES | null | Y coordinate for visual layout |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_tables_venue_id` ON venue_id
- `idx_tables_status` ON status
- `idx_tables_is_active` ON is_active WHERE is_active = true

---

### table_sessions
Active sessions at tables.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Foreign key to venues |
| table_id | uuid | NO | - | Foreign key to tables |
| status | varchar | NO | 'active' | Session status |
| started_at | timestamptz | NO | now() | Session start time |
| ended_at | timestamptz | YES | null | Session end time |
| server_id | uuid | YES | null | Assigned server |
| guest_count | int | NO | 1 | Number of guests |
| notes | text | YES | null | Session notes |
| total_amount | decimal | NO | 0 | Total bill amount |
| is_merged_into | uuid | YES | null | If merged, parent session ID |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_table_sessions_venue_id` ON venue_id
- `idx_table_sessions_table_id` ON table_id
- `idx_table_sessions_status` ON status
- `idx_table_sessions_started_at` ON started_at DESC

---

### orders
Customer orders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Foreign key to venues |
| table_id | uuid | YES | null | Foreign key to tables |
| counter_id | uuid | YES | null | For counter orders |
| order_number | varchar | NO | - | Human-readable order number |
| status | varchar | NO | 'pending' | Order status |
| order_type | varchar | NO | 'dine_in' | Order type |
| items | jsonb | NO | '[]' | Order items array |
| subtotal | decimal | NO | 0 | Subtotal before tax/tip |
| tax | decimal | NO | 0 | Tax amount |
| tip | decimal | YES | null | Tip amount |
| total | decimal | NO | 0 | Total amount |
| payment_status | varchar | NO | 'unpaid' | Payment status |
| payment_method | varchar | YES | null | Payment method used |
| customer_name | varchar | YES | null | Customer name |
| customer_phone | varchar | YES | null | Customer phone |
| customer_email | varchar | YES | null | Customer email |
| special_instructions | text | YES | null | Special instructions |
| assigned_to | uuid | YES | null | Assigned staff member |
| stripe_payment_intent_id | varchar | YES | null | Stripe payment ID |
| preparation_time | int | YES | null | Prep time in minutes |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |
| completed_at | timestamptz | YES | null | Completion timestamp |

**Indexes:**
- `idx_orders_venue_id` ON venue_id
- `idx_orders_table_id` ON table_id
- `idx_orders_status` ON status
- `idx_orders_created_at` ON created_at DESC
- `idx_orders_venue_created` ON (venue_id, created_at DESC)
- `idx_orders_status_venue` ON (status, venue_id) WHERE status IN ('pending', 'in_prep')

**Recommended New Indexes:**
```sql
-- For dashboard queries
CREATE INDEX CONCURRENTLY idx_orders_venue_status_created 
  ON orders(venue_id, status, created_at DESC);

-- For payment tracking
CREATE INDEX CONCURRENTLY idx_orders_payment_status 
  ON orders(payment_status, venue_id) 
  WHERE payment_status = 'unpaid';

-- For Stripe reconciliation
CREATE INDEX CONCURRENTLY idx_orders_stripe_payment 
  ON orders(stripe_payment_intent_id) 
  WHERE stripe_payment_intent_id IS NOT NULL;
```

---

### menu_items
Menu items available at venue.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Foreign key to venues |
| category_id | uuid | YES | null | Foreign key to menu_categories |
| name | varchar | NO | - | Item name |
| description | text | YES | null | Item description |
| price | decimal | NO | 0 | Item price |
| image_url | text | YES | null | Item image URL |
| is_available | boolean | NO | true | Currently available |
| is_active | boolean | NO | true | Active in system |
| preparation_time | int | YES | null | Prep time in minutes |
| tags | text[] | NO | '{}' | Tags array |
| allergens | text[] | NO | '{}' | Allergens array |
| calories | int | YES | null | Calorie count |
| spice_level | int | YES | null | Spice level (1-5) |
| display_order | int | NO | 0 | Display order |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_menu_items_venue_id` ON venue_id
- `idx_menu_items_category_id` ON category_id
- `idx_menu_items_is_available` ON is_available WHERE is_available = true
- `idx_menu_items_venue_active` ON (venue_id, is_active) WHERE is_active = true

**Recommended New Indexes:**
```sql
-- For menu display queries
CREATE INDEX CONCURRENTLY idx_menu_items_venue_display 
  ON menu_items(venue_id, category_id, display_order) 
  WHERE is_active = true AND is_available = true;

-- For search functionality
CREATE INDEX CONCURRENTLY idx_menu_items_name_trgm 
  ON menu_items USING gin(name gin_trgm_ops);
```

---

### staff_invitations
Pending staff invitations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| venue_id | varchar | NO | - | Foreign key to venues |
| email | varchar | NO | - | Invitee email |
| role | varchar | NO | - | Proposed role |
| permissions | jsonb | NO | '{}' | Permissions object |
| token | varchar | NO | - | Invitation token |
| status | varchar | NO | 'pending' | Invitation status |
| invited_by | uuid | NO | - | Inviter user ID |
| invited_by_email | varchar | YES | null | Inviter email |
| invited_by_name | varchar | YES | null | Inviter name |
| expires_at | timestamptz | NO | - | Expiration timestamp |
| accepted_at | timestamptz | YES | null | Acceptance timestamp |
| created_at | timestamptz | NO | now() | Creation timestamp |
| updated_at | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `idx_staff_invitations_venue_id` ON venue_id
- `idx_staff_invitations_token` ON token (UNIQUE)
- `idx_staff_invitations_email` ON email
- `idx_staff_invitations_status` ON status

---

## Performance Recommendations

### Slow Query Optimization
1. **Dashboard Order Fetching** - Add composite index on (venue_id, status, created_at)
2. **Menu Display** - Add composite index with WHERE clause for active items
3. **Payment Tracking** - Add partial index for unpaid orders

### Missing Indexes
```sql
-- High-priority indexes
CREATE INDEX CONCURRENTLY idx_reservations_venue_start 
  ON reservations(venue_id, start_at DESC);

CREATE INDEX CONCURRENTLY idx_kds_tickets_station_status 
  ON kds_tickets(station_id, status) 
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX CONCURRENTLY idx_feedback_venue_rating 
  ON feedback(venue_id, rating, created_at DESC);
```

### Partitioning Strategy (Future)
For high-volume tables, consider partitioning:
- `orders` - Partition by created_at (monthly)
- `analytics_events` - Partition by created_at (weekly)
- `kds_tickets` - Partition by created_at (monthly)

---

## Migration Strategy

### Current State
- 4 migrations in `supabase/migrations/`
- Manual schema changes via Supabase dashboard
- No automated migration tracking

### Recommended Approach
1. **Use Supabase CLI** for migrations
   ```bash
   supabase migration new add_performance_indexes
   ```

2. **Version Control** - Track all schema changes in git
3. **Testing** - Test migrations in staging before production
4. **Rollback Plan** - Include DOWN migrations for all schema changes

---

## RLS Policies Summary

### venues
- Owners can manage their venues
- Staff can view their assigned venues
- Public can view active venues

### orders
- Venue staff can manage orders for their venue
- Customers can view their own orders (by order_id token)

### menu_items
- Venue staff can manage menu items
- Public can view available items

### tables
- Venue staff can manage tables
- Public cannot access table data

---

## Database Health Metrics

### Current Stats
- Total tables: 30+
- Indexes: 80+
- RLS policies: 50+
- Database size: ~500MB (estimated)

### Monitoring Recommendations
1. Track slow queries (>100ms)
2. Monitor index usage
3. Alert on table bloat
4. Track connection pool usage
5. Monitor RLS policy performance

---

## Backup & Recovery

### Current Setup
- Supabase automatic daily backups
- Point-in-time recovery available
- Retention: 7 days (Free tier)

### Recommendations
1. Enable longer retention (30+ days)
2. Test restore procedures monthly
3. Document recovery runbook
4. Export critical data to external storage

---

Last Updated: 2025-10-29
Version: 1.0

