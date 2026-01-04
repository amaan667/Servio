# Load Testing Strategy

## Overview

This document outlines the load testing strategy for Servio. It covers testing approach, tools, scenarios, and performance targets.

## Performance Targets

### API Response Times

- **p50 (Median)**: < 200ms
- **p95**: < 500ms
- **p99**: < 1000ms

### Throughput

- **Concurrent Users**: 100+ (starter tier), 500+ (pro tier), 1000+ (enterprise tier)
- **Requests per Second**: 50+ (starter), 200+ (pro), 500+ (enterprise)

### Availability

- **Uptime**: 99.9% (43.2 minutes downtime/month)
- **Error Rate**: < 0.1% (1 error per 1000 requests)

## Testing Approach

### Load Testing Types

1. **Baseline Testing**
   - Normal load conditions
   - Establish performance baseline
   - Identify bottlenecks

2. **Load Testing**
   - Expected production load
   - Verify performance targets
   - Test scalability

3. **Stress Testing**
   - Above-normal load
   - Identify breaking points
   - Test system limits

4. **Spike Testing**
   - Sudden load increases
   - Test system resilience
   - Verify auto-scaling

5. **Endurance Testing**
   - Sustained load over time
   - Memory leak detection
   - Performance degradation

## Testing Tools

### Recommended Tools

1. **k6** (Recommended)
   - Open-source load testing tool
   - JavaScript-based scripts
   - Cloud or local execution
   - Real-time metrics

2. **Artillery**
   - Node.js-based load testing
   - Easy to use
   - Good documentation

3. **Apache JMeter**
   - Mature tool
   - GUI and CLI
   - Extensive features

4. **Locust**
   - Python-based
   - Distributed testing
   - Real-time web UI

### Tool Selection: k6

**Why k6:**
- Open-source and free
- JavaScript-based (matches our stack)
- Excellent performance
- Cloud execution (k6 Cloud)
- Good documentation

## Test Scenarios

### Critical User Flows

#### 1. Order Creation Flow

**Endpoint**: `POST /api/orders`

**Load Profile**:
- Ramp-up: 10 users → 50 users over 2 minutes
- Sustained: 50 users for 5 minutes
- Ramp-down: 50 users → 0 over 1 minute

**Test Script** (k6):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = 'https://servio-production.up.railway.app/api/orders';
  const payload = JSON.stringify({
    venueId: 'venue-test',
    items: [{ menuItemId: 'item-1', quantity: 2, price: 12.99 }],
    customerName: 'Test Customer',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'sb-access-token=test-token', // Use test token
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

#### 2. Dashboard Load

**Endpoints**: Multiple dashboard endpoints

**Load Profile**:
- 20 concurrent users
- 5-minute duration
- Realistic user behavior

**Test Script** (k6):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '5m',
};

export default function () {
  const baseUrl = 'https://servio-production.up.railway.app';
  const venueId = 'venue-test';

  // Dashboard endpoints
  const endpoints = [
    `/api/dashboard/counts?venueId=${venueId}`,
    `/api/dashboard/stats?venueId=${venueId}`,
    `/api/analytics?venueId=${venueId}`,
    `/api/orders?venueId=${venueId}`,
  ];

  endpoints.forEach((endpoint) => {
    const res = http.get(`${baseUrl}${endpoint}`, {
      headers: { 'Cookie': 'sb-access-token=test-token' },
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });
}
```

#### 3. Payment Processing

**Endpoint**: `POST /api/stripe/create-checkout-session`

**Load Profile**:
- 10 concurrent users
- 3-minute duration
- Test payment processing

**Note**: Use Stripe test mode for load testing

#### 4. Real-Time Updates

**Test**: WebSocket/Realtime connections

**Load Profile**:
- 50 concurrent connections
- 5-minute duration
- Test message throughput

### Stress Test Scenarios

#### Scenario 1: Traffic Spike

**Load Profile**:
- Baseline: 20 users
- Spike: 200 users (sudden increase)
- Duration: 10 minutes
- Objective: Test system resilience

#### Scenario 2: Sustained High Load

**Load Profile**:
- 100 concurrent users
- 30-minute duration
- Objective: Test endurance, memory leaks

#### Scenario 3: Database Stress

**Load Profile**:
- 50 concurrent users
- Complex queries
- 10-minute duration
- Objective: Test database performance

## Test Environment

### Staging Environment

**Recommended Setup**:
- Use staging environment for load testing
- Mirror production configuration
- Use test data (not production data)
- Monitor resource usage

### Production Load Testing

**Caution**: Only with approval and monitoring

- Schedule during low-traffic periods
- Use test data only
- Monitor closely
- Have rollback plan ready

## Performance Metrics

### Key Metrics to Monitor

1. **Response Time**
   - p50 (median)
   - p95
   - p99
   - p99.9

2. **Throughput**
   - Requests per second
   - Successful requests
   - Failed requests

3. **Error Rate**
   - 4xx errors
   - 5xx errors
   - Timeout errors

4. **Resource Usage**
   - CPU usage
   - Memory usage
   - Database connections
   - Network bandwidth

5. **Database Performance**
   - Query execution time
   - Connection pool usage
   - Database CPU/Memory

## Test Execution

### Pre-Test Checklist

- [ ] Test environment ready
- [ ] Test data prepared
- [ ] Monitoring tools configured
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Test scripts validated

### Test Execution Steps

1. **Baseline Test**
   - Run baseline load test
   - Establish performance baseline
   - Document results

2. **Load Test**
   - Run expected production load
   - Monitor metrics
   - Document results

3. **Stress Test** (Optional)
   - Run above-normal load
   - Identify breaking points
   - Document results

4. **Analysis**
   - Analyze results
   - Identify bottlenecks
   - Create optimization plan

### Post-Test

1. **Analysis**
   - Review performance metrics
   - Identify bottlenecks
   - Compare against targets

2. **Documentation**
   - Document test results
   - Create performance report
   - Update performance targets if needed

3. **Optimization**
   - Implement optimizations
   - Re-test if needed
   - Verify improvements

## Performance Optimization

### Common Optimizations

1. **Database**
   - Add indexes
   - Optimize queries
   - Connection pooling
   - Query caching

2. **API**
   - Response caching
   - Request batching
   - Parallel processing
   - Code optimization

3. **Infrastructure**
   - Horizontal scaling
   - CDN for static assets
   - Database scaling
   - Caching layer (Redis)

4. **Application**
   - Code splitting
   - Bundle optimization
   - Lazy loading
   - Service worker

## Continuous Performance Testing

### Recommended Schedule

- **Weekly**: Baseline tests (staging)
- **Before Major Releases**: Full load test
- **After Optimizations**: Verify improvements
- **Monthly**: Stress test (staging)

### Integration with CI/CD

**Recommended**:
- Run baseline tests in CI/CD
- Fail build if performance regressions
- Monitor performance trends
- Alert on performance degradation

## Tools & Resources

### Load Testing Tools

- **k6**: https://k6.io (recommended)
- **Artillery**: https://www.artillery.io
- **Apache JMeter**: https://jmeter.apache.org
- **Locust**: https://locust.io

### Monitoring Tools

- **Railway**: Application metrics
- **Supabase**: Database metrics
- **Sentry**: Performance monitoring
- **k6 Cloud**: Load test metrics

### Documentation

- **k6 Documentation**: https://k6.io/docs
- **Performance Best Practices**: https://k6.io/docs/using-k6/best-practices

## Support

For load testing questions:
- **Documentation**: This file
- **Team**: Check internal documentation
- **k6 Community**: https://community.k6.io

---

**Last Updated:** December 2025  
**Version:** 0.1.6

