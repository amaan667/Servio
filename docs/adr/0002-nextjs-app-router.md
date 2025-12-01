# ADR-0002: Use Next.js App Router

## Status

Accepted

## Context

We needed to choose between Next.js Pages Router and App Router for the application. The App Router was introduced in Next.js 13 and became stable in Next.js 14.

## Decision

We will use Next.js App Router for all new pages and features.

## Rationale

1. **Server Components**: Better performance with server-side rendering by default
2. **Layouts**: Better code organization with nested layouts
3. **Streaming**: Built-in support for React Server Components and streaming
4. **Future-proof**: Pages Router is in maintenance mode
5. **Type Safety**: Better TypeScript support with App Router
6. **Data Fetching**: Simpler data fetching patterns with async components

## Consequences

### Positive

- Better performance with Server Components
- Cleaner code organization
- Better developer experience
- Future-proof architecture

### Negative

- Learning curve for team members familiar with Pages Router
- Some third-party libraries may not support App Router yet
- Migration effort if we had existing Pages Router code

## Alternatives Considered

1. **Pages Router**: More mature but being phased out
2. **Remix**: Good alternative but smaller ecosystem
3. **SvelteKit**: Different framework entirely

## References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components)


