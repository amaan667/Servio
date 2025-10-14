# Servio Demo Mode Documentation

## Overview

Demo Mode provides a comprehensive, interactive preview of the Servio platform without requiring signup or real payment processing. It showcases both customer and owner experiences.

## Features

### 1. **Owner vs. Customer Toggle**
- Located at `/demo`
- Instantly switch between customer ordering experience and owner dashboard view
- No authentication required

### 2. **Customer View**
- Full menu browsing with categories and images
- Shopping cart with special instructions
- Simulated Stripe payment processing
- Order confirmation and tracking
- QR code simulation

### 3. **Owner View**
- **Demo Analytics Dashboard**: Realistic fake data showing:
  - Weekly revenue: £3,847.50
  - 278 orders this week
  - Top-selling items with charts
  - Hourly activity patterns
  - AI-powered insights

- **AI Assistant Demo**: Interactive preview showing:
  - Natural language menu management
  - Bulk price adjustments
  - Item renaming and labeling
  - Smart suggestions based on sales data

### 4. **Enhanced Payment Simulation**
- Clear messaging: "💡 Demo Mode Active — Payments are simulated • No real charges"
- Visual indicators throughout the checkout flow
- Realistic payment processing animation
- 95% success rate simulation

### 5. **Demo Data Reset**
Two methods for resetting demo data:

#### Automatic Reset (Cron)
- Runs every 3 hours via Vercel Cron
- Endpoint: `/api/cron/demo-reset`
- Requires authorization header with `CRON_SECRET`
- Deletes orders and sessions older than 3 hours

#### Manual Reset
- Endpoint: `/api/demo/reset`
- Deletes orders and sessions older than 1 hour
- Available via GET or POST

## Demo Venue Details

- **Venue ID**: `demo-cafe`
- **Venue Name**: Demo Café
- **Menu Items**: 25 pre-configured items across 5 categories
  - Coffee (5 items)
  - Cold Drinks (5 items)
  - Pastries (5 items)
  - Food (5 items)
  - Desserts (5 items)

## URL Structure

### Main Demo Page
```
/demo
```

### Direct Customer Flow
```
/order?venue=demo-cafe&table=1
```

### Demo Order with Simulation
```
/order?demo=1
```

## AI Demo Prompts

Pre-configured example prompts:
1. "Rename all Coffee items to include '12oz'"
2. "Increase brunch prices by 10%"
3. "Hide items with no orders this week"
4. "Add 'Vegan' label to plant-based items"
5. "Create a happy hour discount for Cold Drinks"

Each prompt shows realistic preview changes that demonstrate Servio's AI capabilities.

## Demo Analytics Data

### Statistics
- Weekly Orders: 278
- Weekly Revenue: £3,847.50
- Average Order Value: £13.84
- Top Seller: Flat White (£4.25, 89 orders)
- Peak Hour: 11:00 AM
- Completion Rate: 94.2%
- Active Tables: 8

### AI Insights
1. **Strong Performance**: Flat White sales up 23%
2. **Optimization Suggestion**: Avocado Toast pricing analysis
3. **Peak Time Insight**: Staffing recommendations for 11 AM
4. **Menu Recommendation**: Add more cold drinks for afternoon sales

## Cron Configuration

The demo reset cron is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/demo-reset",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

Schedule: Every 3 hours (at minute 0)

## Environment Variables

Required for cron authentication:
```
CRON_SECRET=your-secret-key-here
```

## Marketing Integration

The demo serves as the primary funnel entry point:

1. **Homepage Hero**: "View Demo" CTA
2. **Footer Link**: Direct link to `/demo`
3. **Error Fallback**: Stripe failures redirect to demo mode

## Technical Implementation

### Components
- `app/demo/page.tsx` - Main demo page with toggle
- `components/demo-analytics.tsx` - Fake analytics dashboard
- `components/demo-ai-section.tsx` - AI interaction preview
- `data/demoMenuItems.ts` - Demo menu data

### API Routes
- `/api/demo/reset` - Manual reset endpoint
- `/api/cron/demo-reset` - Automated reset cron job

### Demo Banners
- Checkout page: Purple gradient banner with payment messaging
- Order page: Purple gradient banner with simulation info

## Best Practices

1. **Keep Data Fresh**: Cron runs every 3 hours to prevent demo clutter
2. **Clear Messaging**: All demo pages show clear indicators
3. **No Real Charges**: Stripe test mode + simulation options
4. **Realistic Experience**: Fake data mirrors real-world scenarios
5. **Instant Access**: No signup required to try the platform

## Future Enhancements

Potential additions:
- Live chat simulation
- Reservation system demo
- Staff management preview
- Multi-venue management
- Customer feedback simulation
- Delivery integration preview

## Support

For issues or questions about demo mode:
- Check `/api/demo/reset` for manual resets
- Monitor cron logs for automatic cleanup
- Verify `CRON_SECRET` is set in environment variables