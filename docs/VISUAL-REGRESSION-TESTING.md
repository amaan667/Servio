# Visual Regression Testing

This document describes the visual regression testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Tools](#tools)
3. [Setup](#setup)
4. [Configuration](#configuration)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Overview

Visual regression testing ensures that UI changes don't unintentionally affect the visual appearance of the application. This helps:

- **Catch Visual Bugs**: Detect unintended visual changes
- **Maintain Consistency**: Ensure consistent UI across updates
- **Improve Quality**: Deliver polished user experience
- **Reduce Manual Testing**: Automate visual QA

## Tools

### Percy

Percy is a cloud-based visual testing platform.

**Pros:**
- Easy setup
- Cloud-based storage
- Smart diffing
- Team collaboration features

**Cons:**
- Paid service
- Limited free tier
- Requires internet connection

### Chromatic

Chromatic is a visual testing platform for Storybook.

**Pros:**
- Integrates with Storybook
- Great for component testing
- Free for open source
- Good documentation

**Cons:**
- Primarily for Storybook
- Paid for private projects

### Playwright

Playwright has built-in visual regression testing.

**Pros:**
- Free and open source
- No external dependencies
- Fast and reliable
- Cross-browser support

**Cons:**
- Requires more setup
- No cloud storage
- Manual review process

## Setup

### Option 1: Percy

#### Installation

```bash
npm install --save-dev @percy/cli @percy/playwright
```

#### Configuration

```javascript
// percy.config.js
module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 768, 1024, 1440],
    minHeight: 1024,
    percyCSS: '.hide-in-percy { display: none; }',
  },
  discovery: {
    allowedHostnames: ['localhost', 'servio.com'],
  },
};
```

#### Usage

```typescript
// __tests__/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';
import { PercyService } from '@percy/playwright';

const percy = new PercyService();

test.describe('Homepage Visual Tests', () => {
  test.beforeAll(async () => {
    await percy.start();
  });

  test.afterAll(async () => {
    await percy.stop();
  });

  test('homepage visual regression', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    await percy.snapshot(page, 'Homepage');
  });

  test('homepage mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    await percy.snapshot(page, 'Homepage - Mobile');
  });
});
```

### Option 2: Chromatic

#### Installation

```bash
npx storybook@latest init
npm install --save-dev chromatic
```

#### Configuration

```javascript
// .storybook/main.js
module.exports = {
  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
};
```

#### Usage

```typescript
// components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Click me',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
    disabled: true,
  },
};
```

#### Run Chromatic

```bash
# Build Storybook
npm run build-storybook

# Run Chromatic
npx chromatic --project-token=<your-project-token>
```

### Option 3: Playwright Native

#### Installation

```bash
npm install --save-dev @playwright/test
```

#### Configuration

```javascript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
});
```

#### Usage

```typescript
// __tests__/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Homepage Visual Tests', () => {
  test('homepage visual regression', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('homepage mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('order page visual regression', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('orders.png');
  });
});
```

## Configuration

### Percy Configuration

```javascript
// percy.config.js
module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 768, 1024, 1440],
    minHeight: 1024,
    percyCSS: `
      /* Hide dynamic elements */
      .hide-in-percy { display: none; }
      [data-testid="loading-spinner"] { display: none; }
      [data-testid="skeleton"] { display: none; }

      /* Stabilize animations */
      * { animation-duration: 0s !important; transition-duration: 0s !important; }

      /* Stabilize fonts */
      * { font-display: swap; }
    `,
  },
  discovery: {
    allowedHostnames: ['localhost', 'servio.com'],
    networkIdleTimeout: 100,
  },
  agent: {
    assetDiscovery: 'network',
    concurrency: 3,
  },
};
```

### Chromatic Configuration

```javascript
// chromatic.config.js
module.exports = {
  projectToken: process.env.CHROMATIC_PROJECT_TOKEN,
  autoAcceptChanges: 'master',
  exitZeroOnChanges: true,
  exitOnceUploaded: true,
  buildScriptName: 'build-storybook',
  storybookBuildDir: 'storybook-static',
  onlyStoryFiles: ['**/*.stories.@(js|jsx|ts|tsx)'],
  ignoreLastBuildOnBranch: 'master',
};
```

### Playwright Configuration

```javascript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Visual regression settings
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  expect: {
    // Visual regression settings
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
```

## Writing Tests

### Page-Level Tests

```typescript
// __tests__/visual/pages.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Page Visual Tests', () => {
  test('dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('orders page', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('orders.png');
  });

  test('menu page', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('menu.png');
  });

  test('kitchen display system', async ({ page }) => {
    await page.goto('/kds');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('kds.png');
  });
});
```

### Component-Level Tests

```typescript
// __tests__/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Component Visual Tests', () => {
  test('button component', async ({ page }) => {
    await page.goto('/components/button');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('button.png');
  });

  test('card component', async ({ page }) => {
    await page.goto('/components/card');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('card.png');
  });

  test('table component', async ({ page }) => {
    await page.goto('/components/table');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('table.png');
  });
});
```

### Interactive Tests

```typescript
// __tests__/visual/interactive.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Interactive Visual Tests', () => {
  test('order creation flow', async ({ page }) => {
    await page.goto('/orders/new');
    await page.waitForLoadState('networkidle');

    // Initial state
    await expect(page).toHaveScreenshot('order-new-initial.png');

    // Fill form
    await page.fill('[name="customerName"]', 'John Doe');
    await page.fill('[name="customerEmail"]', 'john@example.com');

    // After filling
    await expect(page).toHaveScreenshot('order-new-filled.png');

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Success state
    await expect(page).toHaveScreenshot('order-new-success.png');
  });

  test('menu item selection', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Initial state
    await expect(page).toHaveScreenshot('menu-initial.png');

    // Select category
    await page.click('button:has-text("Burgers")');
    await page.waitForLoadState('networkidle');

    // After category selection
    await expect(page).toHaveScreenshot('menu-burgers.png');

    // Add item to cart
    await page.click('button:has-text("Add to Cart")');
    await page.waitForLoadState('networkidle');

    // After adding to cart
    await expect(page).toHaveScreenshot('menu-with-cart.png');
  });
});
```

### Responsive Tests

```typescript
// __tests__/visual/responsive.spec.ts
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'wide', width: 1920, height: 1080 },
];

test.describe('Responsive Visual Tests', () => {
  for (const viewport of viewports) {
    test(`homepage - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`homepage-${viewport.name}.png`);
    });
  }
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-tests:
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

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm run start &
        env:
          PORT: 3000

      - name: Wait for application
        run: npx wait-on http://localhost:3000

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run visual tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: test-results/
```

### Percy CI Integration

```yaml
# .github/workflows/percy.yml
name: Percy Visual Tests

on:
  pull_request:
    branches: [main]

jobs:
  percy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm run start &
        env:
          PORT: 3000

      - name: Wait for application
        run: npx wait-on http://localhost:3000

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Percy tests
        run: npx percy exec -- npx playwright test
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

### Chromatic CI Integration

```yaml
# .github/workflows/chromatic.yml
name: Chromatic Visual Tests

on:
  pull_request:
    branches: [main]

jobs:
  chromatic:
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

      - name: Build Storybook
        run: npm run build-storybook

      - name: Publish to Chromatic
        run: npx chromatic --project-token=${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

## Best Practices

### 1. Stabilize Dynamic Content

Hide or stabilize dynamic elements:

```typescript
// Hide dynamic elements
await page.addStyleTag({
  content: `
    .hide-in-tests { display: none; }
    [data-testid="loading-spinner"] { display: none; }
    [data-testid="skeleton"] { display: none; }
  `,
});

// Stabilize animations
await page.addStyleTag({
  content: `
    * { animation-duration: 0s !important; transition-duration: 0s !important; }
  `,
});

// Stabilize fonts
await page.addStyleTag({
  content: `
    * { font-display: swap; }
  `,
});
```

### 2. Wait for Stability

Ensure page is stable before taking screenshots:

```typescript
// Wait for network idle
await page.waitForLoadState('networkidle');

// Wait for specific element
await page.waitForSelector('[data-testid="loaded"]');

// Wait for custom condition
await page.waitForFunction(() => {
  return window.appReady === true;
});
```

### 3. Use Descriptive Names

Use descriptive names for screenshots:

```typescript
// Good
await expect(page).toHaveScreenshot('homepage-primary-button.png');
await expect(page).toHaveScreenshot('order-form-validation-error.png');

// Bad
await expect(page).toHaveScreenshot('screenshot1.png');
await expect(page).toHaveScreenshot('test.png');
```

### 4. Test Multiple Viewports

Test on multiple screen sizes:

```typescript
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await expect(page).toHaveScreenshot(`page-${viewport.name}.png`);
}
```

### 5. Configure Thresholds

Configure appropriate thresholds for differences:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  maxDiffPixels: 100,
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
});
```

### 6. Ignore Specific Areas

Ignore specific areas that change frequently:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="random-id"]'),
  ],
});
```

### 7. Review Changes Regularly

Review visual changes regularly to prevent drift:

```bash
# Run visual tests locally
npm run test:visual

# Review changes in CI
# Check Percy/Chromatic dashboard
```

### 8. Update Baselines

Update baselines only for intentional changes:

```bash
# Update baselines
npx playwright test --update-snapshots

# Or for specific tests
npx playwright test --update-snapshots homepage.spec.ts
```

## References

- [Percy Documentation](https://docs.percy.io/)
- [Chromatic Documentation](https://www.chromatic.com/docs)
- [Playwright Visual Regression](https://playwright.dev/docs/test-snapshots)
- [Visual Regression Testing Best Practices](https://www.smashingmagazine.com/2022/01/visual-regression-testing/)
