# Mutation Testing

This document describes the mutation testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Benefits](#benefits)
3. [Tools](#tools)
4. [Setup](#setup)
5. [Configuration](#configuration)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Overview

Mutation testing evaluates the quality of test suites by introducing small changes (mutations) to the code and checking if tests detect them. This helps:

- **Measure Test Quality**: Assess test effectiveness
- **Find Weak Tests**: Identify tests that don't catch bugs
- **Improve Coverage**: Go beyond code coverage metrics
- **Build Confidence**: Trust in test suite

## Benefits

### For Development Teams
- **Better Tests**: Identify and improve weak tests
- **Higher Quality**: Catch more bugs before production
- **Faster Debugging**: Understand test effectiveness

### For Quality Assurance
- **Objective Metrics**: Quantify test quality
- **Continuous Improvement**: Track test quality over time
- **Risk Assessment**: Identify untested code paths

## Tools

### Stryker

Stryker is a mutation testing framework for JavaScript and TypeScript.

**Pros:**
- Supports multiple languages
- Good documentation
- Integrates with CI/CD
- Rich reporting

**Cons:**
- Can be slow on large codebases
- Requires configuration

### Jest-Mutation

Jest-Mutation is a mutation testing plugin for Jest.

**Pros:**
- Easy to use with Jest
- Fast execution
- Simple setup

**Cons:**
- Jest-specific
- Limited features

### Mutant

Mutant is a mutation testing tool for various languages.

**Pros:**
- Multi-language support
- Fast execution
- Good reporting

**Cons:**
- Less popular than Stryker
- Smaller community

## Setup

### Stryker Installation

```bash
# Install Stryker
npm install --save-dev @stryker-mutator/core @stryker-mutator/typescript

# Install reporters
npm install --save-dev @stryker-mutator/jest-runner @stryker-mutator/html-reporter

# Install mutators
npm install --save-dev @stryker-mutator/javascript-mutator @stryker-mutator/typescript-mutator
```

### Stryker Configuration

```javascript
// stryker.conf.js
module.exports = {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  mutate: [
    'lib/**/*.ts',
    'lib/**/*.tsx',
    'app/**/*.ts',
    'app/**/*.tsx',
  ],
  mutator: 'typescript',
  testRunner: 'jest',
  testRunnerComment: 'Add your custom Jest config here',
  reporters: ['html', 'progress', 'clear-text'],
  coverageAnalysis: 'perTest',
  jest: {
    projectType: 'custom',
    config: {
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/*.test.ts', '**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    },
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 60,
  },
  maxConcurrentTestRunners: 2,
  timeoutMS: 60000,
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
};
```

## Configuration

### Mutation Types

Stryker supports various mutation types:

```javascript
// stryker.conf.js
module.exports = {
  // ... other config
  mutator: 'typescript',
  tsconfigFile: 'tsconfig.json',
  // Enable/disable specific mutations
  mutate: [
    'lib/**/*.ts',
  ],
  // Exclude specific mutation types
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
  ],
  // Custom mutation thresholds
  thresholds: {
    high: 80,    // 80% mutation score is high quality
    low: 60,     // 60% mutation score is low quality
    break: 60,   // Fail build if below 60%
  },
};
```

### Mutation Operators

Configure which mutation operators to use:

```javascript
// stryker.conf.js
module.exports = {
  // ... other config
  // Enable specific mutation operators
  mutationOperators: [
    'ArithmeticOperator',
    'EqualityOperator',
    'LogicalOperator',
    'UnaryOperator',
    'BlockStatement',
    'ConditionalExpression',
    'ArrayLiteral',
    'ObjectLiteral',
    'StringLiteral',
    'BooleanLiteral',
    'UpdateOperator',
  ],
  // Disable specific mutation operators
  excludedMutations: [
    'StringLiteral',  // Disable string mutations
    'BooleanLiteral', // Disable boolean mutations
  ],
};
```

### Test Filtering

Filter which tests to run for each mutant:

```javascript
// stryker.conf.js
module.exports = {
  // ... other config
  coverageAnalysis: 'perTest', // Run only relevant tests per mutant
  // Alternative: 'all' - Run all tests for each mutant
  // Alternative: 'off' - Run all tests once for all mutants
};
```

## Writing Mutation-Resistant Tests

### 1. Test All Code Paths

Ensure tests cover all branches and conditions:

```typescript
// Good: Tests all code paths
describe('calculateDiscount', () => {
  it('applies 10% discount for orders over $100', () => {
    const result = calculateDiscount(150);
    expect(result).toBe(135); // 150 - 10%
  });

  it('applies 5% discount for orders over $50', () => {
    const result = calculateDiscount(75);
    expect(result).toBe(71.25); // 75 - 5%
  });

  it('applies no discount for orders under $50', () => {
    const result = calculateDiscount(25);
    expect(result).toBe(25); // No discount
  });
});

// Bad: Only tests one code path
describe('calculateDiscount', () => {
  it('applies discount', () => {
    const result = calculateDiscount(150);
    expect(result).toBeLessThan(150);
  });
});
```

### 2. Test Edge Cases

Test boundary conditions and edge cases:

```typescript
// Good: Tests edge cases
describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

// Bad: Only tests happy path
describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});
```

### 3. Test Error Conditions

Test error handling and failure scenarios:

```typescript
// Good: Tests error conditions
describe('createOrder', () => {
  it('creates order with valid data', async () => {
    const order = await createOrder(validOrderData);
    expect(order).toBeDefined();
  });

  it('throws error with missing customer name', async () => {
    await expect(
      createOrder({ ...validOrderData, customerName: '' })
    ).rejects.toThrow('Customer name is required');
  });

  it('throws error with invalid email', async () => {
    await expect(
      createOrder({ ...validOrderData, customerEmail: 'invalid' })
    ).rejects.toThrow('Invalid email address');
  });

  it('throws error with empty items', async () => {
    await expect(
      createOrder({ ...validOrderData, items: [] })
    ).rejects.toThrow('Order must have at least one item');
  });
});

// Bad: Only tests success case
describe('createOrder', () => {
  it('creates order', async () => {
    const order = await createOrder(validOrderData);
    expect(order).toBeDefined();
  });
});
```

### 4. Use Specific Assertions

Use specific assertions instead of generic ones:

```typescript
// Good: Specific assertions
describe('calculateTotal', () => {
  it('calculates total correctly', () => {
    const total = calculateTotal([
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3 },
    ]);
    expect(total).toBe(35); // 10*2 + 5*3 = 35
  });
});

// Bad: Generic assertions
describe('calculateTotal', () => {
  it('calculates total', () => {
    const total = calculateTotal([
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3 },
    ]);
    expect(total).toBeDefined();
    expect(total).toBeGreaterThan(0);
  });
});
```

### 5. Test Return Values

Test actual return values, not just side effects:

```typescript
// Good: Tests return value
describe('formatCurrency', () => {
  it('formats currency correctly', () => {
    const result = formatCurrency(1234.56);
    expect(result).toBe('$1,234.56');
  });
});

// Bad: Only tests side effect
describe('formatCurrency', () => {
  it('formats currency', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    formatCurrency(1234.56);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/mutation-tests.yml
name: Mutation Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 5 * * *' # Run daily at 5 AM

jobs:
  mutation-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run mutation tests
        run: npx stryker run

      - name: Upload mutation report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: mutation-report
          path: reports/mutation/html

      - name: Comment PR with mutation score
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('reports/mutation/mutation-report.json', 'utf8'));
            const score = report.mutationScore;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Mutation Test Results\n\n**Mutation Score**: ${score}%\n\n${score >= 80 ? '✅ Good test quality' : '⚠️ Consider improving tests'}`
            });
```

### GitLab CI

```yaml
# .gitlab-ci.yml
mutation-tests:
  stage: test
  image: node:18
  script:
    - npm ci
    - npx stryker run
  artifacts:
    paths:
      - reports/mutation/html
    reports:
      mutation: reports/mutation/mutation-report.json
  only:
    - merge_requests
    - main
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
  agent any
  stages {
    stage('Mutation Tests') {
      steps {
        sh 'npm ci'
        sh 'npx stryker run'
        publishHTML(target: [
          reportDir: 'reports/mutation/html',
          reportFiles: 'index.html',
          reportName: 'Mutation Report'
        ])
      }
    }
  }
}
```

## Best Practices

### 1. Set Realistic Thresholds

Set achievable but challenging thresholds:

```javascript
// Good: Realistic thresholds
thresholds: {
  high: 80,    // 80% is achievable
  low: 60,     // 60% is minimum acceptable
  break: 60,   // Fail if below 60%
}

// Bad: Unrealistic thresholds
thresholds: {
  high: 100,   // 100% is nearly impossible
  low: 95,     // 95% is very difficult
  break: 95,    // Will always fail
}
```

### 2. Run Regularly

Run mutation tests regularly:

```yaml
# Run on every PR
on:
  pull_request:
    branches: [main]

# Run daily
on:
  schedule:
    - cron: '0 5 * * *'

# Run on main branch
on:
  push:
    branches: [main]
```

### 3. Focus on Critical Code

Focus mutation testing on critical code:

```javascript
// Good: Focus on critical code
mutate: [
  'lib/services/**/*.ts',  // Business logic
  'lib/api/**/*.ts',       // API handlers
  'lib/utils/**/*.ts',      // Utility functions
]

// Bad: Test everything
mutate: [
  '**/*.ts',  // Includes tests, mocks, etc.
]
```

### 4. Exclude Test Files

Exclude test files from mutation:

```javascript
// Good: Exclude test files
ignorePatterns: [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/dist/**',
]

// Bad: Include test files
mutate: [
  '**/*.ts',  // Will mutate tests too
]
```

### 5. Use Per-Test Coverage

Use per-test coverage for faster execution:

```javascript
// Good: Per-test coverage
coverageAnalysis: 'perTest',  // Run only relevant tests

// Bad: Run all tests
coverageAnalysis: 'all',  // Run all tests for each mutant
```

### 6. Review Surviving Mutants

Review and fix surviving mutants:

```javascript
// stryker.conf.js
module.exports = {
  // ... other config
  // Generate detailed report
  reporters: ['html', 'clear-text', 'json'],
  // Show surviving mutants
  htmlReporter: {
    baseDir: 'reports/mutation/html',
  },
};
```

### 7. Incremental Improvement

Improve mutation score incrementally:

```javascript
// Week 1: Set low threshold
thresholds: {
  high: 60,
  low: 40,
  break: 40,
}

// Week 2: Increase threshold
thresholds: {
  high: 70,
  low: 50,
  break: 50,
}

// Week 3: Increase further
thresholds: {
  high: 80,
  low: 60,
  break: 60,
}
```

### 8. Document Findings

Document mutation test findings:

```markdown
# Mutation Test Results - 2024-01-15

## Overall Score: 75%

## Surviving Mutants

### lib/services/OrderService.ts
- **Line 45**: `>=` mutated to `>` - Not detected
  - **Reason**: Test doesn't check boundary condition
  - **Fix**: Add test for exact boundary value

### lib/utils/formatCurrency.ts
- **Line 23**: `toFixed(2)` mutated to `toFixed(1)` - Not detected
  - **Reason**: Test doesn't verify decimal places
  - **Fix**: Add test for decimal precision

## Recommendations
1. Add boundary condition tests for OrderService
2. Add precision tests for formatCurrency
3. Increase mutation score to 80% by next sprint
```

### 9. Use Mutation Testing as Learning Tool

Use mutation testing to learn about code:

```typescript
// Before mutation testing
function calculateDiscount(amount: number): number {
  if (amount > 100) return amount * 0.9;
  if (amount > 50) return amount * 0.95;
  return amount;
}

// After mutation testing - discovered missing test
describe('calculateDiscount', () => {
  it('handles exact boundary at 100', () => {
    expect(calculateDiscount(100)).toBe(100); // No discount
  });

  it('handles exact boundary at 50', () => {
    expect(calculateDiscount(50)).toBe(50); // No discount
  });
});
```

### 10. Balance Quality and Speed

Balance mutation testing quality with execution speed:

```javascript
// For CI: Fast execution
module.exports = {
  coverageAnalysis: 'perTest',
  maxConcurrentTestRunners: 4,
  timeoutMS: 30000,
};

// For local: Detailed analysis
module.exports = {
  coverageAnalysis: 'all',
  maxConcurrentTestRunners: 2,
  timeoutMS: 60000,
};
```

## References

- [Stryker Documentation](https://stryker-mutator.io/docs/)
- [Mutation Testing Best Practices](https://stryker-mutator.io/docs/stryker/guides/mutation-testing-101)
- [Mutation Testing Principles](https://www.mutation-testing.org/)
- [Test Quality Metrics](https://martinfowler.com/articles/practical-test-pyramid.html)
