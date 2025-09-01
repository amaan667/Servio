-- QA Script for Dashboard Order Management
-- Run this to sanity-check counts while testing

-- 1. Check today's bounds for Europe/London timezone
WITH b AS (
  SELECT
    timezone('UTC', date_trunc('day', timezone('Europe/London', now()))) AS start_utc,
    timezone('UTC', date_trunc('day', timezone('Europe/London', now())) + interval '1 day') AS end_utc
)
SELECT
  'Today bounds' as check_type,
  start_utc,
  end_utc
FROM b;

-- 2. Check order counts by status for today
WITH b AS (
  SELECT
    timezone('UTC', date_trunc('day', timezone('Europe/London', now()))) AS start_utc,
    timezone('UTC', date_trunc('day', timezone('Europe/London', now())) + interval '1 day') AS end_utc
)
SELECT
  'Today order counts' as check_type,
  SUM( (o.order_status IN ('PLACED','IN_PREP','READY','SERVING'))::int ) AS live_candidates,
  SUM( (o.order_status IN ('SERVED','CANCELLED','REFUNDED','EXPIRED'))::int ) AS earlier_candidates,
  COUNT(*) as total_today
FROM orders o, b
WHERE o.created_at >= b.start_utc AND o.created_at < b.end_utc;

-- 3. Check history orders (SERVED from previous days)
WITH b AS (
  SELECT timezone('UTC', date_trunc('day', timezone('Europe/London', now()))) AS start_utc
)
SELECT
  'History orders' as check_type,
  COUNT(*) as history_count
FROM orders 
WHERE order_status='SERVED' AND created_at < (SELECT start_utc FROM b);

-- 4. Check orders_with_totals view
SELECT
  'View test' as check_type,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN calc_total_amount > 0 THEN 1 END) as orders_with_totals,
  AVG(calc_total_amount) as avg_total
FROM orders_with_totals;

-- 5. Check status transitions (should all be valid)
SELECT
  'Status validation' as check_type,
  order_status,
  payment_status,
  COUNT(*) as count
FROM orders
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- 6. Check for any orders that might violate the new constraints
SELECT
  'Constraint violations' as check_type,
  COUNT(*) as invalid_orders
FROM orders
WHERE order_status NOT IN ('PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'CANCELLED', 'REFUNDED', 'EXPIRED')
   OR payment_status NOT IN ('UNPAID', 'PAID', 'REFUNDED');
