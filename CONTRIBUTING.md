# Contributing to Servio

Thank you for your interest in contributing to Servio! This document provides guidelines and standards for contributing to the project.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)

---

## Code of Conduct

### Our Standards
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Prioritize the project's long-term success

---

## Getting Started

### Prerequisites
- Node.js 20+ and pnpm 9+
- Supabase account (for local development)
- Stripe account (for payment testing)
- Git

### Initial Setup
```bash
# 1. Fork the repository
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/servio.git
cd servio

# 3. Install dependencies
pnpm install

# 4. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 5. Run development server
pnpm dev
```

---

## Development Workflow

### Branching Strategy
- `main` - Production-ready code
- `develop` - Integration branch (if used)
- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/bug-description`
- Hotfixes: `hotfix/critical-fix`

### Development Process
1. Create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes

3. Run quality checks
   ```bash
   pnpm run quality
   ```

4. Commit your changes (see [Commit Guidelines](#commit-message-guidelines))

5. Push and create a Pull Request

---

## Code Standards

### TypeScript
- **Strict mode enabled** - No implicit `any` types
- Use explicit types, avoid type assertions (`as any`)
- Prefer interfaces over types for object shapes
- Document complex types with comments

**Good:**
```typescript
interface OrderData {
  id: string;
  items: OrderItem[];
  total: number;
}

function createOrder(data: OrderData): Promise<Order> {
  // Implementation
}
```

**Bad:**
```typescript
function createOrder(data: any): any {
  // Don't do this
}
```

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Hooks: `use-kebab-case.ts` or `useCamelCase.ts`
- API routes: `kebab-case/route.ts`
- Types: `kebab-case.ts` or `PascalCase.ts`

### Component Guidelines
- Use functional components with hooks
- Extract complex logic into custom hooks
- Keep components focused and single-purpose
- Use TypeScript for all props

**Component Template:**
```typescript
import { useState } from 'react';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState<string>('');
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### API Route Standards
- Use consistent error handling
- Return typed responses
- Include proper logging
- Validate inputs

**API Template:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ApiResponse, MyDataType } from '@/types';

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<MyDataType>>> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID required' }, { status: 400 });
    }
    
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('[ROUTE] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logger.error('[ROUTE] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
```

### Logging
- Use `logger` from `@/lib/logger`, NOT `console.log`
- Include context in log messages
- Use appropriate log levels

```typescript
import { logger } from '@/lib/logger';

logger.debug('[FEATURE] Debug info:', { data });
logger.info('[FEATURE] Operation successful');
logger.warn('[FEATURE] Warning condition:', { reason });
logger.error('[FEATURE] Error occurred:', error);
```

### Error Handling
- Use try-catch blocks
- Return proper HTTP status codes
- Log errors with context
- Provide helpful error messages

---

## Testing Requirements

### Test Coverage Goals
- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical user flows
- **E2E Tests**: Key business scenarios

### Writing Tests
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('should handle user interaction', async () => {
    const onAction = vi.fn();
    render(<MyComponent onAction={onAction} />);
    
    // User interaction
    await userEvent.click(screen.getByRole('button'));
    
    expect(onAction).toHaveBeenCalled();
  });
});
```

### Running Tests
```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Test Requirements
- All new features must include tests
- Bug fixes should include regression tests
- Maintain or improve coverage percentage
- Tests must pass before PR approval

---

## Pull Request Process

### Before Submitting
1. ✅ Run all quality checks: `pnpm run quality`
2. ✅ Ensure tests pass: `pnpm test`
3. ✅ Update documentation if needed
4. ✅ Add/update tests for your changes
5. ✅ Lint and format code: `pnpm run lint:fix && pnpm run format`

### PR Checklist
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Manual testing performed

## Quality Checks
- [ ] Code follows style guidelines
- [ ] TypeScript types are properly defined (no `any` types)
- [ ] Logging uses `logger` instead of `console.log`
- [ ] Error handling is comprehensive
- [ ] Documentation updated (if needed)
- [ ] No linter errors
- [ ] Tests pass locally

## Screenshots (if applicable)
Add screenshots for UI changes

## Additional Notes
Any additional information for reviewers
```

### Review Process
1. At least one approving review required
2. All CI checks must pass
3. No unresolved conversations
4. Branch must be up to date with `main`

---

## Commit Message Guidelines

### Format
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
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples
```
feat(orders): add real-time order status updates

Implemented WebSocket connection for live order status.
Updates are pushed to all connected clients instantly.

Closes #123
```

```
fix(auth): resolve session persistence issue

Fixed bug where user sessions were not persisting across
page refreshes. Updated cookie storage implementation.

Fixes #456
```

```
docs(api): update API reference for orders endpoint

Added missing parameters and response types.
```

### Rules
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and PRs when applicable
- Explain **what** and **why**, not **how**

---

## Code Review Guidelines

### As a Reviewer
- Be constructive and respectful
- Explain the "why" behind suggestions
- Approve PRs that improve the codebase, even if not perfect
- Consider the bigger picture

### As a Contributor
- Respond to feedback promptly
- Don't take criticism personally
- Ask questions if feedback is unclear
- Push back politely if you disagree (with reasoning)

---

## Database Changes

### Migration Requirements
1. All schema changes must have migrations
2. Include both UP and DOWN migrations
3. Test migrations in local environment
4. Document breaking changes

### Creating Migrations
```bash
# Using Supabase CLI
supabase migration new add_new_table

# Edit the generated file in supabase/migrations/
# Test locally before committing
```

---

## Performance Considerations

### Guidelines
- Optimize database queries (use indexes)
- Minimize API calls
- Implement caching where appropriate
- Use pagination for large datasets
- Optimize images and assets
- Monitor bundle size

### Bundle Size
- Keep bundle size under control
- Use dynamic imports for large dependencies
- Analyze bundle with `pnpm run build`

---

## Security Guidelines

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Server-side validation is required
3. **Use RLS policies** - All Supabase tables should have RLS
4. **Sanitize user data** - Prevent XSS attacks
5. **Rate limiting** - Implement for public endpoints
6. **Authentication** - Verify user identity for protected routes

---

## Getting Help

### Resources
- [Documentation](./docs/README.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE_SCHEMA.md)

### Communication
- GitHub Issues - Bug reports and feature requests
- GitHub Discussions - Questions and ideas
- Pull Requests - Code contributions

---

## Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Project documentation

Thank you for contributing to Servio! 🎉

