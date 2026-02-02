# Load Testing

This document describes the load testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Tools](#tools)
3. [Setup](#setup)
4. [Writing Tests](#writing-tests)
5. [Scenarios](#scenarios)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Overview

Load testing evaluates system performance under expected and peak load conditions. This helps:

- **Identify Bottlenecks**: Find performance limitations
- **Ensure Scalability**: Verify system can handle growth
- **Plan Capacity**: Determine infrastructure needs
- **Prevent Outages**: Catch issues before production

## Tools

### k6

k6 is a modern load testing tool with JavaScript scripting.

**Pros:**
- JavaScript-based scripting
- Good documentation
- Cloud and local execution
- Integrates with CI/CD

**Cons:**
- Limited browser support
- Steeper learning curve for complex scenarios

### Artillery

Artillery is a load testing toolkit for Node.js.

**Pros:**
- Easy to use
- Good for HTTP testing
- Cloud service available

**Cons:**
- Limited to HTTP/WebSocket
- Less flexible than k6

### Locust

Locust is a Python-based load testing tool.

**Pros:**
- Python scripting
- Web UI for monitoring
- Distributed testing support

**Cons:**
- Python required
- Less modern than k6

## Setup

### k6 Installation

```bash
# macOS
brew install k6

# Linux
sudo gpg -k \
  C5AD17C747E3415A3642D57D77C6C491D6AC1D69 \
  | sudo apt-key add -
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6:latest
```

### k6 Configuration

```javascript
// k6.config.js
export const options = {
  // Thresholds
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>100'],
  },

  // Scenarios
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
    },
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};
```

## Writing Tests

### Basic API Test

```javascript
// __tests__/load/api/basic.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### Order Creation Test

```javascript
// __tests__/load/api/orders.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  // Create test user and get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = loginRes.json('token');
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Create order
  const orderRes = http.post(`${BASE_URL}/api/orders`, JSON.stringify({
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    items: [
      {
        menuItemId: 'menu_123',
        quantity: 2,
      },
    ],
  }), { headers });

  check(orderRes, {
    'order created': (r) => r.status === 201,
    'order has ID': (r) => r.json('data.id') !== undefined,
  });

  sleep(1);
}

export function teardown(data) {
  // Cleanup test data
  http.del(`${BASE_URL}/api/test/cleanup`, null, {
    headers: { 'Authorization': `Bearer ${data.token}` },
  });
}
```

### Menu Browsing Test

```javascript
// __tests__/load/api/menu.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    browse_menu: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Get menu categories
  const categoriesRes = http.get(`${BASE_URL}/api/menu/categories`);

  check(categoriesRes, {
    'categories loaded': (r) => r.status === 200,
  });

  if (categoriesRes.status === 200) {
    const categories = categoriesRes.json('data');

    // Get items for a random category
    if (categories.length > 0) {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const itemsRes = http.get(`${BASE_URL}/api/menu/categories/${randomCategory.id}/items`);

      check(itemsRes, {
        'items loaded': (r) => r.status === 200,
      });
    }
  }

  sleep(Math.random() * 2);
}
```

### WebSocket Test

```javascript
// __tests__/load/websocket/kds.js
import ws from 'k6/ws';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'ws://localhost:3000';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    ws_connecting: ['rate<0.05'],
    ws_msgs_received: ['rate>10'],
  },
};

export default function () {
  const url = `${BASE_URL}/ws/kds`;
  const params = { tags: { name: 'KDSWebSocket' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      console.log('WebSocket connected');
    });

    socket.on('message', (message) => {
      check(message, {
        'message is valid JSON': (msg) => {
          try {
            JSON.parse(msg);
            return true;
          } catch (e) {
            return false;
          }
        },
      });
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 60000);
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
```

## Scenarios

### 1. Baseline Test

Establish baseline performance under normal load.

```javascript
// __tests__/load/scenarios/baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '10m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### 2. Ramp-Up Test

Gradually increase load to find breaking point.

```javascript
// __tests__/load/scenarios/ramp-up.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '10m', target: 1000 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/orders');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### 3. Spike Test

Test system's ability to handle sudden traffic spikes.

```javascript
// __tests__/load/scenarios/spike.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '1m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '1m', target: 10 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const res = http.post('http://localhost:3000/api/orders', JSON.stringify({
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    items: [{ menuItemId: 'menu_123', quantity: 1 }],
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, { 'status is 201': (r) => r.status === 201 });
  sleep(1);
}
```

### 4. Soak Test

Test system stability under sustained load.

```javascript
// __tests__/load/scenarios/soak.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10m', target: 100 },
    { duration: '4h', target: 100 },
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/orders');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### 5. Stress Test

Push system beyond expected limits to find breaking point.

```javascript
// __tests__/load/scenarios/stress.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 5000 },
    { duration: '10m', target: 5000 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.2'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/orders');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/load-tests.yml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *' # Run daily at 2 AM
  workflow_dispatch:
  pull_request:
    paths:
      - 'app/api/**'
      - 'lib/services/**'
      - 'lib/repositories/**'

jobs:
  load-test:
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

      - name: Install k6
        run: |
          sudo gpg -k C5AD17C747E3415A3642D57D77C6C491D6AC1D69 | sudo apt-key add -
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run baseline load test
        run: k6 run __tests__/load/scenarios/baseline.js
        env:
          BASE_URL: http://localhost:3000

      - name: Run ramp-up load test
        run: k6 run __tests__/load/scenarios/ramp-up.js
        env:
          BASE_URL: http://localhost:3000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            *.json
            *.html
```

### k6 Cloud Integration

```bash
# Run tests in k6 Cloud
k6 cloud \
  --token $K6_CLOUD_TOKEN \
  __tests__/load/scenarios/ramp-up.js

# Run with project
k6 cloud \
  --token $K6_CLOUD_TOKEN \
  --project-id $K6_PROJECT_ID \
  __tests__/load/scenarios/ramp-up.js
```

## Best Practices

### 1. Start Small

Begin with small loads and gradually increase:

```javascript
// Good: Start small
export const options = {
  stages: [
    { duration: '5m', target: 10 },
    { duration: '5m', target: 50 },
  ],
};

// Bad: Start with maximum load
export const options = {
  stages: [
    { duration: '5m', target: 1000 },
  ],
};
```

### 2. Use Realistic Scenarios

Simulate real user behavior:

```javascript
// Good: Realistic user journey
export default function () {
  // Browse menu
  http.get('/api/menu');

  // Add item to cart
  http.post('/api/cart', { itemId: 'menu_123', quantity: 1 });

  // Create order
  http.post('/api/orders', { /* order data */ });

  sleep(Math.random() * 5);
}

// Bad: Single endpoint
export default function () {
  http.get('/api/orders');
  sleep(1);
}
```

### 3. Monitor System Resources

Monitor CPU, memory, and database during tests:

```bash
# Monitor system resources
top -b -d 1 > system-resources.log &

# Monitor database
pg_stat_statements > db-stats.log &

# Run load test
k6 run test.js
```

### 4. Set Appropriate Thresholds

Define meaningful thresholds:

```javascript
export const options = {
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],

    // Error rate thresholds
    http_req_failed: ['rate<0.01'],

    // Throughput thresholds
    http_reqs: ['rate>100'],
  },
};
```

### 5. Test Different Scenarios

Test various load patterns:

```javascript
// Baseline: Normal load
{ duration: '10m', target: 100 }

// Ramp-up: Gradual increase
{ duration: '5m', target: 10 },
{ duration: '5m', target: 50 },
{ duration: '5m', target: 100 }

// Spike: Sudden increase
{ duration: '1m', target: 1000 }

// Soak: Sustained load
{ duration: '4h', target: 100 }

// Stress: Beyond limits
{ duration: '10m', target: 5000 }
```

### 6. Use Think Time

Add realistic delays between requests:

```javascript
// Good: Variable think time
sleep(Math.random() * 5);

// Bad: No think time
// (immediate next request)
```

### 7. Test in Staging

Run load tests in staging environment:

```bash
# Staging environment
k6 run test.js --env BASE_URL=https://staging.servio.com

# Production (with caution)
k6 run test.js --env BASE_URL=https://servio.com
```

### 8. Analyze Results

Review and analyze test results:

```javascript
// Custom metrics
import { Trend, Rate, Counter } from 'k6/metrics';

const orderCreationTime = new Trend('order_creation_time');
const orderCreationRate = new Rate('order_creation_rate');
const orderCreationCount = new Counter('order_creation_count');

export default function () {
  const startTime = Date.now();

  const res = http.post('/api/orders', { /* data */ });

  orderCreationTime.add(Date.now() - startTime);
  orderCreationRate.add(res.status === 201);
  orderCreationCount.add(1);
}
```

### 9. Automate Regular Tests

Schedule regular load tests:

```yaml
# GitHub Actions schedule
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
    - cron: '0 6 * * 1' # Weekly on Monday at 6 AM
```

### 10. Document Results

Document test results and findings:

```markdown
# Load Test Results - 2024-01-15

## Test Configuration
- Scenario: Ramp-up test
- Duration: 30 minutes
- Max VUs: 1000
- Target: 1000 requests/second

## Results
- Max throughput: 850 requests/second
- p95 response time: 450ms
- p99 response time: 890ms
- Error rate: 0.5%

## Findings
- System handled 850 requests/second successfully
- Response times increased after 700 requests/second
- Database became bottleneck at 800 requests/second

## Recommendations
- Add database read replicas
- Implement query result caching
- Optimize slow queries
```

## References

- [k6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/test-guides/test-configuration/)
- [Performance Testing](https://www.guru99.com/performance-testing.html)
- [Load Testing Patterns](https://k6.io/docs/test-guides/load-testing/)
