# ADR 0012: Rate Limiting with Redis Fallback

## Status
Accepted

## Context
The Servio platform needs rate limiting to prevent abuse and ensure fair usage. Requirements include:
- API rate limiting per user/IP
- Tier-based rate limits
- Distributed rate limiting
- Graceful degradation
- Performance optimization

## Decision
We will implement rate limiting using Redis with an in-memory fallback. This provides:
- Distributed rate limiting
- High performance
- Graceful degradation
- Tier-based limits
- Configurable policies

### Implementation Details

1. **Rate Limiting Strategy**
   - Token bucket algorithm
   - Sliding window for accuracy
   - Per-user and per-IP limits
   - Tier-based limits

2. **Redis Implementation**
   - Redis for distributed rate limiting
   - Atomic operations for accuracy
   - TTL for automatic cleanup
   - Connection pooling

3. **In-Memory Fallback**
   - Fallback to in-memory when Redis is unavailable
   - Local rate limiting per instance
   - Warning logs when using fallback
   - Automatic retry to Redis

4. **Rate Limit Policies**
   - API endpoints: 1000 requests/hour
   - Authentication: 10 attempts/minute
   - AI assistant: 100 requests/hour
   - Webhooks: 1000 requests/hour

5. **Integration**
   - Middleware for API routes
   - Per-endpoint configuration
   - Customizable limits
   - Rate limit headers in responses

## Consequences
- Positive:
  - Distributed rate limiting
  - High performance
  - Graceful degradation
  - Tier-based limits
  - Configurable policies
- Negative:
  - Redis dependency
  - Complexity
  - Potential inconsistency during fallback
  - Memory usage for in-memory fallback

## Alternatives Considered
- **In-memory only**: Not distributed, inconsistent
- **Database-based**: Too slow
- **CDN-based**: Good but limited control
- **Third-party service**: Additional cost and dependency

## References
- [Rate Limiting Implementation](../lib/rate-limit-redis.ts)
- [Rate Limiting Fallback](../lib/rate-limit.ts)
