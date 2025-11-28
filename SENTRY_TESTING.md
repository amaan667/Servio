# Testing Sentry Error Tracking

## Setup

Sentry is already configured in your codebase. To test it:

### 1. Get Your Sentry DSN

1. Go to [sentry.io](https://sentry.io) and sign in
2. Create a new project (or use existing) for "Next.js"
3. Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

### 2. Set Environment Variable

Add to your `.env.local` or Railway environment variables:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

### 3. Test Error Tracking

#### Method 1: Test Error Button (Recommended)

Create a test route or add to an existing page:

```typescript
// app/test-sentry/page.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function TestSentryPage() {
  const testError = () => {
    try {
      throw new Error("Test error from Servio platform");
    } catch (error) {
      Sentry.captureException(error);
      alert("Error sent to Sentry! Check your Sentry dashboard.");
    }
  };

  const testMessage = () => {
    Sentry.captureMessage("Test message from Servio", "info");
    alert("Message sent to Sentry!");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Testing</h1>
      <div className="space-y-4">
        <Button onClick={testError}>Test Error Capture</Button>
        <Button onClick={testMessage}>Test Message Capture</Button>
      </div>
    </div>
  );
}
```

#### Method 2: Trigger Real Error

1. Navigate to a page that doesn't exist: `/this-page-does-not-exist`
2. Check Sentry dashboard for the 404 error

#### Method 3: API Route Error

```typescript
// app/api/test-sentry/route.ts
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    throw new Error("Test API error");
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Test error sent to Sentry" }, { status: 500 });
  }
}
```

### 4. Verify in Sentry Dashboard

1. Go to your Sentry project dashboard
2. Navigate to "Issues" tab
3. You should see the test errors appear within seconds
4. Click on an error to see:
   - Stack trace
   - User context (if authenticated)
   - Request details
   - Browser/device info

### 5. Test Production

For production testing:

1. Deploy to Railway with `NEXT_PUBLIC_SENTRY_DSN` set
2. Trigger an error in production
3. Check Sentry dashboard (errors appear in real-time)

### 6. Test Error Context

Sentry automatically captures:
- User ID (if authenticated)
- Venue ID (if in dashboard)
- Request URL
- Browser/device info
- Stack traces

### 7. Monitor Real Errors

After launch, monitor:
- **Issues** tab: All errors grouped by type
- **Performance** tab: Slow API routes
- **Releases** tab: Errors by deployment version

### Quick Test Command

```bash
# In browser console on any page:
Sentry.captureException(new Error("Manual test error"));
```

### Troubleshooting

- **No errors appearing?** Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
- **Development mode?** Sentry has `debug: true` in development - check browser console
- **Production?** Errors are filtered (ResizeObserver errors are ignored)

