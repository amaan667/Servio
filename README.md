# Servio

A modern restaurant management platform for seamless ordering, payments, and operations.

## Features

- **QR Code Ordering** - Customers scan QR codes to view menus and place orders
- **Menu Management** - Upload PDFs, manage items, categories, and pricing
- **Order Management** - Real-time order tracking with KDS (Kitchen Display System)
- **Table Management** - Manage tables, reservations, and seating
- **Payment Processing** - Stripe integration for secure payments
- **Staff Management** - Role-based access control for owners, managers, and staff
- **Analytics Dashboard** - Revenue, orders, and performance insights
- **AI Assistant** - Menu optimization and operational suggestions

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: React 19, Tailwind CSS, Radix UI, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Caching**: Redis (optional, with memory fallback)
- **Testing**: Vitest, Playwright
- **Monitoring**: Sentry

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/amaan667/Servio.git
cd Servio

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment variables (see .env.example for details)
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, 
#           SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# Run development server
pnpm dev
```

### Environment Setup

1. **Supabase**: Create a project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key to `.env.local`
   - Copy the service role key (keep this secret!)

2. **Stripe**: Get API keys from [dashboard.stripe.com](https://dashboard.stripe.com/apikeys)
   - Use test keys for development (`sk_test_*`, `pk_test_*`)
   - Set up webhook endpoint: `your-url/api/webhooks/stripe`

3. **Redis** (optional): For production rate limiting and caching
   - Without Redis, the app uses in-memory fallbacks

## Development

```bash
# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run all validations
pnpm validate
```

## Project Structure

```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints (209 routes)
│   ├── dashboard/         # Admin dashboard pages
│   ├── order/             # Customer ordering flow
│   └── payment/           # Payment processing
├── components/            # Reusable React components (182 components)
├── hooks/                 # Custom React hooks
├── lib/                   # Core business logic
│   ├── services/         # Domain services (Menu, Order, Table, etc.)
│   ├── cache/            # Caching layer (Redis + memory)
│   ├── api/              # API utilities and handlers
│   └── auth/             # Authentication utilities
├── types/                 # TypeScript type definitions
└── __tests__/            # Test files (494 test files)
```

## API Documentation

API documentation is available at `/api-docs/swagger` when running the development server.

See [docs/API_SPEC.md](docs/API_SPEC.md) for detailed API specifications.

## Testing

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests (Playwright)
pnpm test:e2e

# Integration tests
pnpm test:integration

# All tests
pnpm test:all
```

## Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to `main`

### Vercel

1. Import project to Vercel
2. Set environment variables
3. Deploy

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

**Required for production:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run validations: `pnpm validate`
4. Commit with descriptive message
5. Push and create a Pull Request

## Security

- All API endpoints use rate limiting
- Input validation with Zod schemas
- CSRF protection on mutations
- XSS sanitization with DOMPurify
- Row-Level Security (RLS) in Supabase
- Security headers configured (HSTS, X-Frame-Options, etc.)

## License

Private - All rights reserved.
