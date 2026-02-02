# WebAuthn for Passwordless Authentication

This document describes the implementation of WebAuthn for passwordless authentication on the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Best Practices](#best-practices)

## Overview

WebAuthn (Web Authentication) is a web standard published by the W3C that enables passwordless authentication using public-key cryptography. It allows users to authenticate using:

- **Biometrics:** Fingerprint, Face ID
- **Hardware keys:** YubiKey, Security Key
- **Platform authenticators:** Windows Hello, Touch ID

## Features

### Registration Flow

```typescript
// lib/auth/webauthn.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { supabase } from '@/lib/supabase';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const rpName = 'Servio';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

export async function registerCredentialStart(userId: string, username: string) {
  // Get existing credentials for user
  const { data: existingCredentials } = await supabase
    .from('webauthn_credentials')
    .select('id')
    .eq('userId', userId);

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName: username,
    // Don't prompt users for additional information about the authenticator
    attestationType: 'none',
    // Prevent users from re-registering existing credentials
    excludeCredentials: existingCredentials?.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })) || [],
    // Support both platform and cross-platform authenticators
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
    },
  });

  // Save challenge to database
  await supabase.from('webauthn_challenges').insert({
    userId,
    challenge: options.challenge,
    type: 'registration',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  return options;
}

export async function registerCredentialFinish(
  userId: string,
  response: any
) {
  // Get challenge from database
  const { data: challengeData } = await supabase
    .from('webauthn_challenges')
    .select('challenge')
    .eq('userId', userId)
    .eq('type', 'registration')
    .gt('expiresAt', new Date())
    .single();

  if (!challengeData) {
    throw new Error('Invalid or expired challenge');
  }

  // Verify registration response
  const verification = verifyRegistrationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified) {
    throw new Error('Registration verification failed');
  }

  // Save credential to database
  const { registrationInfo } = verification;

  await supabase.from('webauthn_credentials').insert({
    userId,
    credentialID: registrationInfo!.credentialID,
    publicKey: registrationInfo!.credentialPublicKey,
    counter: registrationInfo!.counter,
    transports: registrationInfo!.transports,
    deviceType: registrationInfo!.deviceType,
    backedUp: registrationInfo!.backedUp,
  });

  // Delete challenge
  await supabase
    .from('webauthn_challenges')
    .delete()
    .eq('userId', userId)
    .eq('type', 'registration');

  return verification;
}
```

### Authentication Flow

```typescript
// lib/auth/webauthn.ts (continued)

export async function authenticateCredentialStart(userId: string) {
  // Get user's credentials
  const { data: credentials } = await supabase
    .from('webauthn_credentials')
    .select('credentialID, transports')
    .eq('userId', userId);

  if (!credentials || credentials.length === 0) {
    throw new Error('No credentials found for user');
  }

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: credentials.map(cred => ({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports as any[],
    })),
  });

  // Save challenge to database
  await supabase.from('webauthn_challenges').insert({
    userId,
    challenge: options.challenge,
    type: 'authentication',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  return options;
}

export async function authenticateCredentialFinish(
  userId: string,
  response: any
) {
  // Get challenge from database
  const { data: challengeData } = await supabase
    .from('webauthn_challenges')
    .select('challenge')
    .eq('userId', userId)
    .eq('type', 'authentication')
    .gt('expiresAt', new Date())
    .single();

  if (!challengeData) {
    throw new Error('Invalid or expired challenge');
  }

  // Get user's credentials
  const { data: credentials } = await supabase
    .from('webauthn_credentials')
    .select('*')
    .eq('userId', userId);

  if (!credentials || credentials.length === 0) {
    throw new Error('No credentials found for user');
  }

  // Find the credential that was used
  const credential = credentials.find(
    cred => cred.credentialID === response.id
  );

  if (!credential) {
    throw new Error('Credential not found');
  }

  // Verify authentication response
  const verification = verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: credential.credentialID,
      credentialPublicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports as any[],
    },
  });

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  // Update counter
  await supabase
    .from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq('id', credential.id);

  // Delete challenge
  await supabase
    .from('webauthn_challenges')
    .delete()
    .eq('userId', userId)
    .eq('type', 'authentication');

  return verification;
}
```

## Database Schema

```sql
-- Create webauthn_credentials table
CREATE TABLE webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credentialID TEXT NOT NULL UNIQUE,
  publicKey TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  transports TEXT[],
  deviceType TEXT,
  backedUp BOOLEAN DEFAULT false,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webauthn_challenges table
CREATE TABLE webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expiresAt TIMESTAMP WITH TIME ZONE NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_webauthn_credentials_userId ON webauthn_credentials(userId);
CREATE INDEX idx_webauthn_credentials_credentialID ON webauthn_credentials(credentialID);
CREATE INDEX idx_webauthn_challenges_userId ON webauthn_challenges(userId);
CREATE INDEX idx_webauthn_challenges_expiresAt ON webauthn_challenges(expiresAt);

-- Enable RLS
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own credentials"
  ON webauthn_credentials FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Users can insert their own credentials"
  ON webauthn_credentials FOR INSERT
  WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can update their own credentials"
  ON webauthn_credentials FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Users can delete their own credentials"
  ON webauthn_credentials FOR DELETE
  USING (auth.uid() = userId);

CREATE POLICY "Users can view their own challenges"
  ON webauthn_challenges FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Users can insert their own challenges"
  ON webauthn_challenges FOR INSERT
  WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can delete their own challenges"
  ON webauthn_challenges FOR DELETE
  USING (auth.uid() = userId);
```

## API Endpoints

### Start Registration

```typescript
// app/api/auth/webauthn/register/start/route.ts
import { requireAuth } from '@/lib/auth';
import { registerCredentialStart } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const session = await requireAuth(request);

  const options = await registerCredentialStart(
    session.user.id,
    session.user.email
  );

  return Response.json({ data: options });
}
```

### Finish Registration

```typescript
// app/api/auth/webauthn/register/finish/route.ts
import { requireAuth } from '@/lib/auth';
import { registerCredentialFinish } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  const body = await request.json();

  const verification = await registerCredentialFinish(
    session.user.id,
    body
  );

  return Response.json({ data: verification });
}
```

### Start Authentication

```typescript
// app/api/auth/webauthn/authenticate/start/route.ts
import { authenticateCredentialStart } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const body = await request.json();
  const { userId } = body;

  const options = await authenticateCredentialStart(userId);

  return Response.json({ data: options });
}
```

### Finish Authentication

```typescript
// app/api/auth/webauthn/authenticate/finish/route.ts
import { authenticateCredentialFinish } from '@/lib/auth/webauthn';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { userId } = body;

  const verification = await authenticateCredentialFinish(userId, body);

  // Create session
  const session = await createSession(userId);

  return Response.json({ data: session });
}
```

## Frontend Integration

### Registration Page

```typescript
// app/settings/webauthn/register/page.tsx
'use client';

import { useState } from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

export default function WebAuthnRegisterPage() {
  const [loading, setLoading] = useState(false);

  async function registerWebAuthn() {
    setLoading(true);

    try {
      // Start registration
      const optionsRes = await fetch('/api/auth/webauthn/register/start');
      const options = await optionsRes.json();

      // Register credential
      const registration = await startRegistration(options.data);

      // Finish registration
      const finishRes = await fetch('/api/auth/webauthn/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registration),
      });

      if (finishRes.ok) {
        alert('WebAuthn registered successfully!');
      } else {
        alert('Registration failed');
      }
    } catch (error) {
      console.error('WebAuthn registration error:', error);
      alert('Registration failed');
    }

    setLoading(false);
  }

  return (
    <div className="webauthn-register">
      <h1>Register WebAuthn</h1>

      <p>
        Register a security key or biometric authenticator for passwordless login.
      </p>

      <button onClick={registerWebAuthn} disabled={loading}>
        {loading ? 'Registering...' : 'Register Security Key'}
      </button>
    </div>
  );
}
```

### Login Page

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresWebAuthn, setRequiresWebAuthn] = useState(false);
  const [userId, setUserId] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if user has WebAuthn credentials
      const checkRes = await fetch('/api/auth/check-webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkRes.json();

      if (checkData.hasWebAuthn) {
        setRequiresWebAuthn(true);
        setUserId(checkData.userId);
      } else {
        // Regular password login
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (loginRes.ok) {
          window.location.href = '/dashboard';
        } else {
          alert('Login failed');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }

    setLoading(false);
  }

  async function handleWebAuthn() {
    setLoading(true);

    try {
      // Start authentication
      const optionsRes = await fetch('/api/auth/webauthn/authenticate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const options = await optionsRes.json();

      // Authenticate
      const authentication = await startAuthentication(options.data);

      // Finish authentication
      const finishRes = await fetch('/api/auth/webauthn/authenticate/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...authentication }),
      });

      if (finishRes.ok) {
        window.location.href = '/dashboard';
      } else {
        alert('Authentication failed');
      }
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      alert('Authentication failed');
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      <h1>Login</h1>

      {!requiresWebAuthn ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            Login
          </button>
        </form>
      ) : (
        <div className="webauthn-login">
          <h2>Use your security key or biometric</h2>
          <button onClick={handleWebAuthn} disabled={loading}>
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Use Secure Challenge Storage

Store challenges securely with expiration:

```typescript
// Good: Store challenges with expiration
await supabase.from('webauthn_challenges').insert({
  userId,
  challenge: options.challenge,
  type: 'registration',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
});

// Bad: Store challenges without expiration
await supabase.from('webauthn_challenges').insert({
  userId,
  challenge: options.challenge,
  type: 'registration',
});
```

### 2. Verify Origin and RP ID

Always verify origin and RP ID:

```typescript
// Good: Verify origin and RP ID
const verification = verifyRegistrationResponse({
  response,
  expectedChallenge: challengeData.challenge,
  expectedOrigin: origin,
  expectedRPID: rpID,
});

// Bad: Don't verify origin and RP ID
const verification = verifyRegistrationResponse({
  response,
  expectedChallenge: challengeData.challenge,
});
```

### 3. Update Counter

Update the counter to prevent replay attacks:

```typescript
// Good: Update counter
await supabase
  .from('webauthn_credentials')
  .update({ counter: verification.authenticationInfo.newCounter })
  .eq('id', credential.id);

// Bad: Don't update counter
// No counter update
```

### 4. Support Multiple Credentials

Allow users to register multiple credentials:

```typescript
// Good: Support multiple credentials
const options = generateRegistrationOptions({
  rpName,
  rpID,
  userID: userId,
  userName: username,
  excludeCredentials: existingCredentials?.map(cred => ({
    id: cred.id,
    type: 'public-key',
  })) || [],
});

// Bad: Don't support multiple credentials
const options = generateRegistrationOptions({
  rpName,
  rpID,
  userID: userId,
  userName: username,
});
```

### 5. Provide Fallback

Provide a fallback to password authentication:

```typescript
// Good: Provide fallback
if (checkData.hasWebAuthn) {
  setRequiresWebAuthn(true);
} else {
  // Regular password login
  const loginRes = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

// Bad: No fallback
if (checkData.hasWebAuthn) {
  setRequiresWebAuthn(true);
} else {
  alert('No credentials found');
}
```

## References

- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [SimpleWebAuthn](https://simplewebauthn.dev/)
- [FIDO Alliance](https://fidoalliance.org/)
- [WebAuthn Guide](https://webauthn.guide/)
