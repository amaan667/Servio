# 🚀 Complete Stripe Setup Guide for Modern SaaS Platform

This comprehensive guide will walk you through setting up Stripe for your Servio MVP application, following modern SaaS best practices.

## 📋 Table of Contents

1. [Stripe Account Setup](#stripe-account-setup)
2. [Environment Variables](#environment-variables)
3. [Webhook Configuration](#webhook-configuration)
4. [Testing Setup](#testing-setup)
5. [Production Deployment](#production-deployment)
6. [Security Best Practices](#security-best-practices)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ Stripe Account Setup

### 1. Create Stripe Account

1. **Go to [stripe.com](https://stripe.com)** and click "Start now"
2. **Choose your business type**: Select "SaaS" or "Marketplace"
3. **Complete business verification**:
   - Business name: "Your Company Name"
   - Business type: "Corporation" or "LLC"
   - Industry: "Software as a Service"
   - Website: Your domain
   - Business address and tax ID

### 2. Dashboard Configuration

1. **Navigate to Dashboard Settings**:
   - Go to [Dashboard → Settings → Business settings](https://dashboard.stripe.com/settings/business)
   - Complete all required business information
   - Upload business logo and branding

2. **Configure Branding**:
   - Go to [Dashboard → Settings → Branding](https://dashboard.stripe.com/settings/branding)
   - Upload your logo (recommended: 128x128px PNG)
   - Set primary color to match your brand
   - Configure checkout appearance

3. **Set Up Tax Settings**:
   - Go to [Dashboard → Settings → Tax](https://dashboard.stripe.com/settings/tax)
   - Enable automatic tax calculation
   - Configure tax rates for your regions

---

## 🔐 Environment Variables

### 1. Get Your API Keys

1. **Navigate to API Keys**:
   - Go to [Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)

2. **Copy Your Keys**:
   ```bash
   # Test Mode Keys (for development)
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   
   # Live Mode Keys (for production)
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

### 2. Configure Environment Files

**Create/Update `.env.local`**:
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**For Production (Railway/Vercel/etc.)**:
```bash
# Stripe Live Keys
STRIPE_SECRET_KEY=sk_live_51...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Production URLs
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### 3. Environment Variable Security

**✅ DO:**
- Use different keys for test/live environments
- Store keys in secure environment variable systems
- Use `.env.local` for local development (gitignored)
- Rotate keys regularly

**❌ DON'T:**
- Commit API keys to version control
- Use live keys in development
- Share keys in plain text
- Use the same keys across multiple projects

---

## 🔗 Webhook Configuration

### 1. Create Webhook Endpoint

1. **Go to Webhooks**:
   - Navigate to [Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)

2. **Add Endpoint**:
   - Click "Add endpoint"
   - Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
   - Description: "Servio MVP Payment Webhooks"

3. **Select Events**:
   ```
   payment_intent.succeeded
   payment_intent.payment_failed
   payment_intent.canceled
   payment_method.attached
   customer.created
   customer.updated
   ```

### 2. Webhook Implementation

**Create `app/api/webhooks/stripe/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);
  // Update order status in your database
  // Send confirmation email
  // Update inventory
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  // Handle failed payment
  // Send failure notification
  // Update order status
}
```

### 3. Test Webhooks Locally

**Install Stripe CLI**:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget -qO- https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz | tar -xz
sudo mv stripe /usr/local/bin
```

**Login and Forward Events**:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 🧪 Testing Setup

### 1. Test Card Numbers

**Successful Payments**:
```
4242 4242 4242 4242 - Visa
4000 0566 5566 5556 - Visa (debit)
5555 5555 5555 4444 - Mastercard
2223 0031 2200 3222 - Mastercard (2-series)
3782 822463 10005 - American Express
```

**Declined Payments**:
```
4000 0000 0000 0002 - Card declined
4000 0000 0000 9995 - Insufficient funds
4000 0000 0000 9987 - Lost card
4000 0000 0000 9979 - Stolen card
```

**3D Secure Authentication**:
```
4000 0025 0000 3155 - Requires authentication
4000 0000 0000 3220 - Authentication fails
```

### 2. Test Scenarios

**Create Test Script** (`scripts/test-stripe.js`):
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testPaymentFlow() {
  try {
    // Test 1: Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000, // £20.00
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: {
        test: 'true',
        order_id: 'test-order-123'
      }
    });
    
    console.log('✅ Payment Intent created:', paymentIntent.id);
    
    // Test 2: Confirm Payment (simulate)
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: 'pm_card_visa'
    });
    
    console.log('✅ Payment confirmed:', confirmed.status);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPaymentFlow();
```

### 3. Automated Testing

**Jest Test Example**:
```javascript
// __tests__/stripe.test.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

describe('Stripe Integration', () => {
  test('creates payment intent successfully', async () => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true }
    });
    
    expect(paymentIntent.id).toMatch(/^pi_/);
    expect(paymentIntent.amount).toBe(2000);
    expect(paymentIntent.currency).toBe('gbp');
  });
  
  test('handles declined payment', async () => {
    await expect(
      stripe.paymentIntents.confirm('pi_test', {
        payment_method: 'pm_card_chargeDeclined'
      })
    ).rejects.toThrow();
  });
});
```

---

## 🚀 Production Deployment

### 1. Railway Deployment

**Update `railway.toml`**:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"

[env]
NODE_ENV = "production"
```

**Set Environment Variables in Railway**:
```bash
# In Railway Dashboard → Variables
STRIPE_SECRET_KEY=sk_live_51...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
```

### 2. Domain Configuration

**Update Webhook URL**:
1. Go to [Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Edit your webhook endpoint
3. Update URL to: `https://your-domain.com/api/webhooks/stripe`

**SSL Certificate**:
- Ensure your domain has valid SSL certificate
- Stripe requires HTTPS for webhooks
- Use Let's Encrypt or your hosting provider's SSL

### 3. Go Live Checklist

**✅ Pre-Launch**:
- [ ] Test all payment flows in test mode
- [ ] Verify webhook endpoints work
- [ ] Test error handling scenarios
- [ ] Review security configurations
- [ ] Set up monitoring and alerts

**✅ Launch Day**:
- [ ] Switch to live API keys
- [ ] Update webhook URLs to production
- [ ] Test with small real transaction
- [ ] Monitor logs for errors
- [ ] Verify webhook deliveries

---

## 🔒 Security Best Practices

### 1. API Key Security

**Server-Side Only**:
```typescript
// ✅ DO: Use server-side only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ❌ DON'T: Expose secret keys to client
const stripe = new Stripe('sk_live_...'); // Never do this!
```

**Environment Variables**:
```bash
# ✅ DO: Use environment variables
STRIPE_SECRET_KEY=sk_live_...

# ❌ DON'T: Hardcode in source code
const secretKey = 'sk_live_...';
```

### 2. Webhook Security

**Signature Verification**:
```typescript
// Always verify webhook signatures
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
);
```

**Idempotency**:
```typescript
// Use idempotency keys for critical operations
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'gbp'
}, {
  idempotencyKey: `order-${orderId}-${timestamp}`
});
```

### 3. PCI Compliance

**✅ DO:**
- Use Stripe Elements for card input
- Never store card details
- Use HTTPS everywhere
- Implement proper error handling
- Log security events

**❌ DON'T:**
- Store card numbers in your database
- Log sensitive payment data
- Use HTTP for payment flows
- Ignore security warnings

---

## 📊 Monitoring & Analytics

### 1. Stripe Dashboard

**Key Metrics to Monitor**:
- Payment success rate
- Failed payment reasons
- Average transaction value
- Customer lifetime value
- Chargeback rate

**Set Up Alerts**:
1. Go to [Dashboard → Settings → Notifications](https://dashboard.stripe.com/settings/notifications)
2. Configure alerts for:
   - Failed payments
   - Chargebacks
   - High-value transactions
   - Webhook failures

### 2. Application Monitoring

**Log Important Events**:
```typescript
// Log payment events
console.log('Payment started:', {
  orderId,
  amount,
  customerId,
  timestamp: new Date().toISOString()
});

console.log('Payment succeeded:', {
  paymentIntentId,
  orderId,
  amount,
  timestamp: new Date().toISOString()
});
```

**Error Tracking**:
```typescript
// Track payment errors
try {
  await stripe.paymentIntents.create({...});
} catch (error) {
  console.error('Payment creation failed:', {
    error: error.message,
    orderId,
    timestamp: new Date().toISOString()
  });
  // Send to error tracking service (Sentry, etc.)
}
```

### 3. Business Intelligence

**Stripe Sigma (Advanced Analytics)**:
- Set up custom reports
- Track customer behavior
- Analyze payment patterns
- Monitor fraud indicators

---

## 🛠️ Troubleshooting

### Common Issues

**1. "Invalid API Key" Error**:
```bash
# Check your environment variables
echo $STRIPE_SECRET_KEY
# Should start with sk_test_ or sk_live_

# Verify in your app
console.log(process.env.STRIPE_SECRET_KEY?.substring(0, 7));
```

**2. Webhook Not Receiving Events**:
```bash
# Check webhook URL is accessible
curl -X POST https://your-domain.com/api/webhooks/stripe

# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET
# Should start with whsec_
```

**3. Payment Intent Creation Fails**:
```typescript
// Check amount is in smallest currency unit
const amount = Math.round(price * 100); // Convert £20.00 to 2000 pence

// Verify currency code
const currency = 'gbp'; // Use lowercase
```

**4. 3D Secure Issues**:
```typescript
// Handle 3D Secure authentication
const { error, paymentIntent } = await stripe.confirmCardPayment(
  clientSecret,
  {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: customerName,
      },
    },
  }
);

if (error) {
  // Handle authentication error
  console.error('Payment failed:', error.message);
} else if (paymentIntent.status === 'succeeded') {
  // Payment succeeded
  console.log('Payment completed successfully');
}
```

### Debug Mode

**Enable Stripe Debug Logging**:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
  // Enable debug logging in development
  ...(process.env.NODE_ENV === 'development' && {
    logger: {
      level: 'debug',
      log: (level, message) => console.log(`[Stripe ${level}]`, message)
    }
  })
});
```

### Support Resources

**Stripe Documentation**:
- [Stripe API Reference](https://stripe.com/docs/api)
- [Payment Intents Guide](https://stripe.com/docs/payments/payment-intents)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing Guide](https://stripe.com/docs/testing)

**Community Support**:
- [Stripe Community Forum](https://support.stripe.com/questions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/stripe-payments)
- [GitHub Issues](https://github.com/stripe/stripe-node/issues)

---

## 🎯 Next Steps

### Immediate Actions

1. **Set up your Stripe account** following this guide
2. **Configure environment variables** for your development environment
3. **Test the payment flow** using test card numbers
4. **Set up webhooks** for production monitoring

### Advanced Features

1. **Subscription Management**: For recurring payments
2. **Multi-party Payments**: For marketplace scenarios
3. **International Payments**: Support for multiple currencies
4. **Fraud Prevention**: Radar for fraud detection
5. **Customer Portal**: Self-service customer management

### Performance Optimization

1. **Payment Method Optimization**: Store customer payment methods
2. **Caching**: Cache payment intents for better UX
3. **Error Recovery**: Implement retry logic for failed payments
4. **Analytics**: Track conversion rates and optimize checkout flow

---

## 📞 Support

If you encounter any issues with this setup:

1. **Check the troubleshooting section** above
2. **Review Stripe's official documentation**
3. **Test with Stripe's test cards** first
4. **Contact Stripe support** for account-specific issues

**Remember**: Always test thoroughly in test mode before going live with real payments!

---

*This guide is designed for modern SaaS platforms and follows Stripe's latest best practices. Keep it updated as Stripe releases new features and recommendations.*
