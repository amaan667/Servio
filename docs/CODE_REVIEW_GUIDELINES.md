# Code Review Guidelines

This document outlines the standards and practices for code reviews in the Servio codebase.

## 🎯 Principles

1. **Be Respectful**: Code reviews are about the code, not the person
2. **Be Constructive**: Suggest improvements, don't just point out problems
3. **Be Timely**: Review PRs within 24 hours
4. **Be Thorough**: Check functionality, tests, documentation, and style

## ✅ What to Review

### Functionality
- [ ] Does the code do what it's supposed to?
- [ ] Are edge cases handled?
- [ ] Are error cases handled?
- [ ] Is the implementation efficient?

### Code Quality
- [ ] Is the code readable and maintainable?
- [ ] Are there any code smells?
- [ ] Is the code DRY (Don't Repeat Yourself)?
- [ ] Are naming conventions followed?

### Type Safety
- [ ] No `any` types (use `unknown` if needed)
- [ ] Proper TypeScript types
- [ ] Zod validation for runtime safety
- [ ] Type-safe API responses

### Testing
- [ ] Are there tests for new features?
- [ ] Do tests cover edge cases?
- [ ] Are tests maintainable?
- [ ] Do tests pass?

### Security
- [ ] Input validation
- [ ] Authentication/authorization checks
- [ ] No sensitive data exposure
- [ ] Rate limiting where needed

### Performance
- [ ] No unnecessary re-renders
- [ ] Efficient database queries
- [ ] Proper caching
- [ ] Bundle size considerations

### Documentation
- [ ] Code comments where needed
- [ ] Updated README/docs
- [ ] API documentation updated
- [ ] Clear commit messages

## 📋 Review Checklist

### For New Features

- [ ] Feature works as described
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Follows existing patterns
- [ ] Error handling implemented
- [ ] Type-safe implementation

### For Bug Fixes

- [ ] Bug is fixed
- [ ] Root cause addressed
- [ ] Tests added to prevent regression
- [ ] No new bugs introduced
- [ ] Edge cases considered

### For Refactoring

- [ ] Functionality unchanged
- [ ] Tests still pass
- [ ] Code is cleaner/more maintainable
- [ ] Performance not degraded
- [ ] Documentation updated if needed

## 🚫 Common Issues to Flag

### Type Safety Violations

```typescript
// ❌ Bad
const data: any = await fetchData();

// ✅ Good
const data: ApiResponse = await fetchData();
```

### Missing Error Handling

```typescript
// ❌ Bad
const result = await apiCall();

// ✅ Good
try {
  const result = await apiCall();
} catch (error) {
  logger.error('API call failed', { error });
  throw error;
}
```

### Console.log in Production

```typescript
// ❌ Bad
console.log('Debug info', data);

// ✅ Good
logger.debug('Debug info', { data });
```

### Missing Tests

```typescript
// ❌ Bad - No tests
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ Good - Has tests
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
// __tests__/utils/calculateTotal.test.ts
```

### Inconsistent Patterns

- Follow existing patterns in the codebase
- Use established utilities and helpers
- Don't reinvent the wheel

## 💬 Review Comments

### How to Comment

1. **Be Specific**: Point to exact lines and explain why
2. **Suggest Solutions**: Don't just say "this is wrong"
3. **Use Examples**: Show what you mean
4. **Be Positive**: Acknowledge good work too

### Comment Types

- **Must Fix**: Blocking issues that must be addressed
- **Should Fix**: Important but not blocking
- **Nice to Have**: Suggestions for improvement
- **Question**: Ask for clarification

### Example Comments

```typescript
// ❌ Bad comment
"This is wrong"

// ✅ Good comment
"Consider using the existing `withErrorHandling` wrapper here for consistent error handling. See `lib/api/handler-wrapper.ts` for an example."
```

## 🔄 Review Process

1. **Author Creates PR**
   - Fills out PR template
   - Links related issues
   - Adds reviewers

2. **Reviewer Reviews**
   - Checks all items in checklist
   - Leaves comments
   - Approves or requests changes

3. **Author Addresses Feedback**
   - Responds to comments
   - Makes requested changes
   - Marks comments as resolved

4. **Re-review if Needed**
   - Reviewer checks changes
   - Approves when satisfied

5. **Merge**
   - Squash and merge (preferred)
   - Delete branch after merge

## 📏 Code Standards

### TypeScript

- Strict mode enabled
- No `any` types
- Proper type definitions
- Use Zod for runtime validation

### Naming

- **Variables**: `camelCase`
- **Functions**: `camelCase`
- **Components**: `PascalCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### File Organization

- One component per file
- Co-locate related files
- Use index files for exports
- Group by feature, not type

### Error Handling

- Use error handling wrappers
- Log errors appropriately
- Return proper error responses
- Don't swallow errors

### Testing

- Test happy paths
- Test error cases
- Test edge cases
- Mock external dependencies
- Aim for 80%+ coverage

## 🎓 Learning from Reviews

### For Authors

- Don't take feedback personally
- Ask questions if unclear
- Learn from suggestions
- Apply patterns to future code

### For Reviewers

- Explain the "why"
- Share knowledge
- Be patient with questions
- Recognize good work

## 🚀 Quick Reference

### Approval Criteria

✅ Approve if:
- Code works correctly
- Tests pass
- Follows standards
- Documentation updated
- No security issues

❌ Request Changes if:
- Functionality broken
- Tests missing/failing
- Security concerns
- Major style issues
- Breaking changes not documented

### Common Patterns

- **API Routes**: Use `withErrorHandling` wrapper
- **Auth**: Use `withUnifiedAuth` middleware
- **Validation**: Use Zod schemas
- **Logging**: Use `logger` from `@/lib/logger`
- **Errors**: Use error helpers from `@/lib/api/response-helpers`

## 📚 Resources

- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [React Best Practices](https://react.dev/learn)
- [Next.js Guidelines](https://nextjs.org/docs)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

Remember: Code reviews are a team effort to maintain quality and share knowledge. Be kind, be thorough, and keep learning! 🚀


