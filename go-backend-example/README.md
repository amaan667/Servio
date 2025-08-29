# OAuth JSON Structure Fix - Go Backend

This Go backend demonstrates the correct JSON structure to handle OAuth callbacks from the frontend, fixing the "cannot unmarshal object into Go struct field PKCEGrantParams.auth_code of type string" error.

## Problem

The frontend was sending a flat JSON structure:
```json
{
  "code": "AUTH_CODE_FROM_GOOGLE",
  "verifier": "PKCE_VERIFIER_STRING"
}
```

But the Go backend was expecting a nested structure:
```json
{
  "auth_code": {
    "code": "AUTH_CODE_FROM_GOOGLE"
  },
  "verifier": "PKCE_VERIFIER_STRING"
}
```

## Solution

### 1. Updated Go Backend Struct

The Go backend now uses a flat structure that matches the frontend:

```go
type PKCEGrantParams struct {
    Code     string `json:"code"`
    Verifier string `json:"verifier"`
}
```

### 2. Comprehensive Logging

Added detailed logging to track the OAuth flow:

```go
log.Printf("[AUTH LOG] received_code=%s, received_verifier=%s", params.Code, params.Verifier)

if params.Code == "" {
    log.Printf("[AUTH LOG] missing_code")
    return http.Error(w, "missing_code", http.StatusBadRequest)
}
```

### 3. Frontend Logging (Already Correct)

The frontend already has proper logging:
```javascript
const payload = { code: authCode, verifier };
console.log('[OAuth Frontend] Sending payload:', payload);
```

## Expected Flow

1. **Frontend logs**: `[OAuth Frontend] Sending payload: { code: "...", verifier: "..." }`
2. **Go backend logs**: `[AUTH LOG] received_code=..., received_verifier=...`
3. **If code is missing**: `[AUTH LOG] missing_code`

## Setup Instructions

### 1. Environment Variables

Set these environment variables:
```bash
export GOOGLE_OAUTH_CLIENT_ID="your-google-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-google-client-secret"
export GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/auth/callback"
```

### 2. Run the Go Backend

```bash
cd go-backend-example
go mod tidy
go run .
```

The server will start on port 8080 and be ready to receive OAuth callbacks.

### 3. Test the Endpoint

You can test the endpoint with curl:

```bash
curl -X POST http://localhost:8080/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"code":"test_auth_code","verifier":"test_verifier"}'
```

## Files

- `main.go` - Main server entry point
- `oauth_handler.go` - OAuth callback handler with Google token exchange
- `go.mod` - Go module dependencies
- `README.md` - This documentation

## Dependencies

- `golang.org/x/oauth2` - For OAuth 2.0 functionality
- `github.com/golang-jwt/jwt/v5` - For JWT token handling

## Error Resolution

This fix eliminates the JSON parsing error by ensuring the Go backend struct matches the flat JSON structure being sent by the frontend. The comprehensive logging provides clear visibility into the OAuth flow from Google → Frontend → Go Backend.