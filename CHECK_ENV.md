# How to Verify Railway Environment Variables

## The Issue
Having variables in `.env` locally does NOT mean Railway has them. Railway needs variables configured separately in its dashboard.

## Steps to Check Railway Variables

### 1. Go to Railway Dashboard
Open: https://railway.app

### 2. Select Your Project
- Find your `servio-mvp-cleaned` deployment
- Click on the service

### 3. Go to Variables Tab
Click the **"Variables"** tab

### 4. Verify These EXACT Variables Exist:
```
NEXT_PUBLIC_SUPABASE_URL = your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key-here
```

**CRITICAL:** They must have the `NEXT_PUBLIC_` prefix for browser access!

### 5. Check if Values Match Your Local `.env`
Compare Railway values with your local `.env` file values.

## How to Test in Browser

Once deployed, open your Railway app and in browser console, run:
```javascript
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

If it shows `undefined`, Railway doesn't have the variables configured!

## If Variables Are Missing in Railway

1. Click "+ New Variable" button
2. Add each variable one by one:
   - Variable name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: (paste your Supabase URL)
3. Save
4. **Railway will auto-redeploy** after adding variables

## Common Mistake
❌ Having `.env` file locally
❌ Thinking Railway automatically reads `.env`
✅ Variables must be manually added to Railway dashboard

The `.env` file is ONLY for local development!

