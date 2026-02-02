# ADR 0002: Use Next.js App Router Architecture

## Status
Accepted

## Context
We need to choose a frontend framework and architecture for the Servio platform. The platform requires:
- Server-side rendering for SEO and performance
- API routes for backend functionality
- Real-time updates for orders and KDS
- Complex state management for multi-venue operations
- Modern, responsive UI components

## Decision
We will use Next.js 15 with the App Router architecture. This provides:
- Server Components by default for better performance
- Built-in API routes for backend functionality
- Streaming and Suspense for improved UX
- File-based routing for simplicity
- Optimized for Vercel deployment

### Key Architectural Patterns

1. **App Router Structure**
   - `app/` directory for routes and layouts
   - Server Components for data fetching
   - Client Components for interactivity
   - Route groups for organization

2. **API Routes**
   - `app/api/` directory for API endpoints
   - Unified handler pattern for consistency
   - Type-safe request/response handling

3. **State Management**
   - React Query for server state
   - Context API for global state
   - Optimistic UI updates

4. **Real-time Features**
   - Supabase Realtime for subscriptions
   - Server-Sent Events for KDS updates

## Consequences
- Positive:
  - Excellent performance with Server Components
  - Built-in optimization and caching
  - Strong TypeScript support
  - Large ecosystem and community
  - Easy deployment to Vercel
- Negative:
  - Learning curve for App Router concepts
  - Some libraries not yet compatible
  - Requires careful separation of server/client components

## Alternatives Considered
- **Remix**: Good but smaller ecosystem
- **Nuxt**: Vue-based, not our preference
- **Custom React + Express**: More control but more maintenance

## References
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Best Practices](https://nextjs.org/docs/app/building-your-application/routing)
