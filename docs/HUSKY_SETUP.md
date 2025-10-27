# Husky Git Hooks Setup

## Overview

Husky manages Git hooks to ensure code quality before commits and pushes.

## Current Configuration

### Pre-commit Hook
**File**: `.husky/pre-commit`

Runs `lint-staged` to:
- Fix ESLint errors in staged files
- Format code with Prettier
- Only processes changed files (faster)

### Pre-push Hook
**File**: `.husky/pre-push`

Runs TypeScript type checking before push to catch type errors early.

## Setup

### Initial Setup

Already configured via `package.json`:
```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

Runs automatically on `pnpm install`.

### Manual Setup

If hooks aren't working:
```bash
pnpm install
# or
npx husky install
```

### Verify Setup

```bash
# Check hooks exist
ls -la .husky/

# Test pre-commit
echo "test" > test.ts
git add test.ts
git commit -m "test"  # Should run lint-staged

# Test pre-push
git push  # Should run typecheck
```

## Configuration

### Lint-Staged

Configured in `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix"],
    "*.{js,jsx,css,md,json}": ["prettier -w"]
  }
}
```

### Customizing Hooks

**Add test to pre-commit**:
```bash
echo "pnpm test" >> .husky/pre-commit
```

**Disable pre-push** (not recommended):
```bash
echo "# Disabled" > .husky/pre-push
```

## Troubleshooting

### Hooks Not Running

1. **Check Husky is installed**:
   ```bash
   test -d .husky && echo "✅ Installed" || echo "❌ Missing"
   ```

2. **Reinstall hooks**:
   ```bash
   npx husky install
   ```

3. **Check file permissions**:
   ```bash
   chmod +x .husky/pre-commit
   chmod +x .husky/pre-push
   ```

### Bypassing Hooks (Emergency Only)

```bash
# Skip pre-commit
git commit --no-verify -m "emergency fix"

# Skip pre-push
git push --no-verify
```

**⚠️ Warning**: Only use in emergencies. CI will catch issues.

### Common Issues

**"husky: command not found"**
- Run `pnpm install` to set up Husky

**"Permission denied"**
- Run `chmod +x .husky/pre-commit .husky/pre-push`

**"lint-staged: command not found"**
- Run `pnpm install` to install dependencies

## Best Practices

### ✅ Do
- Let hooks run automatically
- Fix lint errors before committing
- Keep hooks fast (< 10 seconds)

### ❌ Don't
- Skip hooks regularly
- Add slow operations (full test suite)
- Commit with `--no-verify` unless emergency

## Adding New Hooks

**Example: Check for TODO comments**:
```bash
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Check for TODO in staged files
if git diff --cached --name-only | xargs grep -l "TODO"; then
  echo "⚠️  Found TODO comments in staged files"
  exit 1
fi
EOF

chmod +x .husky/pre-commit
```

## CI Integration

Hooks complement CI/CD:
- **Hooks**: Fast checks, developer feedback
- **CI**: Full test suite, deployment checks

Both should pass for quality code.

