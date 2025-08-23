# Troubleshooting Guide: "Something went wrong" Error

## Problem Description
When trying to refresh orders in the Servio application, you see a "Something went wrong" error message that persists even after clicking the refresh button.

## Root Cause
The most common cause of this error is **missing environment variables**, specifically the Supabase database configuration. The application requires these environment variables to connect to the database:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Solution Steps

### 1. Check Environment Variables
First, verify if the required environment variables are set:

```bash
# Check if Supabase environment variables exist
echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-'NOT SET'}"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:-'NOT SET'}"
```

### 2. Set Up Environment Variables

#### For Local Development:
1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```bash
   # Get these from your Supabase project dashboard → Settings → API
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

#### For Railway Deployment:
1. Go to your Railway project dashboard
2. Navigate to the Variables tab
3. Add the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Get Supabase Credentials
If you don't have Supabase credentials:

1. Go to [Supabase](https://supabase.com) and create a new project
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key
4. Add these to your environment variables

### 4. Restart the Application
After setting the environment variables:

```bash
# For local development
npm run dev

# For Railway, the deployment will automatically restart
```

### 5. Verify the Fix
1. Navigate to the dashboard
2. Try refreshing orders
3. The error should be resolved

## Additional Environment Variables

For full functionality, you may also need:

```bash
# Google Cloud Services (for menu upload/OCR)
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
GCS_BUCKET_NAME=your-gcs-bucket-name

# OpenAI API (for menu extraction)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Debug Information

If the issue persists, you can check the debug page at `/debug` to see:
- Environment variable status
- Service connection status
- Recent error logs

## Common Issues

### 1. Environment Variables Not Loading
- Ensure the `.env.local` file is in the project root
- Restart the development server after adding variables
- Check for typos in variable names

### 2. Supabase Connection Issues
- Verify the URL and key are correct
- Check if your Supabase project is active
- Ensure the database is accessible

### 3. Railway Deployment Issues
- Variables must be set in Railway dashboard
- Check Railway logs for deployment errors
- Ensure variables are properly formatted

## Getting Help

If you continue to experience issues:

1. Check the error logs at `/debug`
2. Verify your Supabase project is working
3. Ensure all environment variables are properly set
4. Check the application logs for specific error messages

## Prevention

To prevent this issue in the future:
- Always set up environment variables before running the application
- Use the `.env.local.example` file as a template
- Keep your Supabase credentials secure and up-to-date
- Regularly check the debug page for configuration issues