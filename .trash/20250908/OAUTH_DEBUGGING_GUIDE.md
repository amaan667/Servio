# OAuth Debugging Guide

This guide documents the debugging improvements implemented for Google OAuth authentication to help troubleshoot common issues.

## Quick Checks Implemented

### 1. Type Validation
- **authCode validation**: Ensures the authorization code is a string (not an array)
- **codeVerifier validation**: Ensures the PKCE verifier is a string with proper length
- **Array handling**: Normalizes array-like values to strings using `Array.isArray() ? value[0] : value`

### 2. Debugging Logs
The following logs have been added to help troubleshoot OAuth issues:

```javascript
// Frontend (lib/auth/signin.ts)
console.log("authCode typeof/value:", typeof authCode, authCode?.slice(0, 12), "...");
console.log("codeVerifier typeof/len:", typeof verifier, verifier?.length);

// Backend (app/api/auth/google/callback/route.ts)
console.log("authCode typeof/value:", typeof code, code?.slice(0, 12), "...");
console.log("codeVerifier typeof/len:", typeof verifier, verifier?.length);
```

### 3. Enhanced Error Handling
- **Type checking**: Validates both code and verifier are strings before processing
- **Detailed error messages**: Provides specific error types for debugging
- **Sanitized logging**: Masks sensitive values in logs while preserving debugging info

## Common Issues and Solutions

### 1. Missing or Invalid Code
**Symptoms**: `Missing or invalid code` error
**Causes**:
- Code parameter not present in callback URL
- Code is an array instead of string (common in some frameworks)
- Code has expired or been used already

**Debugging**:
```javascript
// Check the logs for:
console.log("authCode typeof/value:", typeof authCode, authCode?.slice(0, 12), "...");
```

### 2. Missing PKCE Verifier
**Symptoms**: `Missing PKCE verifier in session` error
**Causes**:
- Session storage not configured properly
- Verifier lost during redirect
- Using in-memory session store in production

**Debugging**:
```javascript
// Check the logs for:
console.log("codeVerifier typeof/len:", typeof codeVerifier, codeVerifier?.length);
```

**Solutions**:
- Use Redis or database session store in production
- Ensure session middleware is configured correctly
- Verify PKCE flow is properly initialized

### 3. Invalid Grant Error
**Symptoms**: `invalid_grant` from Google OAuth
**Causes**:
- Code verifier mismatch
- Code already exchanged
- Clock skew between server and Google
- Expired authorization code

**Debugging**:
- Check that verifier matches exactly what was generated
- Verify code hasn't been used before
- Ensure server clock is synchronized with NTP

### 4. Environment Configuration
**Required Environment Variables**:
```bash
# For Supabase approach
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# For custom Google OAuth approach
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
GOOGLE_OAUTH_REDIRECT_URI=your_redirect_uri
```

## Implementation Options

### Option 1: Custom Google OAuth (Current)
- Uses direct Google OAuth endpoints
- More control over the flow
- Requires manual PKCE implementation
- File: `app/api/auth/google/callback/route.ts`

### Option 2: Supabase OAuth (Alternative)
- Uses Supabase's `exchangeCodeForSession`
- Simpler implementation
- Built-in PKCE handling
- File: `lib/auth/supabase-callback.ts`

## Best Practices

### 1. Session Storage
```javascript
// Use a persistent session store in production
// Avoid in-memory stores that lose data on server restart
const sessionStore = new RedisStore({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});
```

### 2. PKCE Flow
```javascript
// Always generate and store verifier before redirect
const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);
storePkceVerifier(verifier); // Store in session
```

### 3. Error Handling
```javascript
// Always validate types and presence
if (!authCode || typeof authCode !== "string") {
  return res.status(400).json({ error: "Missing or invalid code" });
}
```

### 4. Security
- Never log full authorization codes or tokens
- Use masked logging for sensitive values
- Implement proper session management
- Use HTTPS in production

## Testing

### 1. Local Development
```bash
# Start with clean session storage
npm run dev
# Clear browser storage
# Test OAuth flow
```

### 2. Production Debugging
```bash
# Check server logs for debugging output
# Monitor session storage
# Verify environment variables
```

## Troubleshooting Checklist

- [ ] Environment variables are set correctly
- [ ] Session storage is configured and persistent
- [ ] PKCE verifier is generated and stored before redirect
- [ ] Authorization code is received as string
- [ ] Server clock is synchronized
- [ ] Redirect URI matches exactly
- [ ] Client ID and secret are correct
- [ ] HTTPS is used in production
- [ ] Debug logs show expected values

## Files Modified

1. `app/api/auth/google/callback/route.ts` - Added debugging logs and type validation
2. `lib/auth/signin.ts` - Added debugging logs and type validation
3. `lib/auth/supabase-callback.ts` - Created alternative Supabase implementation
4. `OAUTH_DEBUGGING_GUIDE.md` - This documentation file