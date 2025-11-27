# ADR-0003: Use Supabase as Backend

## Status

Accepted

## Context

We needed to choose a backend solution for authentication, database, and real-time features. Options included building custom backend, using Firebase, or using Supabase.

## Decision

We will use Supabase for:
- Database (PostgreSQL)
- Authentication
- Real-time subscriptions
- Storage (if needed)

## Rationale

1. **PostgreSQL**: Robust, SQL-based database
2. **Authentication**: Built-in auth with multiple providers
3. **Real-time**: WebSocket-based subscriptions
4. **Open Source**: Can self-host if needed
5. **Type Safety**: Generated TypeScript types
6. **Cost**: Free tier is generous for MVP
7. **Developer Experience**: Great tooling and documentation

## Consequences

### Positive

- Fast development with built-in features
- Type-safe database access
- Real-time capabilities out of the box
- Good free tier for MVP

### Negative

- Vendor lock-in (mitigated by PostgreSQL standard)
- Less control than custom backend
- Potential scaling costs at high volume

## Alternatives Considered

1. **Custom Backend**: More control but more development time
2. **Firebase**: Good but NoSQL and vendor lock-in
3. **PlanetScale**: MySQL-based, good but less features
4. **Railway + Prisma**: More control but more setup

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase vs Firebase](https://supabase.com/docs/guides/getting-started/comparing-supabase-vs-firebase)

