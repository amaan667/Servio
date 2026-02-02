# ADR 0005: Use React Query for Server State Management

## Status
Accepted

## Context
We need a solution for managing server state in the Servio platform. The platform requires:
- Caching of API responses
- Automatic refetching of stale data
- Optimistic UI updates
- Real-time synchronization
- Loading and error states
- Pagination and infinite scrolling

## Decision
We will use React Query (@tanstack/react-query) for server state management. React Query provides:
- Powerful caching and synchronization
- Automatic background refetching
- Optimistic updates
- DevTools for debugging
- Excellent TypeScript support
- Integration with Next.js

### Implementation Details

1. **Query Client Setup**
   - Global query client configuration
   - Default stale time and cache time
   - Retry logic for failed requests
   - Query and mutation defaults

2. **Query Keys**
   - Hierarchical query key structure
   - Type-safe query keys
   - Cache invalidation strategies
   - Dependent queries

3. **Data Fetching**
   - Custom hooks for common queries
   - Pagination support
   - Infinite scrolling
   - Real-time updates with Supabase

4. **Mutations**
   - Optimistic updates
   - Automatic cache invalidation
   - Error handling and rollback
   - Success/error callbacks

5. **Integration with Supabase**
   - Real-time subscriptions
   - Automatic cache updates
   - Offline support

## Consequences
- Positive:
  - Excellent developer experience
  - Reduces boilerplate code
  - Built-in caching and synchronization
  - Great TypeScript support
  - Active community and regular updates
- Negative:
  - Additional library dependency
  - Learning curve for advanced features
  - Bundle size impact (minimal)

## Alternatives Considered
- **SWR**: Good but less feature-rich
- **Apollo Client**: Overkill for REST APIs
- **Custom solution**: Too much maintenance
- **Redux Toolkit**: Better for client state, not server state

## References
- [React Query Documentation](https://tanstack.com/query/latest)
- [Best Practices](https://tanstack.com/query/latest/docs/react/guides/queries)
