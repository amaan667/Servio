# Contributing to Servio

Thank you for your interest in contributing to Servio! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Servio.git
   cd Servio
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

6. Configure your environment variables (see `.env.example` for details)

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

### Running the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run integration tests
pnpm test:integration

# Run all tests
pnpm test:all
```

### Code Quality Checks

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Formatting
pnpm format

# Check formatting
pnpm format:check

# Run all validations
pnpm validate
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Avoid `any` types
- Use interfaces for object shapes
- Use type aliases for union types
- Prefer `const` assertions over type casts

### Code Style

- Follow ESLint rules
- Use Prettier for formatting
- Use meaningful variable and function names
- Keep functions small and focused
- Use descriptive comments for complex logic

### File Organization

```
app/                    # Next.js App Router pages and API routes
├── api/               # API endpoints
├── dashboard/          # Dashboard pages
└── components/         # Page-specific components

components/            # Reusable React components
├── ui/               # Base UI components (buttons, inputs, etc.)
├── forms/             # Form components
└── layout/            # Layout components

lib/                   # Core business logic
├── services/          # Domain services
├── repositories/       # Data access layer
├── api/              # API utilities and handlers
├── auth/             # Authentication utilities
├── monitoring/        # Monitoring and logging
└── utils/            # Utility functions

hooks/                 # Custom React hooks
types/                 # TypeScript type definitions
__tests__/             # Test files
```

### Best Practices

#### API Routes

- Use [`createUnifiedHandler`](lib/api/unified-handler.ts) for all new API routes
- Include Zod schemas for request validation
- Return standardized [`ApiResponse`](lib/api/standard-response.ts) format
- Add appropriate error handling

#### Services

- Extend [`BaseService`](lib/services/BaseService.ts) for new services
- Use caching with `withCache` method
- Handle errors with `handleError` method
- Keep business logic in services, not in API routes

#### Components

- Use Server Components by default
- Use Client Components only when interactivity is needed
- Use Radix UI primitives for accessibility
- Follow shadcn/ui component patterns

#### Database

- Use Supabase client from [`lib/supabase/index.ts`](lib/supabase/index.ts)
- Use parameterized queries to prevent SQL injection
- Leverage Row-Level Security (RLS) for multi-tenancy
- Use repositories for data access

## Testing

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Test both success and error cases
- Aim for high code coverage

### Integration Tests

- Test API endpoints
- Test database interactions
- Test service layer
- Use test database

### E2E Tests

- Test user flows
- Test critical paths
- Use Playwright for browser testing
- Test across multiple browsers

### Test Coverage

- Maintain at least 80% coverage
- Focus on critical paths
- Test error handling
- Test edge cases

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```
feat(auth): add 2FA support

Implement TOTP-based two-factor authentication for enhanced security.

Closes #123
```

```
fix(api): resolve rate limiting issue

Fix rate limiting not working for authenticated users.

Fixes #456
```

```
docs(readme): update setup instructions

Add instructions for local development setup.
```

## Pull Request Process

### Before Submitting

1. Run all validations:
   ```bash
   pnpm validate
   ```

2. Run all tests:
   ```bash
   pnpm test:all
   ```

3. Update documentation if needed

4. Ensure your branch is up to date:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Submitting a PR

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a pull request on GitHub

3. Fill in the PR template:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)

4. Request review from maintainers

### PR Review Process

- Automated checks must pass
- At least one approval required
- Address all review comments
- Keep PRs small and focused

### Merge Process

- Squash commits when merging
- Delete feature branch after merge
- Update CHANGELOG.md

## Architecture Decisions

Significant architectural decisions should be documented in Architecture Decision Records (ADRs):

1. Create a new ADR in `docs/adrs/`
2. Follow the ADR template
3. Reference the ADR in related code and PRs

## Getting Help

- Check existing [documentation](docs/)
- Search [existing issues](https://github.com/amaan667/Servio/issues)
- Ask questions in [discussions](https://github.com/amaan667/Servio/discussions)
- Contact maintainers for critical issues

## License

By contributing, you agree that your contributions will be licensed under the project's license.

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md
- Release notes
- Project documentation

Thank you for contributing to Servio! 🎉
