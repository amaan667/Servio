# Contributing to Servio

Thank you for your interest in contributing to Servio! This document provides guidelines and best practices for contributing to the codebase.

## 🎯 Code Quality Standards

### Type Safety
- ✅ **Zero `any` types** - Use proper TypeScript interfaces and types
- ✅ Use `unknown` for truly dynamic data, then narrow with type guards
- ✅ Define interfaces for all data structures
- ✅ Use proper generics instead of type assertions

### Code Organization
- ✅ **DRY Principle** - Extract common logic into shared hooks/utilities
- ✅ **Single Responsibility** - Each component/function does one thing well
- ✅ **Feature-based Structure** - Group related files together

### Error Handling
- ✅ Use try-catch blocks for async operations
- ✅ Always log errors with proper context
- ✅ Provide user-friendly error messages
- ✅ Use error boundaries for React components

### Testing
- ✅ Write tests for all critical paths
- ✅ Integration tests for API routes
- ✅ Unit tests for hooks and utilities
- ✅ E2E tests for user flows

## 📁 File Structure

```
app/
  dashboard/[venueId]/
    hooks/            # Shared hooks (usePageAuth, etc.)
    components/       # Reusable UI components
    [feature]/        # Feature-specific pages
      page.tsx        # Server component (minimal)
      page.client.tsx # Client component (auth + rendering)
      [Feature]Client.tsx # Main feature component

components/           # Global shared components
  error-boundaries/   # Error boundary components
  ui/                 # Shadcn UI components

lib/                  # Utilities and services
  supabase/           # Supabase client factory
  monitoring/         # Performance and error monitoring
  api/                # API helpers

__tests__/            # Test files (mirrors app structure)
```

## 🔧 Development Workflow

### 1. Before Starting
```bash
git pull origin main
npm install
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes
- Write code following the standards above
- Add tests for new functionality
- Update types if needed

### 4. Run Tests
```bash
npm run test        # Unit tests
npm run test:e2e    # E2E tests
npm run lint        # Linting
npm run type-check  # TypeScript checks
```

### 5. Commit
```bash
git add .
git commit -m "feat: description of your changes"
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `test:` Adding tests
- `docs:` Documentation updates
- `chore:` Maintenance tasks

### 6. Push and Create PR
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🧪 Testing Guidelines

### Unit Tests
```typescript
// Good: Test specific functionality
it("should calculate total correctly", () => {
  expect(calculateTotal([10, 20, 30])).toBe(60);
});
```

### Integration Tests
```typescript
// Good: Test complete flows
it("should create order and update inventory", async () => {
  const order = await createOrder(testData);
  const inventory = await getInventory();
  expect(inventory.quantity).toBeLessThan(originalQuantity);
});
```

### E2E Tests
```typescript
// Good: Test user journeys
it("should complete full checkout flow", async ({ page }) => {
  await page.goto("/order?venue=test-venue");
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  expect(await page.locator('[data-testid="success"]')).toBeVisible();
});
```

## 🎨 Component Guidelines

### Use Shared Hooks
```typescript
// ✅ Good: Use shared auth hook
import { usePageAuth } from "../hooks/usePageAuth";

function MyPage({ venueId }) {
  const { user, userRole, loading } = usePageAuth({
    venueId,
    pageName: "My Feature",
    requiredRoles: ["owner", "manager"],
  });
}
```

```typescript
// ❌ Bad: Duplicate auth logic
function MyPage({ venueId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ... 100 lines of auth code
}
```

### Error Boundaries
```typescript
// ✅ Good: Wrap features in error boundaries
import { FeatureErrorBoundary } from "@/components/error-boundaries/FeatureErrorBoundary";

<FeatureErrorBoundary featureName="Analytics">
  <AnalyticsClient venueId={venueId} />
</FeatureErrorBoundary>
```

### Type-Safe Components
```typescript
// ✅ Good: Proper interface definition
interface MenuItemProps {
  item: {
    id: string;
    name: string;
    price: number;
    category: string;
  };
  onSelect: (id: string) => void;
}

function MenuItem({ item, onSelect }: MenuItemProps) {
  // ...
}
```

## 🚀 Performance Best Practices

### Use Performance Monitoring
```typescript
import { performanceMonitor } from "@/lib/monitoring/performance-wrapper";

async function loadDashboard() {
  return performanceMonitor.measure("dashboard-load", async () => {
    // ... expensive operation
  });
}
```

### Optimize Database Queries
```typescript
// ✅ Good: Select only needed fields
.select("id, name, price")

// ❌ Bad: Select everything
.select("*")
```

### Use Caching
```typescript
import { cache } from "@/lib/cache";

const result = await cache.get(cacheKey);
if (result) return result;

const data = await expensiveOperation();
await cache.set(cacheKey, data, { ttl: 300 });
```

## 📝 Documentation

- Add JSDoc comments for exported functions
- Document complex algorithms
- Keep README.md updated
- Add inline comments for non-obvious code

## ⚠️ Common Pitfalls to Avoid

1. **Don't use `any` types** - Always use proper types
2. **Don't duplicate auth logic** - Use shared hooks
3. **Don't skip error handling** - Always handle errors gracefully
4. **Don't commit without tests** - Test critical paths
5. **Don't ignore console warnings** - Fix them before committing

## 🤝 Getting Help

- Check existing code for patterns
- Review test files for examples
- Ask in team chat
- Create draft PR for feedback

## 📊 Code Quality Checklist

Before submitting PR:
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] All tests passing
- [ ] Added tests for new code
- [ ] No `any` types
- [ ] Error handling in place
- [ ] Performance considered
- [ ] Documentation updated

---

**Thank you for contributing to Servio!** 🎉

