# Servio Operational Runbooks

## Payments & Webhook Replay

### Payment Flow Overview
Servio supports three payment modes:
- **Pay Now**: Immediate payment via Stripe Checkout (redirects to Stripe)
- **Pay Later**: Order first, pay later from table payment screen
- **Pay at Till**: Order first, pay at venue till (no online payment)

### Webhook Processing
Stripe webhooks land at `/api/stripe/webhooks` (subscriptions) and `/api/stripe/webhook` (customer orders).

Webhooks are stored in `stripe_webhook_events` table with idempotency based on `event_id`.

Processing status:
- `received`: Event stored but not processed
- `processing`: Currently being handled
- `succeeded`: Successfully processed
- `failed`: Processing failed (will be retried via reconcile)

### Finding & Replaying Failed Webhooks
1. Query `stripe_webhook_events` for failed events:
   ```sql
   SELECT event_id, type, attempts, last_error
   FROM stripe_webhook_events
   WHERE status = 'failed'
   ORDER BY updated_at DESC;
   ```

2. Manual replay: Call reconcile endpoint
   ```bash
   curl -X POST /api/stripe/reconcile \
     -H "Authorization: Bearer CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit": 10}'
   ```

3. Check reconcile logs in Railway for processing status.

### Investigating Payment Discrepancies
1. Check order payment status in `orders` table
2. Verify webhook events in `stripe_webhook_events`
3. Check Stripe Dashboard for payment intent status
4. **Do NOT** manually edit order payment_status - let webhooks/reconcile handle it

## Daily Reset & Inventory Correction

### Daily Reset Process
1. Venue owners can trigger daily reset via dashboard or API
2. Resets clear completed orders and archived data
3. Typically runs at venue's configured `daily_reset_time`

### Manual Daily Reset
```bash
curl -X POST /api/cron/daily-reset \
  -H "Authorization: Bearer CRON_SECRET"
```

### Inventory Corrections
**Safe corrections only:**
- Use `/api/inventory/stock/adjust` endpoint for stock level changes
- Log all adjustments with reason and user
- Never directly edit database stock levels

**Avoid during busy hours:**
- Schedule corrections during low-traffic periods
- Test with small adjustments first

### Recovery from Incorrect Inventory
1. Check `inventory_movements` table for recent changes
2. Use stocktake feature to recount and adjust
3. Document root cause to prevent recurrence

## KDS Recovery

### KDS Overview
Kitchen Display System (KDS) shows orders to kitchen staff.

- **Production-Ready**: Robust connection handling with automatic recovery
- **Real-time Updates**: Live synchronization with exponential backoff reconnection
- **Connection Status**: Visual indicator shows connection health
- **Screens**: Display tickets from `kds_tickets` table
- **Stations**: Configurable via `/api/kds/stations`

### KDS Connection Management

#### Connection Status Indicator
The KDS displays a connection status indicator:
- 🟢 **Connected**: Real-time updates active
- 🟡 **Connecting**: Attempting to reconnect
- 🔴 **Disconnected/Error**: Connection lost, automatic recovery in progress

#### Automatic Recovery
KDS implements exponential backoff reconnection (1s, 2s, 4s, 8s, 16s) with:
- Up to 5 automatic reconnection attempts
- Automatic backfill of missing tickets on reconnection
- Session validation and refresh handling

### Recovery from KDS Issues

#### Screen Freezes/Stuck Orders
1. Check connection status indicator
2. If disconnected, wait for automatic reconnection (up to 30s)
3. Check KDS status endpoint:
   ```bash
   GET /api/kds/status?venueId=YOUR_VENUE_ID
   ```
4. If issues persist, browser refresh triggers manual reconnection

#### Network Issues
1. KDS automatically detects and recovers from network interruptions
2. Check Railway logs for persistent connection errors
3. Verify `kds_tickets` table is being updated
4. Connection status indicator shows recovery progress

#### Sync Issues
1. Automatic backfill occurs on reconnection
2. Manual backfill if needed:
   ```bash
   POST /api/kds/backfill?scope=today
   ```
3. Check order status matches KDS display

### Production Reliability
- KDS is production-ready with robust error handling
- Automatic recovery from connection issues
- Visual feedback for connection status
- Comprehensive logging for troubleshooting

### Emergency Fallback
If KDS completely fails after multiple reconnection attempts:
- Use printed tickets as backup
- Kitchen staff check orders directly in dashboard
- Connection status will show "Connection Error" with manual refresh instruction
- Communicate with customers about delays
