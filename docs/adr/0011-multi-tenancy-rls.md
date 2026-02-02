# ADR 0011: Multi-Tenancy with Row-Level Security

## Status
Accepted

## Context
The Servio platform is a multi-tenant SaaS application where each venue is a tenant. We need:
- Strong data isolation between tenants
- Automatic tenant context injection
- Secure data access
- Scalable architecture
- Easy tenant management

## Decision
We will implement multi-tenancy using Supabase's Row-Level Security (RLS) policies. This provides:
- Database-level data isolation
- Automatic tenant filtering
- Secure by default
- Performance optimized
- Easy to maintain

### Implementation Details

1. **Tenant Identification**
   - `venue_id` column on all tenant-specific tables
   - UUID-based tenant IDs
   - Tenant context from authentication

2. **RLS Policies**
   - Read policy: Users can only read their venue's data
   - Write policy: Users can only write to their venue's data
   - Admin policy: Platform admins can access all data
   - Service role: Backend services can bypass RLS

3. **Context Injection**
   - Automatic `venue_id` injection from session
   - Middleware for tenant context
   - Validation of tenant access

4. **Data Isolation**
   - All queries automatically filtered by `venue_id`
   - No cross-tenant data access
   - Audit trail for all operations

5. **Tenant Management**
   - Tenant creation and deletion
   - Tenant settings
   - Tier-based restrictions
   - Feature flags per tenant

## Consequences
- Positive:
  - Strong data isolation
  - Secure by default
  - Automatic filtering
  - Performance optimized
  - Easy to maintain
- Negative:
  - Requires careful policy design
  - Testing complexity
  - Potential performance impact with complex policies
  - Limited flexibility for cross-tenant operations

## Alternatives Considered
- **Application-level filtering**: Less secure, more error-prone
- **Separate databases per tenant**: Too complex, expensive
- **Schema-based multi-tenancy**: Complex migration management
- **Custom middleware**: Less secure than RLS

## References
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-Tenancy Schema](../migrations/multi-venue-schema.sql)
- [RBAC Implementation](../migrations/role-based-access-control.sql)
