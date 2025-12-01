# Orders Table Schema Comparison

## Database Schema Requirements

Based on the error logs, here's what we know about the database:

### ✅ REQUIRED FIELDS (must be provided):
1. **venue_id** - string (required)
2. **customer_name** - string (required)
3. **customer_phone** - string (required)
4. **items** - JSONB array (required, at least 1 item)
5. **total_amount** - number (required)

### ✅ OPTIONAL/NULLABLE FIELDS (can be null):
6. **table_number** - number or null
7. **table_id** - string (UUID) or null
8. **customer_email** - string or null
9. **notes** - string or null
10. **payment_method** - string or null
11. **order_status** - string (defaults to "IN_PREP" if not provided)
12. **payment_status** - string (defaults to "UNPAID" if not provided)
13. **payment_mode** - string (defaults to "online" if not provided)
14. **source** - string (defaults to "qr" if not provided)
15. **created_at** - timestamp (ISO string)
16. **updated_at** - timestamp (ISO string)

### ❌ GENERATED COLUMNS (DO NOT include in INSERT):
- **is_active** - GENERATED column (error code 428C9: "cannot insert a non-DEFAULT value into column 'is_active'")
  - This is computed automatically by the database
  - Must NOT be included in the insert payload

## Current Code Payload (app/api/orders/route.ts, lines 816-833)

### Fields Being Sent:
1. ✅ venue_id
2. ✅ table_number (nullable)
3. ✅ table_id (nullable)
4. ✅ customer_name
5. ✅ customer_phone
6. ✅ customer_email (nullable) - NOW INCLUDED
7. ✅ items (JSONB array)
8. ✅ total_amount
9. ✅ notes (nullable)
10. ✅ order_status (defaults to "IN_PREP")
11. ✅ payment_status (defaults to "UNPAID")
12. ✅ payment_mode (defaults to "online")
13. ✅ payment_method (nullable)
14. ✅ source (defaults to "qr")
15. ✅ created_at
16. ✅ updated_at

### Fields NOT Being Sent (Correctly):
- ❌ is_active (GENERATED COLUMN - correctly excluded)

## Conclusion

The payload now matches the database requirements:
- ✅ All required fields are included
- ✅ Optional fields are handled with null defaults
- ✅ Generated column (`is_active`) is correctly excluded
- ✅ Timestamps are set automatically
- ✅ Defaults are provided for status fields

The fix was correct: **`is_active` should NOT be included** because it's a generated column that the database computes automatically.

