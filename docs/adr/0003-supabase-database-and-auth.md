# ADR 0003: Use Supabase for Database and Authentication

## Status
Accepted

## Context
We need a database and authentication solution for the Servio platform. The platform requires:
- Multi-tenant architecture with venue isolation
- Real-time data synchronization
- Row-level security for data isolation
- OAuth providers for social login
- Email authentication
- PostgreSQL database with advanced features

## Decision
We will use Supabase as our database and authentication provider. Supabase provides:
- PostgreSQL database with managed infrastructure
- Built-in authentication with multiple providers
- Row-Level Security (RLS) for multi-tenancy
- Real-time subscriptions for live updates
- Storage API for file uploads
- Edge functions for serverless compute

### Implementation Details

1. **Database Schema**
   - Venue-based multi-tenancy using RLS policies
   - UUID primary keys for all tables
   - Timestamps for audit trails
   - Foreign key constraints for data integrity

2. **Authentication**
   - Email/password authentication
   - OAuth providers (Google, GitHub, etc.)
   - Session management with JWT tokens
   - Role-based access control

3. **Real-time Features**
   - Supabase Realtime for order updates
   - KDS live ticket updates
   - Table status changes
   - Inventory alerts

4. **Multi-tenancy**
   - RLS policies enforce venue isolation
   - `venue_id` column on all tenant-specific tables
   - Automatic context injection for queries

## Consequences
- Positive:
  - Managed infrastructure reduces operational overhead
  - Built-in authentication saves development time
   - RLS provides strong data isolation
   - Real-time features out of the box
   - PostgreSQL with advanced features (JSONB, full-text search)
- Negative:
  - Vendor lock-in to Supabase
  - Limited control over database configuration
  - Potential cost at scale
  - Some advanced features require Edge Functions

## Alternatives Considered
- **Firebase**: NoSQL, less suitable for complex queries
- **PostgreSQL + Auth0**: More control but more complexity
- **PlanetScale**: MySQL-based, no RLS equivalent
- **Custom solution**: Too much maintenance overhead

## References
- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
