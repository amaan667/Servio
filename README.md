# Servio

A comprehensive point-of-sale (POS) and ordering platform for restaurants and venues. Built with Next.js, TypeScript, Supabase, and Stripe.

## Features

- **Order Management**: Real-time order processing and tracking
- **Menu Management**: Dynamic menu creation with categories, images, and pricing
- **Payment Processing**: Secure payments via Stripe (card, digital wallets)
- **Kitchen Display System (KDS)**: Real-time order display for kitchen staff
- **QR Code Orders**: Table-side ordering via QR codes
- **Staff Management**: Role-based access control (owner, manager, server, staff)
- **Analytics & Reporting**: Revenue tracking, order analytics, performance metrics
- **Multi-Venue Support**: Manage multiple locations from one account
- **Tier-Based Subscriptions**: Starter, Pro, and Enterprise plans
- **Offline Support**: Service worker for offline functionality
- **Real-Time Updates**: Live data synchronization across devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth (OAuth 2.0, PKCE)
- **Payments**: Stripe
- **UI**: Tailwind CSS, Radix UI
- **State Management**: React Query, React Context
- **Testing**: Vitest, Playwright
- **Deployment**: Railway
- **Monitoring**: Sentry

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher
- PostgreSQL database (via Supabase)
- Stripe account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/servio.git
   cd servio
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following required variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key
   
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NODE_ENV=development
   ```

4. **Run database migrations**
   ```bash
   pnpm run migrate
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm typecheck` - Type check TypeScript
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors
- `pnpm test` - Run unit tests
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:coverage` - Generate test coverage
- `pnpm format` - Format code with Prettier
- `pnpm migrate` - Run database migrations

### Project Structure

```
servio/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── ...
├── components/            # React components
│   ├── ui/               # UI primitives (Radix UI)
│   └── ...
├── lib/                   # Shared utilities
│   ├── access/           # Access control logic
│   ├── auth/             # Authentication helpers
│   ├── supabase/         # Supabase client setup
│   └── ...
├── migrations/            # Database migrations
├── __tests__/            # Test files
└── public/               # Static assets
```

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Zero warnings policy
- **Prettier**: Code formatting
- **Testing**: 971+ tests covering API routes, components, and integrations
- **Code Style**: Follow `.cursorrules` for consistency

### Database

The application uses PostgreSQL via Supabase with:

- **Row-Level Security (RLS)**: Enforced on all tables
- **Migrations**: SQL migrations in `migrations/` directory
- **RPC Functions**: Custom PostgreSQL functions for complex operations
- **Real-time**: Supabase Realtime for live updates

Key tables:
- `venues` - Restaurant/venue information
- `orders` - Customer orders
- `menu_items` - Menu catalog
- `tables` - Table management
- `staff` - Staff members
- `organizations` - Multi-venue organizations
- `user_venue_roles` - Role-based access control

### Authentication & Authorization

- **Authentication**: Supabase Auth with OAuth 2.0 and PKCE
- **Authorization**: Role-based access control (RBAC)
- **Access Context**: Unified `get_access_context()` RPC function
- **Tier System**: Subscription-based feature access

Roles:
- `owner` - Full access to venue
- `manager` - Management access
- `server` - Order and table management
- `staff` - Limited access
- `viewer` - Read-only access

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Railway:

1. Connect your GitHub repository to Railway
2. Configure environment variables
3. Railway automatically builds and deploys on push to `main`

## API Documentation

See [API.md](./docs/API.md) for complete API documentation.

Key endpoints:
- `/api/orders` - Order management
- `/api/staff` - Staff management
- `/api/menu` - Menu operations
- `/api/tables` - Table management
- `/api/analytics` - Analytics data
- `/api/stripe/*` - Stripe webhooks and payment processing

## Testing

### Unit Tests
```bash
pnpm test
```

### E2E Tests
```bash
pnpm test:e2e
```

### Coverage
```bash
pnpm test:coverage
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure all tests pass (`pnpm validate`)
4. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Use Zod for input validation
- Follow existing code patterns
- Document complex logic

## Security

- **Authentication**: Secure OAuth 2.0 flow with PKCE
- **Authorization**: Row-level security in database
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: API rate limiting to prevent abuse
- **HTTPS**: Enforced in production
- **Secrets**: Environment variables for sensitive data

Report security issues to: security@servio.uk

## Monitoring

- **Error Tracking**: Sentry integration
- **Logging**: Structured logging with correlation IDs
- **Health Checks**: `/api/health` and `/api/ready` endpoints
- **Performance**: Web vitals tracking

## Support

- **Documentation**: [Help Center](/help)
- **Email**: support@servio.uk
- **Issues**: GitHub Issues (for bugs and feature requests)

## License

Proprietary - All rights reserved

## Version

Current version: **0.1.6**

---

Built with ❤️ for restaurants and venues

