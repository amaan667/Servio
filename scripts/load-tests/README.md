# Load Testing Scripts

This directory contains k6 load testing scripts for Servio.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Scripts

### 1. Order Creation (`order-creation.js`)

Tests the order creation endpoint under load.

**Usage:**
```bash
# Local execution
k6 run scripts/load-tests/order-creation.js

# With environment variables
BASE_URL=https://servio-staging.up.railway.app \
VENUE_ID=venue-test \
AUTH_TOKEN=your-test-token \
k6 run scripts/load-tests/order-creation.js

# Cloud execution (k6 Cloud)
k6 cloud scripts/load-tests/order-creation.js
```

**Load Profile:**
- Ramp up: 10 users → 50 users (3 minutes)
- Sustained: 50 users (5 minutes)
- Ramp down: 50 users → 0 (1 minute)

**Targets:**
- p95 response time < 500ms
- p99 response time < 1000ms
- Error rate < 1%
- Success rate > 95%

### 2. Dashboard Load (`dashboard-load.js`)

Tests dashboard endpoints under load.

**Usage:**
```bash
# Local execution
k6 run scripts/load-tests/dashboard-load.js

# With environment variables
BASE_URL=https://servio-staging.up.railway.app \
VENUE_ID=venue-test \
AUTH_TOKEN=your-test-token \
k6 run scripts/load-tests/dashboard-load.js
```

**Load Profile:**
- Ramp up: 20 users (1 minute)
- Sustained: 20 users (5 minutes)
- Ramp down: 0 users (1 minute)

**Endpoints Tested:**
- `/api/dashboard/counts`
- `/api/dashboard/stats`
- `/api/analytics`
- `/api/orders`

**Targets:**
- p95 response time < 500ms
- p99 response time < 1000ms
- Error rate < 1%

## Environment Variables

- `BASE_URL` - Base URL of the application (default: production URL)
- `VENUE_ID` - Venue ID to use for testing (default: venue-test)
- `AUTH_TOKEN` - Authentication token (default: test-token)

## Running Tests

### Staging Environment (Recommended)

```bash
# Set environment variables
export BASE_URL=https://servio-staging.up.railway.app
export VENUE_ID=venue-test
export AUTH_TOKEN=your-staging-test-token

# Run tests
k6 run scripts/load-tests/order-creation.js
k6 run scripts/load-tests/dashboard-load.js
```

### Production Environment (Use with Caution)

Only run production load tests:
- During low-traffic periods
- With approval
- Using test data only
- Monitoring closely

```bash
export BASE_URL=https://servio-production.up.railway.app
# ... other env vars ...
k6 run scripts/load-tests/order-creation.js
```

## Results

k6 outputs results to stdout. For detailed analysis:

```bash
# Save results to file
k6 run --out json=results.json scripts/load-tests/order-creation.js

# Use k6 Cloud for visualization
k6 cloud scripts/load-tests/order-creation.js
```

## Performance Targets

See [LOAD_TESTING.md](../../docs/LOAD_TESTING.md) for complete performance targets and strategy.

## Support

For questions or issues:
- Review [LOAD_TESTING.md](../../docs/LOAD_TESTING.md)
- Check k6 documentation: https://k6.io/docs
- Contact team for assistance

