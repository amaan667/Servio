# 2FA/MFA Support for Authentication

This document describes the implementation of two-factor authentication (2FA) and multi-factor authentication (MFA) for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Best Practices](#best-practices)

## Overview

Two-factor authentication (2FA) adds an extra layer of security by requiring users to provide two forms of authentication:

1. **Something you know:** Password
2. **Something you have:** TOTP app (Google Authenticator, Authy) or SMS code

Multi-factor authentication (MFA) extends this to support multiple factors:

- **TOTP (Time-based One-Time Password):** Using authenticator apps
- **SMS:** Using text messages
- **Email:** Using email codes
- **Hardware keys:** Using WebAuthn

## Features

### TOTP Authentication

```typescript
// lib/auth/totp.ts
import { authenticator } from 'otplib';
import { supabase } from '@/lib/supabase';

export async function generateTOTPSecret(userId: string) {
  const secret = authenticator.generateSecret();

  await supabase.from('user_2fa').insert({
    userId,
    type: 'totp',
    secret,
    verified: false,
  });

  return secret;
}

export async function verifyTOTP(userId: string, token: string) {
  const { data } = await supabase
    .from('user_2fa')
    .select('secret')
    .eq('userId', userId)
    .eq('type', 'totp')
    .single();

  if (!data) {
    throw new Error('TOTP not enabled');
  }

  const isValid = authenticator.verify({
    token,
    secret: data.secret,
  });

  if (isValid) {
    await supabase
      .from('user_2fa')
      .update({ verified: true })
      .eq('userId', userId)
      .eq('type', 'totp');
  }

  return isValid;
}

export function generateTOTPQRCode(secret: string, email: string) {
  const otpauth = authenticator.keyuri(email, 'Servio', secret);
  return `otpauth://totp/Servio:${email}?secret=${secret}&issuer=Servio`;
}
```

### SMS Authentication

```typescript
// lib/auth/sms.ts
import { supabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

export async function sendSMSCode(userId: string, phoneNumber: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await supabase.from('user_2fa').insert({
    userId,
    type: 'sms',
    phoneNumber,
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  await sendSMS(phoneNumber, `Your Servio verification code is: ${code}`);
}

export async function verifySMSCode(userId: string, code: string) {
  const { data } = await supabase
    .from('user_2fa')
    .select('*')
    .eq('userId', userId)
    .eq('type', 'sms')
    .eq('code', code)
    .gt('expiresAt', new Date())
    .single();

  if (!data) {
    throw new Error('Invalid or expired code');
  }

  await supabase
    .from('user_2fa')
    .update({ verified: true })
    .eq('id', data.id);

  return true;
}
```

### Email Authentication

```typescript
// lib/auth/email.ts
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

export async function sendEmailCode(userId: string, email: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await supabase.from('user_2fa').insert({
    userId,
    type: 'email',
    email,
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  await sendEmail(email, 'Your Servio verification code', {
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
}

export async function verifyEmailCode(userId: string, code: string) {
  const { data } = await supabase
    .from('user_2fa')
    .select('*')
    .eq('userId', userId)
    .eq('type', 'email')
    .eq('code', code)
    .gt('expiresAt', new Date())
    .single();

  if (!data) {
    throw new Error('Invalid or expired code');
  }

  await supabase
    .from('user_2fa')
    .update({ verified: true })
    .eq('id', data.id);

  return true;
}
```

## Database Schema

```sql
-- Create user_2fa table
CREATE TABLE user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('totp', 'sms', 'email', 'webauthn')),
  secret TEXT,
  phoneNumber TEXT,
  email TEXT,
  code TEXT,
  expiresAt TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN DEFAULT false,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_user_2fa_userId ON user_2fa(userId);
CREATE INDEX idx_user_2fa_type ON user_2fa(type);

-- Enable RLS
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own 2FA settings"
  ON user_2fa FOR SELECT
  USING (auth.uid() = userId);

CREATE POLICY "Users can insert their own 2FA settings"
  ON user_2fa FOR INSERT
  WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can update their own 2FA settings"
  ON user_2fa FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Users can delete their own 2FA settings"
  ON user_2fa FOR DELETE
  USING (auth.uid() = userId);
```

## API Endpoints

### Enable 2FA

```typescript
// app/api/auth/2fa/enable/route.ts
import { requireAuth } from '@/lib/auth';
import { generateTOTPSecret } from '@/lib/auth/totp';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  const body = await request.json();
  const { type } = body;

  if (type === 'totp') {
    const secret = await generateTOTPSecret(session.user.id);
    const qrCode = generateTOTPQRCode(secret, session.user.email);

    return Response.json({
      data: {
        secret,
        qrCode,
      },
    });
  }

  if (type === 'sms') {
    const { phoneNumber } = body;
    await sendSMSCode(session.user.id, phoneNumber);

    return Response.json({
      data: {
        message: 'SMS code sent',
      },
    });
  }

  if (type === 'email') {
    await sendEmailCode(session.user.id, session.user.email);

    return Response.json({
      data: {
        message: 'Email code sent',
      },
    });
  }

  return Response.json(
    { error: 'Invalid 2FA type' },
    { status: 400 }
  );
}
```

### Verify 2FA

```typescript
// app/api/auth/2fa/verify/route.ts
import { requireAuth } from '@/lib/auth';
import { verifyTOTP } from '@/lib/auth/totp';
import { verifySMSCode } from '@/lib/auth/sms';
import { verifyEmailCode } from '@/lib/auth/email';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  const body = await request.json();
  const { type, code } = body;

  let isValid = false;

  if (type === 'totp') {
    isValid = await verifyTOTP(session.user.id, code);
  } else if (type === 'sms') {
    isValid = await verifySMSCode(session.user.id, code);
  } else if (type === 'email') {
    isValid = await verifyEmailCode(session.user.id, code);
  }

  if (!isValid) {
    return Response.json(
      { error: 'Invalid code' },
      { status: 400 }
    );
  }

  return Response.json({
    data: {
      message: '2FA enabled successfully',
    },
  });
}
```

### Disable 2FA

```typescript
// app/api/auth/2fa/disable/route.ts
import { requireAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  const body = await request.json();
  const { type } = body;

  await supabase
    .from('user_2fa')
    .delete()
    .eq('userId', session.user.id)
    .eq('type', type);

  return Response.json({
    data: {
      message: '2FA disabled successfully',
    },
  });
}
```

## Frontend Integration

### 2FA Settings Page

```typescript
// app/settings/2fa/page.tsx
'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function TwoFactorSettingsPage() {
  const [type, setType] = useState<'totp' | 'sms' | 'email' | null>(null);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function enable2FA() {
    setLoading(true);
    const res = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });

    const data = await res.json();

    if (type === 'totp') {
      setSecret(data.data.secret);
      setQrCode(data.data.qrCode);
    }

    setLoading(false);
  }

  async function verify2FA() {
    setLoading(true);
    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, code }),
    });

    if (res.ok) {
      alert('2FA enabled successfully!');
      setType(null);
      setSecret('');
      setQrCode('');
      setCode('');
    } else {
      alert('Invalid code');
    }

    setLoading(false);
  }

  return (
    <div className="2fa-settings">
      <h1>Two-Factor Authentication</h1>

      {!type && (
        <div className="2fa-options">
          <button onClick={() => setType('totp')}>
            Authenticator App
          </button>
          <button onClick={() => setType('sms')}>
            SMS
          </button>
          <button onClick={() => setType('email')}>
            Email
          </button>
        </div>
      )}

      {type === 'totp' && (
        <div className="totp-setup">
          <h2>Set up Authenticator App</h2>

          {qrCode && (
            <div className="qr-code">
              <QRCodeSVG value={qrCode} />
            </div>
          )}

          <p>Secret: {secret}</p>

          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button onClick={verify2FA} disabled={loading}>
            Verify
          </button>
        </div>
      )}

      {type === 'sms' && (
        <div className="sms-setup">
          <h2>Set up SMS</h2>

          <input
            type="tel"
            placeholder="Enter phone number"
          />

          <button onClick={enable2FA} disabled={loading}>
            Send Code
          </button>

          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button onClick={verify2FA} disabled={loading}>
            Verify
          </button>
        </div>
      )}

      {type === 'email' && (
        <div className="email-setup">
          <h2>Set up Email</h2>

          <button onClick={enable2FA} disabled={loading}>
            Send Code
          </button>

          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button onClick={verify2FA} disabled={loading}>
            Verify
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2FA Login Flow

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.requires2FA) {
      setRequires2FA(true);
    } else if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      alert(data.error);
    }

    setLoading(false);
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      alert('Invalid code');
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      <h1>Login</h1>

      {!requires2FA ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            Login
          </button>
        </form>
      ) : (
        <form onSubmit={handle2FA}>
          <h2>Enter 2FA Code</h2>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            Verify
          </button>
        </form>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Use Secure Random Secrets

Always use cryptographically secure random secrets:

```typescript
// Good: Use otplib's built-in secret generation
const secret = authenticator.generateSecret();

// Bad: Use Math.random()
const secret = Math.random().toString(36);
```

### 2. Set Expiration Times

Set reasonable expiration times for codes:

```typescript
// Good: 5-10 minutes
expiresAt: new Date(Date.now() + 5 * 60 * 1000)

// Bad: 24 hours
expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
```

### 3. Rate Limit Verification Attempts

Rate limit verification attempts to prevent brute force:

```typescript
// Good: Rate limit verification attempts
import { rateLimit } from '@/lib/rate-limit';

export async function verifyTOTP(userId: string, token: string) {
  await rateLimit(`2fa:${userId}`, 5, 60); // 5 attempts per minute

  // ... verification logic
}

// Bad: No rate limiting
export async function verifyTOTP(userId: string, token: string) {
  // ... verification logic
}
```

### 4. Provide Backup Codes

Provide backup codes for users who lose access:

```typescript
// Good: Generate backup codes
export async function generateBackupCodes(userId: string) {
  const codes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  await supabase.from('user_2fa_backup_codes').insert(
    codes.map(code => ({
      userId,
      code,
      used: false,
    }))
  );

  return codes;
}

// Bad: No backup codes
```

### 5. Log 2FA Events

Log all 2FA events for security auditing:

```typescript
// Good: Log 2FA events
export async function log2FAEvent(
  userId: string,
  event: string,
  details?: any
) {
  await supabase.from('security_audit_log').insert({
    userId,
    event,
    details,
    timestamp: new Date(),
  });
}

// Bad: No logging
```

## References

- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [Google Authenticator](https://github.com/google/google-authenticator)
- [Authy](https://authy.com/)
- [otplib](https://github.com/guybedford/otplib)
- [qrcode.react](https://github.com/zpao/qrcode-react)
