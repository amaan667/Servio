# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email security concerns to: security@servio.app
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and provide updates every 72 hours.

## Security Measures

### Authentication & Authorization
- ✅ Supabase Auth with Row Level Security (RLS)
- ✅ Server-side session validation
- ✅ Role-based access control (RBAC)
- ✅ Secure cookie handling

### Data Protection
- ✅ HTTPS only in production
- ✅ Environment variables for secrets
- ✅ Database encryption at rest
- ✅ Secure file uploads to Supabase Storage

### API Security
- ✅ CORS configuration
- ✅ Rate limiting on sensitive endpoints
- ✅ Input validation and sanitization
- ✅ SQL injection protection (Supabase handles this)

### Dependencies
- ✅ Automated dependency updates (Dependabot)
- ✅ Regular security audits
- ✅ No known high-severity vulnerabilities

## Best Practices

- Never commit `.env` files
- Rotate API keys regularly
- Use strong passwords
- Enable 2FA for admin accounts
- Regular security audits

