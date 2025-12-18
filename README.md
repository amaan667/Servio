# Servio MVP

A comprehensive restaurant management platform for order processing, kitchen display systems, inventory management, and customer engagement.

## 🚀 Features

- **QR Code Ordering**: Customers scan QR codes to view menus and place orders
- **Kitchen Display System (KDS)**: Real-time order display for kitchen staff
- **Payment Processing**: Integrated Stripe payments with multiple payment methods
- **Inventory Management**: Track stock levels, movements, and low stock alerts
- **Staff Management**: Role-based access control and staff scheduling
- **Table Management**: Dynamic table assignment and session tracking
- **Analytics Dashboard**: Revenue tracking, order analytics, and reporting
- **AI Assistant**: Intelligent menu and inventory management assistance
- **Multi-venue Support**: Manage multiple restaurant locations

## 📋 Prerequisites

- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL database (via Supabase)
- Redis (optional, for rate limiting and caching)
- Stripe account (for payment processing)

## 🛠️ Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd servio-mvp-cleaned
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) section for details.

### 4. Database Setup

Run migrations to set up the database schema:

```bash
pnpm run migrate:auto
```

For production:

```bash
pnpm run migrate:prod
```

### 5. Run Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## 🔧 Environment Variables

### Required (Production)

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### Optional

- `NEXT_PUBLIC_APP_URL` - Application URL (defaults to Railway domain)
- `NEXT_PUBLIC_SITE_URL` - Public site URL
- `DATABASE_URL` - Direct PostgreSQL connection string
- `REDIS_URL` - Redis connection string (for rate limiting)
- `OPENAI_API_KEY` - OpenAI API key (for AI features)
- `SENTRY_DSN` - Sentry DSN for error tracking
- `RESEND_API_KEY` - Resend API key (for email sending)
- `CRON_SECRET` - Secret for cron job authentication
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

See `.env.example` for a complete list of all environment variables.

## 📜 Available Scripts

### Development

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server

### Code Quality

- `pnpm validate` - Run format, lint, typecheck, and tests
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm typecheck` - TypeScript type checking
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting

### Testing

- `pnpm test` - Run unit tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:e2e` - Run end-to-end tests with Playwright
- `pnpm test:integration` - Run integration tests
- `pnpm test:all` - Run all tests (unit + e2e + integration)

### Database

- `pnpm migrate` - Run database migrations
- `pnpm migrate:create` - Create a new migration
- `pnpm migrate:auto` - Auto-run pending migrations
- `pnpm migrate:prod` - Run migrations in production mode

### Utilities

- `pnpm cache:clear` - Clear application cache
- `pnpm health:check` - Check application health
- `pnpm perf:analyze` - Analyze bundle performance

## 🏗️ Project Structure

```
servio-mvp-cleaned/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/        # Dashboard pages
│   ├── order/             # Customer ordering interface
│   └── ...
├── components/            # React components
├── lib/                   # Shared utilities and libraries
│   ├── auth/             # Authentication logic
│   ├── api/              # API helpers
│   ├── env/              # Environment variable validation
│   └── ...
├── __tests__/            # Test files
├── supabase/
│   └── migrations/       # Database migrations
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## 🔐 Security

- **Authentication**: Supabase Auth with middleware-based header verification
- **Authorization**: Role-based access control with venue scoping
- **Rate Limiting**: Redis-based rate limiting (falls back gracefully)
- **Header Stripping**: Middleware strips `x-user-id` and `x-user-email` to prevent spoofing
- **Environment Validation**: Strict environment variable validation in production

## 🧪 Testing

The codebase includes comprehensive test coverage:

- **Unit Tests**: 229 test files covering API routes, components, and utilities
- **Integration Tests**: End-to-end flow testing
- **E2E Tests**: Playwright tests for critical user flows

Run all tests:

```bash
pnpm test:all
```

## 🚢 Deployment

### Railway

The project is configured for Railway deployment:

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Railway will automatically build and deploy on push to main

Configuration files:
- `railway.toml` - Railway deployment configuration
- `nixpacks.toml` - Build configuration

### Manual Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. Start the production server:
   ```bash
   pnpm start
   ```

## 📚 Documentation

- **API Documentation**: Available at `/api-docs` when running the app
- **Runbooks**: See `RUNBOOKS.md` for operational procedures
- **Summary**: See `SUMMARY.md` for recent changes and pilot readiness

## 🐛 Troubleshooting

### Build Errors

- Ensure all required environment variables are set
- Run `pnpm validate` to check for lint/type errors
- Clear `.next` directory and rebuild: `rm -rf .next && pnpm build`

### Database Issues

- Verify Supabase connection strings are correct
- Check migration status: `pnpm migrate`
- Review `RUNBOOKS.md` for database recovery procedures

### Payment Issues

- Verify Stripe webhook secrets are configured
- Check webhook events in `stripe_webhook_events` table
- See `RUNBOOKS.md` for webhook replay procedures

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run `pnpm validate` to ensure code quality
4. Submit a pull request

## 📄 License

Private - All rights reserved

## 🆘 Support

For issues and questions:
- Check `RUNBOOKS.md` for operational procedures
- Review error logs in Sentry (if configured)
- Check Railway logs for deployment issues

