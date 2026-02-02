# ADR 0020: Internationalization (i18n) Strategy

## Status
Accepted

## Context
The Servio platform needs to support multiple languages and regions for global expansion. Requirements include:
- Multi-language support
- Date/time formatting
- Currency formatting
- Number formatting
- RTL language support

## Decision
We will implement internationalization using next-intl. This provides:
- Server-side translation
- Type-safe translations
- Automatic locale detection
- SEO-friendly URLs
- Easy translation management

### Implementation Details

1. **Translation Management**
   - JSON translation files
   - Namespace organization
   - Type-safe translation keys
   - Missing key detection
   - Translation updates

2. **Locale Detection**
   - Browser language detection
   - User preference storage
   - URL-based locale
   - Accept-Language header
   - Fallback to default locale

3. **Formatting**
   - Date/time formatting (Intl.DateTimeFormat)
   - Currency formatting (Intl.NumberFormat)
   - Number formatting
   - Pluralization
   - Gender support

4. **RTL Support**
   - Automatic RTL detection
   - CSS logical properties
   - Mirrored layouts
   - RTL-aware components
   - Testing for RTL languages

5. **Content Translation**
   - Static content translation
   - Dynamic content translation
   - User-generated content
   - AI-assisted translation
   - Translation review process

## Consequences
- Positive:
  - Global market reach
  - Better user experience
  - SEO benefits
  - Competitive advantage
  - Scalable to new markets
- Negative:
  - Additional complexity
  - Translation maintenance
  - Increased bundle size
  - Development overhead
  - Testing complexity

## Alternatives Considered
- **No i18n**: Limited to English-speaking markets
- **Client-side only**: Poor SEO, slower initial load
- **Third-party service**: Expensive, less control
- **Custom solution**: Too much maintenance

## References
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
