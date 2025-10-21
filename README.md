# Servio - Modern Restaurant Management Platform

[![CI/CD](https://github.com/amaan667/Servio/actions/workflows/ci.yml/badge.svg)](https://github.com/amaan667/Servio/actions/workflows/ci.yml)
[![Security Audit](https://github.com/amaan667/Servio/actions/workflows/security.yml/badge.svg)](https://github.com/amaan667/Servio/actions/workflows/security.yml)

Servio is a comprehensive restaurant management SaaS platform built with Next.js 15, Supabase, and TypeScript.

## 🚀 Features

### Core Features
- **Dashboard** - Real-time venue analytics and insights
- **Order Management** - Live order tracking and management
- **Table Management** - Dynamic table assignment and merging
- **QR Code Ordering** - Contactless ordering system
- **Menu Management** - Multi-language menu editing
- **POS System** - Point of sale and payment processing
- **KDS (Kitchen Display System)** - Kitchen order management
- **Staff Management** - Role-based access control
- **Inventory Tracking** - Stock management and alerts
- **Analytics** - Revenue tracking and reporting
- **AI Assistant** - Intelligent menu translation and insights
- **Feedback System** - Customer feedback collection

### Technical Highlights
- ✅ Next.js 15 with App Router
- ✅ TypeScript with comprehensive type safety
- ✅ Supabase for auth, database, and storage
- ✅ Real-time updates via Supabase subscriptions
- ✅ Stripe integration for payments
- ✅ Tailwind CSS + shadcn/ui components
- ✅ CI/CD with GitHub Actions
- ✅ Security scanning and monitoring
- ✅ Performance tracking
- ✅ Comprehensive error boundaries
- ✅ Unit, integration, and E2E tests

## 📦 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Supabase account
- Stripe account (for payments)

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/amaan667/Servio.git
cd Servio

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
pnpm dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

### Environment Variables

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Optional
OPENAI_API_KEY=your_openai_api_key
REDIS_HOST=your_redis_host
REDIS_PORT=6379
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Test coverage
pnpm test:coverage
\`\`\`

## 🏗️ Building

\`\`\`bash
# Production build
pnpm build

# Start production server
pnpm start
\`\`\`

## 📚 Documentation

- [API Documentation](./docs/API.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Security Policy](./SECURITY.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for our security policy and how to report vulnerabilities.

## 📄 License

Private & Proprietary

## 👨‍💻 Author

Built by Amaan

---

**Production URL:** https://servio-production.up.railway.app
