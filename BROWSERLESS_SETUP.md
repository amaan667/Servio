# Browserless.io Setup Guide

## Step-by-Step Setup:

### **Step 1: Sign Up for Browserless.io**

1. Go to https://www.browserless.io/
2. Click "Start Free Trial" or "Sign Up"
3. Create account with your email
4. Verify your email

### **Step 2: Get Your API Key**

1. Log in to Browserless dashboard
2. Go to "API Keys" or "Settings"
3. Copy your API key (looks like: `browserless_abc123xyz...`)
4. Save it securely

### **Step 3: Add to Railway Environment Variables**

1. Go to Railway dashboard: https://railway.app/
2. Select your project: "servio-production"
3. Click on your service
4. Go to "Variables" tab
5. Click "+ New Variable"
6. Add:
   ```
   Name: BROWSERLESS_API_KEY
   Value: your_api_key_here
   ```
7. Click "Add"
8. Railway will automatically redeploy

### **Step 4: Test the Menu URL Feature**

1. Go to Menu Management in Servio
2. Enter menu URL: `https://nurcafe.co.uk/menu`
3. Click "Process"
4. Watch it work! ✨

---

## Pricing:

**Free Tier**:
- 1,000 requests/month free
- Perfect for testing

**Paid Plans**:
- $0.005 per request after free tier
- 100 menu updates = $0.50
- Very affordable

---

## How It Works:

```
User enters URL → Scraper detects JS site
  ↓
Calls Browserless.io with URL
  ↓
Browserless launches Chrome browser
  ↓
Waits for JavaScript to load (5 seconds)
  ↓
Returns fully-rendered HTML
  ↓
Cheerio extracts text + images
  ↓
GPT-4 extracts menu items
  ↓
Returns structured data
```

---

## Code Already Implemented:

✅ Detects JS-rendered sites
✅ Calls Browserless.io API
✅ Waits for content to load
✅ Extracts from rendered HTML
✅ Falls back to static HTML for non-JS sites

**Just add the API key and it works!**

---

## Alternative - Use Apify (If Browserless doesn't work):

Similar setup, different service:
1. Sign up: https://apify.com/
2. Get API token
3. Add: `APIFY_API_TOKEN=your_token`
4. Free tier: 500 requests/month

Both services work great for JavaScript-rendered sites!

