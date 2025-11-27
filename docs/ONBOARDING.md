# Onboarding Guide

Welcome to the Servio development team! This guide will help you get set up and productive quickly.

## 🎯 Quick Start (15 minutes)

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/servio-mvp.git
   cd servio-mvp
   pnpm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

3. **Run Migrations**
   ```bash
   pnpm run migrate:auto
   ```

4. **Start Development**
   ```bash
   pnpm dev
   ```

Visit `http://localhost:3000` - you should see the app!

## 📚 Essential Reading

Before your first PR, read these in order:

1. [README.md](../README.md) - Project overview and setup
2. [Code Review Guidelines](CODE_REVIEW_GUIDELINES.md) - Coding standards
3. [Architecture Decision Records](adr/) - Why we made certain decisions
4. [API Documentation](../app/api-docs) - Understanding the API structure

## 🛠️ Development Environment Setup

### Prerequisites

- **Node.js 20+**: [Download](https://nodejs.org/)
- **pnpm 9+**: `npm install -g pnpm@9`
- **Git**: Already installed
- **VS Code** (recommended): [Download](https://code.visualstudio.com/)

### VS Code Extensions

Install these recommended extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run migrations from `supabase/migrations/`
4. Copy project URL and anon key to `.env.local`

### Redis Setup (Optional)

For local development, Redis is optional (uses memory cache):
```bash
# macOS
brew install redis
brew services start redis

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## 🧪 Testing Setup

### Run Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# E2E tests (requires dev server)
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### Writing Tests

- **Unit tests**: `__tests__/` directory
- **API tests**: `__tests__/api/`
- **E2E tests**: `__tests__/e2e/`

Example test:
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

## 📝 Your First Contribution

### 1. Pick an Issue

- Start with "good first issue" labels
- Ask in team chat if unsure
- Small PRs are better than large ones

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Make Changes

- Follow [Code Review Guidelines](CODE_REVIEW_GUIDELINES.md)
- Write tests for new features
- Update documentation

### 4. Validate

```bash
pnpm validate
# Runs: format check, lint, typecheck, tests
```

### 5. Commit

```bash
git add .
git commit -m "feat: add new feature"
# Use conventional commits: feat, fix, docs, refactor, test, chore
```

### 6. Push and PR

```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

## 🏗️ Project Structure

```
servio-mvp/
├── app/              # Next.js App Router
│   ├── api/          # API routes
│   └── dashboard/    # Dashboard pages
├── components/       # React components
├── lib/              # Shared utilities
│   ├── api/          # API helpers
│   ├── auth/         # Authentication
│   └── ...
├── hooks/            # React hooks
├── types/            # TypeScript types
├── __tests__/         # Tests
└── docs/              # Documentation
```

## 🔑 Key Concepts

### Authentication

- Uses Supabase Auth
- Session-based (cookies)
- Middleware handles auth checks
- See `lib/auth/` for auth utilities

### API Routes

- RESTful API under `/app/api/`
- Type-safe with Zod validation
- Error handling wrapper
- Rate limiting

### Database

- PostgreSQL via Supabase
- Migrations in `supabase/migrations/`
- Type-safe with generated types

### State Management

- React Query for server state
- React hooks for local state
- Real-time via Supabase subscriptions

## 🐛 Common Issues

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
pnpm install
```

### Type Errors

```bash
# Check all types
pnpm typecheck
```

### Test Failures

- Ensure test database is set up
- Check environment variables
- Run `pnpm test:watch` for details

## 💡 Tips

1. **Ask Questions**: Use team chat, don't struggle alone
2. **Small PRs**: Easier to review and merge
3. **Write Tests**: Especially for new features
4. **Document**: Update docs when adding features
5. **Follow Patterns**: Look at existing code for patterns

## 📞 Getting Help

- **Team Chat**: Ask in #dev-help
- **GitHub Issues**: For bugs and features
- **Code Review**: Ask reviewers for feedback
- **Documentation**: Check `docs/` directory

## ✅ Checklist

Before your first PR:

- [ ] Read README.md
- [ ] Read Code Review Guidelines
- [ ] Set up development environment
- [ ] Run tests successfully
- [ ] Understand project structure
- [ ] Pick a first issue
- [ ] Make a small change
- [ ] Submit PR

## 🎓 Learning Resources

- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Query](https://tanstack.com/query)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🚀 Next Steps

1. Complete the checklist above
2. Make your first contribution
3. Join code reviews to learn
4. Explore the codebase
5. Ask questions!

Welcome to the team! 🎉

