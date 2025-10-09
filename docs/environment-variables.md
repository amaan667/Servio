# Environment Variables Documentation

This document outlines all required and optional environment variables for the Servio MVP venue ordering system.

## Required Environment Variables

### Database Configuration (Supabase)

```bash
# Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous Key (Public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**How to get these:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key

### Google Cloud Services

```bash
# Base64 encoded Google Service Account JSON
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json

# Google Cloud Storage Bucket Name
GCS_BUCKET_NAME=your-gcs-bucket-name
```

**How to set up Google Cloud:**
1. Create a Google Cloud project
2. Enable Cloud Vision API and Cloud Storage API
3. Create a service account with Vision and Storage permissions
4. Download the JSON key file
5. Base64 encode the JSON: `base64 -i service-account.json`
6. Create a GCS bucket for OCR processing

### OpenAI API

```bash
# OpenAI API Key for GPT-4o menu extraction
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**How to get this:**
1. Sign up at https://openai.com
2. Navigate to API Keys section
3. Create a new API key

## Optional Environment Variables

### Payment Processing (Stripe) - REQUIRED FOR NEW SIGNUPS

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Subscription Price IDs (REQUIRED)
STRIPE_BASIC_PRICE_ID=price_basic_id_from_stripe
STRIPE_STANDARD_PRICE_ID=price_standard_id_from_stripe
STRIPE_PREMIUM_PRICE_ID=price_premium_id_from_stripe
```

**How to set up Stripe subscriptions:**

1. **Sign up at https://stripe.com**

2. **Create Products** in Stripe Dashboard → Products:
   - **Basic Plan**: £99/month
   - **Standard Plan**: £249/month (mark as "Most Popular")
   - **Premium Plan**: £449/month
   
3. **Add Recurring Prices** to each product:
   - Select "Recurring" billing
   - Set to "Monthly"
   - Enter price in GBP (£)
   - Copy the Price ID (starts with `price_`)

4. **Enable Free Trials**:
   - In each price, set trial period to **14 days**

5. **Get API Keys**:
   - Navigate to Developers → API Keys
   - Copy Publishable key (starts with `pk_test_`)
   - Copy Secret key (starts with `sk_test_`)

6. **Set Up Webhooks**:
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhooks`
   - Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy Webhook Secret (starts with `whsec_`)

### Google Maps & Places (Settings Page Enhancement)

```bash
# Google Maps JavaScript API with Places Library
# Used for address autocomplete in venue settings
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**How to set up Google Maps API:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable "Maps JavaScript API" and "Places API"
4. Create credentials (API key)
5. Restrict the API key to your domain for security
6. Add key domains under "Application restrictions"

**Note:** The address input will work without this API key by falling back to:
- Manual address entry
- OpenStreetMap for geocoding (free, no key required)
- Map preview using OpenStreetMap embed

## Railway Deployment Configuration

For Railway deployment, add these environment variables in your Railway project settings:

### Required Variables for Railway

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Cloud
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
GCS_BUCKET_NAME=your-gcs-bucket-name

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Stripe (REQUIRED for new signups)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Railway-Specific Notes

1. **Google Credentials**: The `GOOGLE_CREDENTIALS_B64` should be the entire service account JSON file encoded in base64
2. **Bucket Name**: Use a simple bucket name without special characters
3. **API Keys**: Ensure all API keys have appropriate permissions and quotas

## Local Development Setup

### .env.local File

Create a `.env.local` file in your project root:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Cloud
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
GCS_BUCKET_NAME=your-gcs-bucket-name

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Stripe (Sandbox)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Google Maps (Optional - for enhanced address input)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Local Development Notes

1. **Google Cloud**: For local development, you can use a service account key file instead of base64 encoding
2. **Supabase**: Use your development project URL and keys
3. **OpenAI**: Use your development API key with appropriate rate limits

## Environment Variable Validation

The application includes validation for required environment variables:

### Database Validation
```javascript
// Check if Supabase is configured
const hasSupabaseConfig = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

### Google Cloud Validation
```javascript
// Check if Google credentials are available
if (process.env.GOOGLE_CREDENTIALS_B64) {
  // Decode and set up credentials
}
```

### OpenAI Validation
```javascript
// Check if OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment-specific keys** (development vs production)
3. **Rotate API keys** regularly
4. **Monitor API usage** to prevent unexpected charges
5. **Use least privilege** for service account permissions

## Troubleshooting

### Common Issues

1. **"Cannot find type definition file"**: Install missing `@types` packages
2. **"Google credentials not found"**: Ensure `GOOGLE_CREDENTIALS_B64` is properly base64 encoded
3. **"Supabase connection failed"**: Verify URL and anon key are correct
4. **"OpenAI API error"**: Check API key and billing status

### Debug Commands

```bash
# Check if environment variables are loaded
node -e "console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET')"

# Test Google credentials
node -e "console.log('GOOGLE_CREDENTIALS:', process.env.GOOGLE_CREDENTIALS_B64 ? 'SET' : 'NOT SET')"

# Test OpenAI key
node -e "console.log('OPENAI_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')"
```

## API Rate Limits and Costs

### OpenAI GPT-4o
- **Rate Limit**: 500 requests per minute
- **Cost**: ~$0.01 per 1K tokens
- **Recommendation**: Monitor usage in OpenAI dashboard

### Google Cloud Vision
- **Rate Limit**: 1000 requests per minute
- **Cost**: $1.50 per 1000 images
- **Recommendation**: Enable billing alerts

### Supabase
- **Rate Limit**: Based on your plan
- **Cost**: Free tier available
- **Recommendation**: Monitor usage in Supabase dashboard

## Future Enhancements

### Additional Environment Variables

```bash
# Email Service (for order notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Service (for order notifications)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Error Monitoring
SENTRY_DSN=https://your-sentry-dsn
```

This comprehensive environment setup ensures the Servio MVP can handle menu uploads, OCR processing, and customer ordering with proper security and scalability. 