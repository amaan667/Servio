# Database Query Optimization Guide

This guide outlines best practices for optimizing database queries in Servio.

## 📊 Query Performance Principles

### 1. Use Indexes

Always index frequently queried columns:

```sql
-- Good: Indexed foreign keys
CREATE INDEX idx_orders_venue_id ON orders(venue_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);

-- Good: Composite indexes for common queries
CREATE INDEX idx_orders_venue_status ON orders(venue_id, order_status);
```

### 2. Select Only Needed Columns

```typescript
// ❌ Bad: Selects all columns
const { data } = await supabase
  .from("orders")
  .select("*")
  .eq("venue_id", venueId);

// ✅ Good: Selects only needed columns
const { data } = await supabase
  .from("orders")
  .select("id, total_amount, order_status, created_at")
  .eq("venue_id", venueId);
```

### 3. Use Pagination

```typescript
// ❌ Bad: Fetches all records
const { data } = await supabase
  .from("orders")
  .select("*")
  .eq("venue_id", venueId);

// ✅ Good: Paginated query
const { data } = await supabase
  .from("orders")
  .select("*")
  .eq("venue_id", venueId)
  .order("created_at", { ascending: false })
  .range(0, 49); // First 50 records
```

### 4. Use Filters Early

```typescript
// ❌ Bad: Filters after fetching
const { data } = await supabase
  .from("orders")
  .select("*");
const filtered = data?.filter(o => o.venue_id === venueId && o.status === "active");

// ✅ Good: Filters in query
const { data } = await supabase
  .from("orders")
  .select("*")
  .eq("venue_id", venueId)
  .eq("order_status", "active");
```

### 5. Avoid N+1 Queries

```typescript
// ❌ Bad: N+1 queries
const { data: orders } = await supabase.from("orders").select("*");
for (const order of orders || []) {
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);
}

// ✅ Good: Single query with join
const { data: orders } = await supabase
  .from("orders")
  .select(`
    *,
    order_items (*)
  `);
```

### 6. Use Caching

```typescript
// ✅ Good: Cache frequently accessed data
import { cache } from "@/lib/cache";

async function getVenue(venueId: string) {
  const cacheKey = `venue:${venueId}`;
  
  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  
  // Fetch from database
  const { data } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .single();
  
  // Cache for 5 minutes
  if (data) {
    await cache.set(cacheKey, data, { ttl: 300 });
  }
  
  return data;
}
```

## 🔍 Common Patterns

### Pattern 1: Recent Orders with Status

```typescript
// Optimized query with indexes
const { data } = await supabase
  .from("orders")
  .select("id, total_amount, order_status, created_at")
  .eq("venue_id", venueId)
  .eq("order_status", "active")
  .order("created_at", { ascending: false })
  .limit(50);
```

**Indexes needed:**
```sql
CREATE INDEX idx_orders_venue_status_created 
ON orders(venue_id, order_status, created_at DESC);
```

### Pattern 2: Aggregations

```typescript
// Use database aggregations instead of fetching all data
const { data } = await supabase
  .from("orders")
  .select("order_status, total_amount")
  .eq("venue_id", venueId)
  .gte("created_at", startDate)
  .lte("created_at", endDate);

// Then aggregate in application
const summary = data?.reduce((acc, order) => {
  acc[order.order_status] = (acc[order.order_status] || 0) + order.total_amount;
  return acc;
}, {} as Record<string, number>);
```

### Pattern 3: Real-time Subscriptions

```typescript
// Use Supabase real-time efficiently
const channel = supabase
  .channel(`venue:${venueId}:orders`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "orders",
      filter: `venue_id=eq.${venueId}`,
    },
    (payload) => {
      // Handle update
    }
  )
  .subscribe();

// Clean up on unmount
return () => {
  supabase.removeChannel(channel);
};
```

## 📈 Performance Monitoring

### Query Timing

```typescript
async function timedQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query: ${queryName} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Query failed: ${queryName} after ${duration}ms`, { error });
    throw error;
  }
}

// Usage
const orders = await timedQuery(
  () => supabase.from("orders").select("*").eq("venue_id", venueId),
  "getOrders"
);
```

### Explain Plans

For complex queries, use EXPLAIN to understand execution:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE venue_id = 'xxx'
  AND order_status = 'active'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

## 🚨 Anti-Patterns to Avoid

### 1. SELECT * in Production

```typescript
// ❌ Bad
.select("*")

// ✅ Good
.select("id, name, status, created_at")
```

### 2. Fetching All Records

```typescript
// ❌ Bad
.select("*") // No limit

// ✅ Good
.select("*").limit(100)
```

### 3. Multiple Round Trips

```typescript
// ❌ Bad
const venue = await getVenue(venueId);
const orders = await getOrders(venueId);
const staff = await getStaff(venueId);

// ✅ Good: Use joins or batch queries
const { data } = await supabase
  .from("venues")
  .select(`
    *,
    orders (*),
    staff (*)
  `)
  .eq("id", venueId)
  .single();
```

### 4. Not Using Transactions

```typescript
// ❌ Bad: Multiple separate operations
await supabase.from("orders").insert(order);
await supabase.from("order_items").insert(items);
await supabase.from("inventory").update(stock);

// ✅ Good: Use transactions (via Supabase RPC)
await supabase.rpc("create_order_with_items", {
  order_data: order,
  items_data: items,
});
```

## 🛠️ Tools

### Supabase Dashboard

- Use the Supabase dashboard to monitor query performance
- Check the "Database" > "Query Performance" section
- Review slow queries and optimize

### Query Analysis

```typescript
// Add query logging in development
if (process.env.NODE_ENV === "development") {
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = function(table: string) {
    const query = originalFrom(table);
    const originalSelect = query.select.bind(query);
    query.select = function(columns?: string) {
      logger.debug(`[DB QUERY] ${table}.select(${columns})`);
      return originalSelect(columns);
    };
    return query;
  };
}
```

## 📚 Resources

- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Indexing Best Practices](https://use-the-index-luke.com/)

---

Remember: Measure first, optimize second. Use query timing and EXPLAIN plans to identify bottlenecks.


