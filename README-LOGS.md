# Where to Find Logs

## Browser Console (Client-Side Logs)

1. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Safari**: Press `Cmd+Option+I` (Mac)

2. Go to the **Console** tab

3. Look for these log prefixes:
   - `[AI CLIENT]` - AI assistant client-side actions
   - `[TABLE CLIENT]` - Table creation client-side actions
   - `[TABLE HOOK]` - Table management hook API calls

## Railway Server Logs (Server-Side Logs)

### Option 1: Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Click on your **Servio** project
3. Click on the **Deployments** tab
4. Click on the latest deployment
5. Click **View Logs** or scroll down to see live logs

### Option 2: Railway CLI

```bash
# Install Railway CLI if you haven't
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs

# Or view logs for specific service
railway logs --service servio-production
```

### Option 3: Railway Dashboard Direct Link

1. Go to: https://railway.app/project/[YOUR_PROJECT_ID]/deployments
2. Click on latest deployment
3. View logs in real-time

## What Logs to Look For

### When AI Assistant is Clicked:

**Browser Console:**
```
[AI CLIENT] 🎯 Send message clicked: {...}
[AI CLIENT] 📤 Sending request: {...}
[AI CLIENT] 📥 Response received: {...}
```

**Railway Logs:**
```
[MIDDLEWARE] API route: /api/ai/simple-chat {...}
[MIDDLEWARE] ✅ Set headers: {...}
[AUTH] getAuthUserFromRequest: {...}
[AUTH] ✅ Using middleware header (auth already verified)
[WITH_UNIFIED_AUTH] Route called: {...}
[WITH_UNIFIED_AUTH] ✅ Auth successful: {...}
[AI SIMPLE CHAT] 🚀 Handler called: {...}
```

### When Table is Created:

**Browser Console:**
```
[TABLE CLIENT] 🎯 Create table clicked: {...}
[TABLE CLIENT] 📤 Calling createTable: {...}
[TABLE HOOK] 🎯 createTable called: {...}
[TABLE HOOK] 📤 POST /api/tables: {...}
[TABLE HOOK] 📥 Response: {...}
```

**Railway Logs:**
```
[MIDDLEWARE] API route: /api/tables {...}
[MIDDLEWARE] ✅ Set headers: {...}
[AUTH] getAuthUserFromRequest: {...}
[WITH_UNIFIED_AUTH] Route called: {...}
[WITH_UNIFIED_AUTH] ✅ Auth successful: {...}
[TABLES POST] 🚀 Create table handler called: {...}
```

## Troubleshooting

If you see `[MIDDLEWARE] ❌ No session - headers NOT set`, it means:
- Cookies aren't being sent
- Session expired
- User not authenticated

If you see `[AUTH] ❌ No middleware header found`, it means:
- Middleware didn't set the header (check middleware logs)
- Request bypassed middleware somehow

If you see `[WITH_UNIFIED_AUTH] ❌ Auth failed`, check:
- What status code? (401 = auth, 403 = venue access, 400 = missing venueId)
- What's the error message?

## Note About CSS Warning

The CSS MIME type warning is **harmless** - it's just a browser console warning about how Next.js preloads CSS. It doesn't affect functionality.

