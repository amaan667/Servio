# Customer Flow Testing Guide

## How to Test the Customer Flow and See Logs

### 1. **Access the Order Page Directly**
To test the customer flow, you can access the order page directly with these URLs:

**Demo Mode (Recommended for testing):**
```
https://servio-production.up.railway.app/order?venue=venue-1e02af4d&table=1&demo=1
```

**Real Mode:**
```
https://servio-production.up.railway.app/order?venue=venue-1e02af4d&table=1
```

### 2. **What Logs to Look For**

#### **In Deploy Logs (Railway Dashboard):**
Look for these log patterns:

1. **Order Page Access:**
   ```
   [ORDER PAGE SERVER] ===== ORDER PAGE ACCESSED =====
   [ORDER PAGE SERVER] Timestamp: 2025-01-XX...
   [ORDER PAGE SERVER] Venue slug: venue-1e02af4d
   [ORDER PAGE SERVER] Table number: 1
   [ORDER PAGE SERVER] Is demo: true/false
   ```

2. **Menu API Calls:**
   ```
   [MENU API] ===== MENU REQUEST RECEIVED =====
   [MENU API] Timestamp: 2025-01-XX...
   [MENU API] Venue ID: venue-1e02af4d
   [MENU API] Request URL: https://servio-production.up.railway.app/api/menu/venue-1e02af4d
   [MENU API] User Agent: Mozilla/5.0...
   [MENU API] Referer: https://servio-production.up.railway.app/order?venue=venue-1e02af4d&table=1&demo=1
   [MENU API] Successfully fetched 144 menu items for venue venue-1e02af4d
   ```

3. **Order Submission (when customer clicks "Submit Order"):**
   ```
   [ORDERS POST] ===== ORDER SUBMISSION API CALLED =====
   [ORDERS POST] Request received at: 2025-01-XX...
   [ORDERS POST] Raw request body: {...}
   [ORDERS POST] Validation successful: All required fields present
   [ORDERS POST] Database insertion successful
   [ORDERS POST] Order created with ID: xxx
   ```

#### **In Browser Console (F12 → Console):**
Look for these log patterns:

1. **QR Flow Debug:**
   ```
   [QR FLOW DEBUG] ===== CUSTOMER ORDER PAGE LOADED =====
   [QR FLOW DEBUG] URL: https://servio-production.up.railway.app/order?venue=venue-1e02af4d&table=1&demo=1
   [QR FLOW DEBUG] venueSlug from QR: venue-1e02af4d
   [QR FLOW DEBUG] tableNumber from QR: 1
   [QR FLOW DEBUG] isDemo from QR: true
   ```

2. **Cart Operations:**
   ```
   [CART DEBUG] ===== ITEM ADDED TO CART =====
   [CART DEBUG] Item: {...}
   [CART DEBUG] Cart state after addition: [...]
   ```

3. **Customer Details:**
   ```
   [CUSTOMER DEBUG] ===== CUSTOMER NAME CHANGED =====
   [CUSTOMER DEBUG] Field: name
   [CUSTOMER DEBUG] New value: "John Doe"
   ```

4. **Order Submission:**
   ```
   [ORDER SUBMIT] ===== SUBMIT ORDER CLICKED =====
   [ORDER SUBMIT] Customer info: {...}
   [ORDER SUBMIT] Cart: [...]
   [ORDER SUBMIT] DEMO FLOW: About to redirect to /checkout?demo=1
   ```

### 3. **Step-by-Step Testing Process**

1. **Open the order page** using one of the URLs above
2. **Check deploy logs** - you should see `[ORDER PAGE SERVER]` and `[MENU API]` logs
3. **Add items to cart** - check browser console for `[CART DEBUG]` logs
4. **Enter customer details** - check browser console for `[CUSTOMER DEBUG]` logs
5. **Click "Submit Order"** - check both browser console and deploy logs for submission logs
6. **Verify navigation** - should redirect to checkout page

### 4. **Common Issues to Look For**

- **Missing logs**: If you don't see `[ORDER PAGE SERVER]` logs, the page isn't being accessed
- **Menu loading issues**: If `[MENU API]` logs show errors, there's a database issue
- **Stuck on loading**: If `[ORDER SUBMIT]` logs show but no navigation, there's a routing issue
- **Missing customer data**: If `[CUSTOMER DEBUG]` logs don't appear, form inputs aren't working

### 5. **Quick Test Commands**

You can also test the APIs directly:

```bash
# Test menu API
curl "https://servio-production.up.railway.app/api/menu/venue-1e02af4d"

# Test order submission (demo)
curl -X POST "https://servio-production.up.railway.app/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "venue_id": "venue-1e02af4d",
    "table_number": "1",
    "customer_name": "Test Customer",
    "customer_phone": "123-456-7890",
    "items": [{"id": "item-1", "quantity": 1, "price": 10.00}],
    "total_amount": 10.00,
    "demo": true
  }'
```

### 6. **Expected Flow**

1. Customer scans QR → `/order?venue=venue-1e02af4d&table=1`
2. Page loads → `[ORDER PAGE SERVER]` logs appear
3. Menu loads → `[MENU API]` logs appear
4. Customer adds items → `[CART DEBUG]` logs appear
5. Customer enters details → `[CUSTOMER DEBUG]` logs appear
6. Customer submits → `[ORDER SUBMIT]` and `[ORDERS POST]` logs appear
7. Redirect to checkout → Navigation logs appear

If any step is missing logs, that's where the issue is!
