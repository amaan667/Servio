# Servio - QR Code Ordering & POS Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)

> Complete POS and QR ordering platform for restaurants, cafes, food trucks, and market stalls. Manage orders, payments, inventory, and kitchen operations in one unified system.

## 🚀 Features

### Core Functionality
- **QR Code Ordering**: Contactless ordering system with customizable QR codes per table
- **Point of Sale (POS)**: Full-featured POS system for in-house orders
- **Kitchen Display System (KDS)**: Real-time order management for kitchen staff
- **Inventory Management**: Track ingredients, stock levels, and recipes
- **Payment Processing**: Integrated Stripe payments with multiple payment modes
- **Table Management**: Real-time table status, reservations, and session management
- **Staff Management**: Role-based access control with invitations and shifts
- **Analytics & Reporting**: Order analytics, performance metrics, and business insights
- **AI-Powered Menu Extraction**: Automatically extract menu items from images/PDFs
- **Multi-venue Support**: Manage multiple venues under one organization

### Technical Highlights
- **Type-Safe**: 100% TypeScript with strict mode enabled
- **Real-time Updates**: WebSocket-based live order tracking
- **Performance Optimized**: Redis caching, bundle optimization, image optimization
- **Security First**: Rate limiting, input validation, RBAC, security headers
- **Comprehensive Testing**: 313+ tests with 80% coverage threshold
- **Production Ready**: Sentry error tracking, monitoring, health checks

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/servio-mvp.git
cd servio-mvp

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
pnpm run migrate:auto

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the application.

## 📦 Prerequisites

- **Node.js**: >= 20.x
- **pnpm**: >= 9.x
- **PostgreSQL**: 14+ (via Supabase)
- **Redis**: 6+ (optional, for caching and rate limiting)
- **Stripe Account**: For payment processing
- **Supabase Project**: For database and authentication

## 🔧 Installation

### 1. Install Node.js and pnpm

```bash
# Install Node.js 20+ from nodejs.org
# Install pnpm globally
npm install -g pnpm@9
```

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/your-org/servio-mvp.git
cd servio-mvp
pnpm install --frozen-lockfile
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migrations in `supabase/migrations/`
3. Note your project URL and anon key

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

See [Configuration](#configuration) for detailed environment variable documentation.

### 5. Run Migrations

```bash
# Development
pnpm run migrate:auto

# Production
NODE_ENV=production pnpm run migrate:prod
```

### 6. Start Development Server

```bash
pnpm dev
```

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | `eyJhbGc...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `NEXT_PUBLIC_APP_URL` | Application URL | `http://localhost:3000` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL for caching | Not set (uses memory cache) |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments | Not set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Not set |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Not set |
| `SENTRY_DSN` | Sentry DSN for error tracking | Not set |
| `NODE_ENV` | Environment mode | `development` |

### Environment Setup by Environment

#### Development
```bash
# .env.local
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@localhost:5432/servio
REDIS_URL=redis://localhost:6379
```

#### Production
Set these in your hosting platform (Railway, Vercel, etc.):
- All required variables
- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL=https://your-domain.com`
- Production database and Redis URLs

## 💻 Development

### Project Structure

```
servio-mvp/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # API endpoints
│   ├── dashboard/          # Dashboard pages
│   └── ...
├── components/             # React components
├── lib/                    # Shared utilities and services
├── hooks/                  # React hooks
├── types/                  # TypeScript type definitions
├── __tests__/              # Test files
├── scripts/                # Utility scripts
└── supabase/               # Database migrations
```

### Available Scripts

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Code Quality
pnpm typecheck              # TypeScript type checking
pnpm lint                   # ESLint
pnpm lint:fix               # Fix ESLint errors
pnpm format                 # Format with Prettier
pnpm format:check           # Check formatting
pnpm validate               # Run all checks (format, lint, typecheck, test)

# Testing
pnpm test                   # Run unit tests
pnpm test:watch             # Run tests in watch mode
pnpm test:coverage          # Run tests with coverage
pnpm test:e2e               # Run E2E tests with Playwright
pnpm test:integration       # Run integration tests
pnpm test:all               # Run all test suites

# Database
pnpm migrate                # Run migrations
pnpm migrate:create         # Create new migration
pnpm migrate:auto          # Auto-run pending migrations
pnpm migrate:prod          # Run migrations in production

# Utilities
pnpm cache:clear            # Clear application cache
pnpm cache:stats            # Show cache statistics
pnpm perf:analyze           # Analyze performance
pnpm health:check           # Health check
pnpm build:analyze          # Analyze bundle size

# Documentation
pnpm docs:api               # Generate API documentation
```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the [Code Review Guidelines](docs/CODE_REVIEW_GUIDELINES.md)
   - Write tests for new features
   - Update documentation as needed

3. **Run validation**
   ```bash
   pnpm validate
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Configured with TypeScript and React rules
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for quality checks

See [Code Review Guidelines](docs/CODE_REVIEW_GUIDELINES.md) for detailed standards.

## 🧪 Testing

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires dev server running)
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

### Test Structure

- **Unit Tests**: `__tests__/` - Component and utility tests
- **API Tests**: `__tests__/api/` - API endpoint tests
- **E2E Tests**: `__tests__/e2e/` - End-to-end Playwright tests
- **Integration Tests**: `__tests__/integration/` - Integration test suites

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

## 🚢 Deployment

### Railway (Current Platform)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up
```

### Environment Variables on Railway

Set all required environment variables in the Railway dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- And optional variables as needed

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- **Vercel**: Zero-config deployment
- **AWS**: Using Amplify or ECS
- **Docker**: See `Dockerfile` (if available)

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **UI**: React 18, Radix UI, Tailwind CSS
- **Database**: PostgreSQL (via Supabase)
- **Cache**: Redis (with memory fallback)
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **Real-time**: Supabase Realtime
- **Error Tracking**: Sentry
- **Testing**: Vitest, Playwright
- **Package Manager**: pnpm

### Architecture Patterns

- **API Routes**: RESTful API with type-safe handlers
- **Server Components**: Next.js 14 App Router
- **Client Components**: React hooks and state management
- **Caching**: Multi-layer (Redis → Memory → Database)
- **Error Handling**: Centralized error handling with Sentry
- **Rate Limiting**: Redis-based rate limiting
- **Real-time**: WebSocket subscriptions via Supabase

See [Architecture Decision Records](docs/adr/) for detailed architectural decisions.

## 📚 API Documentation

### Interactive API Docs

Visit `/api-docs` in development or see the [API Documentation](docs/API.md) for detailed endpoint documentation.

### API Structure

All API routes are under `/app/api/`:
- `/api/orders` - Order management
- `/api/tables` - Table management
- `/api/menu` - Menu management
- `/api/inventory` - Inventory management
- `/api/staff` - Staff management
- `/api/payments` - Payment processing
- `/api/kds` - Kitchen display system

### Authentication

Most API routes require authentication via Supabase session cookies. Some public routes:
- `/api/menu/[venueId]` - Public menu access
- `/api/orders` (POST) - Public order creation
- `/api/health` - Health check

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. Read [Onboarding Guide](docs/ONBOARDING.md)
2. Follow [Code Review Guidelines](docs/CODE_REVIEW_GUIDELINES.md)
3. Write tests for new features
4. Update documentation
5. Submit a pull request

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Ensure migrations have run

#### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check Node.js version: `node --version` (should be >= 20)

#### Type Errors
- Run `pnpm typecheck` to see all errors
- Ensure all dependencies are installed
- Check `tsconfig.json` settings

#### Test Failures
- Ensure test database is set up
- Check environment variables for tests
- Run `pnpm test:watch` for detailed output

### Getting Help

- Check existing [documentation](docs/)
- Review [Architecture Decision Records](docs/adr/)
- Open an issue on GitHub
- Contact the development team

## 📄 License

Proprietary - All rights reserved

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Stripe](https://stripe.com/)
- [Radix UI](https://www.radix-ui.com/)
- And many other amazing open-source projects

---

**Servio** - Making restaurant operations simple and efficient.

For detailed documentation, see the [docs/](docs/) directory.

