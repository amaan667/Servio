# Servio Ordering Process - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Order Flow Diagrams](#order-flow-diagrams)
3. [Step-by-Step Process](#step-by-step-process)
4. [Payment Methods](#payment-methods)
5. [Bill Splitting](#bill-splitting)
6. [Order Status Lifecycle](#order-status-lifecycle)
7. [Technical Implementation](#technical-implementation)

---

## 🎯 Overview

Servio supports **two ordering methods**:
- **QR Code Ordering** - Customers scan QR codes at tables
- **Counter Ordering** - Staff/customers order at a counter

Both flows support:
- ✅ Item modifiers/variants
- ✅ Special instructions
- ✅ Multiple payment methods
- ✅ Bill splitting (customer-side)
- ✅ Real-time order tracking
- ✅ KDS integration

---

## 🔄 Order Flow Diagrams

### Standard Order Flow (Single Payment)

```
┌─────────────────┐
│  QR Code Scan   │
│  /order?venue=X │
│  &table=Y       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Browse Menu    │
│  Add to Cart    │
│  (with modifiers)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enter Details  │
│  Name + Phone   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Payment Page   │
│  Select Method  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────────┐
│Pay   │  │Pay Later │
│Now   │  │/Pay Till │
└──┬───┘  └────┬─────┘
   │           │
   ▼           ▼
┌──────────┐ ┌──────────┐
│Stripe    │ │Order     │
│Checkout  │ │Created   │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌─────────────────┐
│ Order Created   │
│ Status: PLACED │
│ Payment: PAID/  │
│        UNPAID   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ KDS Tickets     │
│ Created         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Order Tracking  │
│ Real-time       │
└─────────────────┘
```

### Bill Splitting Flow (Customer-Side)

```
┌─────────────────┐
│  Cart Ready     │
│  Click "Split   │
│  Bill"          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bill Split     │
│  Modal Opens    │
│  - Select # of  │
│    people       │
│  - Assign items │
│    to each      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Split   │
│  Orders API     │
│  - Creates N    │
│    orders       │
│  - Creates N    │
│    Stripe       │
│    sessions     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redirect to    │
│  Stripe         │
│  Checkout #1    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  After Payment  │
│  Redirect to    │
│  Checkout #2    │
│  (if more)      │
└─────────────────┘
```

---

## 📝 Step-by-Step Process

### Phase 1: Order Initiation

#### 1.1 QR Code Scan
- **URL Format**: `/order?venue={venueSlug}&table={tableNumber}`
- **Counter Format**: `/order?venue={venueSlug}&counter={counterNumber}`
- **What Happens**:
  - Venue menu is fetched from `/api/menu/{venueSlug}`
  - Table/counter session is created or retrieved
  - Cart is initialized (scoped to venue + table)
  - Group size modal may appear (if enabled)

#### 1.2 Menu Browsing
- **Component**: `EnhancedPDFMenuDisplay`
- **Features**:
  - Category-based menu display
  - Item images, descriptions, prices
  - Availability status
  - Modifier selection (if configured)

#### 1.3 Adding Items to Cart
- **Component**: `ItemDetailsModal`
- **Process**:
  1. Customer clicks item → modal opens
  2. Select quantity (if multiple)
  3. Select modifiers (if available):
     - Single choice (e.g., Size: Small/Medium/Large)
     - Multiple choice (e.g., Toppings: Cheese, Bacon, etc.)
  4. Add special instructions (optional)
  5. Click "Add to Cart"
- **Cart Storage**: localStorage (scoped to venue + table)
- **Cart Structure**:
```typescript
{
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers?: Record<string, string[]>;
  modifierPrice?: number;
  specialInstructions?: string;
}
```

### Phase 2: Checkout

#### 2.1 Customer Information
- **Component**: `CheckoutModal`
- **Required Fields**:
  - Name (letters, spaces, hyphens only)
  - Phone (international or local format)
- **Validation**: Client-side + server-side

#### 2.2 Order Submission
- **Hook**: `useOrderSubmission`
- **Process**:
  1. Validate cart and customer info
  2. Calculate total (including modifier prices)
  3. Save checkout data to localStorage:
     ```json
     {
       "venueId": "venue-123",
       "tableNumber": 5,
       "customerName": "John Doe",
       "customerPhone": "+44 7123 456789",
       "cart": [...],
       "total": 45.50,
       "paymentMode": "online",
       "source": "qr"
     }
     ```
  4. Redirect to `/payment`

### Phase 3: Payment Selection

#### 3.1 Payment Page
- **Component**: `PaymentPage`
- **Options**:
  1. **Pay Now** (Stripe)
  2. **Pay at Till** (Staff processes)
  3. **Pay Later** (Customer pays later via QR rescan)
  4. **Split Bill** (Customer-side splitting)

#### 3.2 Pay Now Flow
1. Click "Pay Now"
2. Create Stripe checkout session (`/api/checkout`)
3. Redirect to Stripe hosted checkout
4. Customer enters card details
5. Stripe processes payment
6. Webhook (`/api/stripe/webhook`) receives payment confirmation
7. Order created with `payment_status: "PAID"`
8. Redirect to success page

#### 3.3 Pay at Till Flow
1. Click "Pay at Till"
2. Order created with `payment_status: "UNPAID"` and `payment_mode: "pay_at_till"`
3. Order appears in POS dashboard
4. Staff processes payment manually
5. Staff marks order as paid

#### 3.4 Pay Later Flow
1. Click "Pay Later"
2. Order created with `payment_status: "UNPAID"` and `payment_mode: "pay_later"`
3. Customer receives QR code/link
4. Customer scans QR later
5. Redirects to payment page
6. Customer pays via Stripe

### Phase 4: Order Creation

#### 4.1 Order API (`/api/orders`)
- **Endpoint**: `POST /api/orders`
- **Process**:
  1. Validate request (venue, customer, items, total)
  2. Verify venue exists (create if demo)
  3. Get/create table record
  4. Create order record:
     ```json
     {
       "venue_id": "venue-123",
       "table_id": "table-456",
       "table_number": 5,
       "customer_name": "John Doe",
       "customer_phone": "+44 7123 456789",
       "total_amount": 45.50,
       "order_status": "PLACED",
       "payment_status": "PAID" | "UNPAID",
       "payment_mode": "online" | "pay_at_till" | "pay_later",
       "items": [
         {
           "menu_item_id": "item-123",
           "item_name": "Burger",
           "quantity": 2,
           "price": 15.00,
           "modifiers": {
             "Size": ["Large"],
             "Toppings": ["Cheese", "Bacon"]
           },
           "special_instructions": "No onions"
         }
       ],
       "source": "qr" | "counter"
     }
     ```
  5. Create KDS tickets (one per item)
  6. Publish real-time event
  7. Return order

#### 4.2 KDS Ticket Creation
- **Function**: `createKDSTickets()`
- **Process**:
  1. Ensure KDS stations exist (create defaults if needed)
  2. Route items to appropriate stations (Expo, Grill, Fryer, etc.)
  3. Create ticket for each item:
     ```json
     {
       "venue_id": "venue-123",
       "order_id": "order-789",
       "station_id": "station-grill",
       "item_name": "Burger",
       "quantity": 2,
       "modifiers": {...},
       "special_instructions": "No onions",
       "table_number": 5,
       "table_label": "Table 5",
       "status": "new"
     }
     ```

### Phase 5: Order Processing

#### 5.1 Kitchen Display System (KDS)
- **Component**: `KDSClient`
- **Status Flow**: `new → in_progress → ready → bumped`
- **Features**:
  - Real-time updates via Supabase subscriptions
  - Station-based filtering
  - Modifier display
  - Special instructions display
  - Order grouping by table

#### 5.2 Order Status Updates
- **API**: `PATCH /api/orders/update-status`
- **Status Flow**:
  ```
  PLACED → ACCEPTED → IN_PREP → READY → SERVING → COMPLETED
  ```
- **Validation**:
  - Cannot mark `COMPLETED` unless `payment_status: "PAID"`
  - Status updates trigger real-time events

### Phase 6: Order Completion

#### 6.1 Completion Process
- **API**: `POST /api/orders/complete`
- **Requirements**:
  - Order must be `SERVING`
  - Payment must be `PAID`
- **Actions**:
  1. Update `order_status` to `COMPLETED`
  2. Deduct inventory (if configured)
  3. Clean up table session (if all orders completed)
  4. Send completion notification

---

## 💳 Payment Methods

### 1. Pay Now (Stripe)
- **Flow**: Stripe Checkout → Webhook → Order Created
- **Status**: `payment_status: "PAID"`, `payment_mode: "online"`
- **Receipt**: Automatic email receipt from Stripe

### 2. Pay at Till
- **Flow**: Order Created → Staff Processes → Mark Paid
- **Status**: `payment_status: "UNPAID"` → `"PAID"`, `payment_mode: "pay_at_till"`
- **Receipt**: Manual receipt from POS

### 3. Pay Later
- **Flow**: Order Created → QR Code Generated → Customer Pays Later
- **Status**: `payment_status: "UNPAID"`, `payment_mode: "pay_later"`
- **Receipt**: Email receipt after payment

### 4. Table-Level Payment
- **Flow**: Multiple orders → Single Stripe checkout → All orders marked paid
- **Status**: All orders → `payment_status: "PAID"`
- **Use Case**: Group wants to pay all orders together

---

## 🧾 Bill Splitting

### Customer-Side Bill Splitting

#### How It Works:
1. **Initiation**: Customer clicks "Split Bill" button
2. **Modal Opens**: `BillSplitModal` component
3. **Assignment**:
   - Select number of people (2-10)
   - Assign items to each person
   - Items can be assigned to multiple people (shared items)
   - Name each person
4. **Order Creation**: 
   - API: `POST /api/orders/create-split-orders`
   - Creates N separate orders (one per person)
   - Each order linked via `split_group_id` in metadata
   - Creates N Stripe checkout sessions
5. **Payment**:
   - Redirect to first checkout session
   - After payment, redirect to next session
   - Each person pays their portion separately

#### Example:
```
Total Bill: £60.00
- Person 1 (John): Burger £15 + Drink £5 = £20
- Person 2 (Jane): Pasta £18 + Drink £5 = £23
- Person 3 (Bob): Salad £12 + Drink £5 = £17
Total: £60 ✅
```

#### Technical Details:
- **Orders**: Separate order records with `metadata.split_group_id`
- **Checkout**: Individual Stripe sessions per split
- **Tracking**: All orders linked via group ID
- **KDS**: Each split order creates separate tickets

### Staff-Side Bill Splitting (Till Splitting)

#### How It Works:
1. Staff opens table in POS dashboard
2. Clicks "Split Bill"
3. Assigns orders to different splits
4. Processes payment for each split separately
5. Can use cash, card, or Stripe

#### Difference:
- **Customer-side**: Customer controls splitting, pays via Stripe
- **Staff-side**: Staff controls splitting, processes payment manually

---

## 📊 Order Status Lifecycle

```
┌─────────┐
│ PLACED  │ ← Order created, awaiting kitchen acceptance
└────┬────┘
     │
     ▼
┌──────────┐
│ ACCEPTED │ ← Kitchen accepted order, starting prep
└────┬─────┘
     │
     ▼
┌──────────┐
│ IN_PREP  │ ← Currently being prepared
└────┬─────┘
     │
     ▼
┌──────────┐
│  READY   │ ← Ready for pickup/serving
└────┬─────┘
     │
     ▼
┌──────────┐
│ SERVING  │ ← Being served to customer
└────┬─────┘
     │
     ▼
┌──────────┐
│COMPLETED │ ← Order finished (requires payment)
└──────────┘
```

**Payment Status**:
- `UNPAID` - Payment not collected
- `PAID` - Payment completed
- `REFUNDED` - Full refund issued
- `PARTIALLY_REFUNDED` - Partial refund issued

**Critical Rule**: Order cannot be `COMPLETED` unless `payment_status: "PAID"`

---

## 🔧 Technical Implementation

### Key Files

#### Frontend
- `app/order/page.tsx` - Main ordering page
- `app/order/components/ItemDetailsModal.tsx` - Item selection with modifiers
- `app/order/components/BillSplitModal.tsx` - Bill splitting UI
- `app/order/hooks/useOrderCart.ts` - Cart management
- `app/order/hooks/useOrderSubmission.ts` - Order submission logic
- `app/payment/page.tsx` - Payment selection page

#### Backend
- `app/api/orders/route.ts` - Order creation endpoint
- `app/api/orders/create-split-orders/route.ts` - Split order creation
- `app/api/checkout/route.ts` - Stripe checkout session creation
- `app/api/stripe/webhook/route.ts` - Payment webhook handler
- `app/api/orders/update-status/route.ts` - Status updates

#### Database
- `orders` table - Order records
- `kds_tickets` table - Kitchen display tickets
- `menu_items` table - Menu items with modifiers (JSONB)
- `tables` table - Table management

### Real-Time Updates

- **Technology**: Supabase Realtime subscriptions
- **Channels**:
  - `orders` - Order status updates
  - `kds_tickets` - KDS ticket updates
- **Events**: `INSERT`, `UPDATE`, `DELETE`

### Error Handling

- **Retry Logic**: Stripe API calls use exponential backoff
- **Circuit Breaker**: Prevents cascading failures
- **Validation**: Client-side + server-side validation
- **Idempotency**: Prevents duplicate orders

---

## 🎯 Summary

**Servio's ordering process is:**

1. ✅ **Flexible** - Supports QR, counter, and multiple payment methods
2. ✅ **Feature-Rich** - Modifiers, bill splitting, real-time tracking
3. ✅ **Secure** - Payment verification, RLS policies
4. ✅ **Reliable** - Error retry logic, circuit breakers
5. ✅ **User-Friendly** - Intuitive UI, clear status updates

**Ready for production use!** 🚀

