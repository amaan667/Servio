# Railway Sentry Setup

## Add Sentry Auth Token to Railway

### Via Railway Dashboard (Recommended)

1. Go to https://railway.app
2. Select your **Servio** project
3. Click on **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Name**: `SENTRY_AUTH_TOKEN`
   - **Value**: `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`
6. Click **Add**

### Via Railway CLI

```bash
railway variables set SENTRY_AUTH_TOKEN=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
```

## Important Notes

⚠️ **DO NOT commit this token to git!**

- The token is already in `.gitignore` (`.env.sentry-build-plugin`)
- Only add it as a Railway environment variable
- This token is used during build to upload source maps to Sentry

## Verify Setup

After adding the variable, trigger a new deployment:

```bash
railway up
```

The build should now upload source maps to Sentry automatically.

