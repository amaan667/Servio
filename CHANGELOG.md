# Changelog

## [Unreleased] - Non-breaking cleanup

### Changed
- Removed debug artifacts and dead code
- Standardized logging with production-safe logger
- Improved TypeScript configuration and linting
- Unified error handling patterns
- Optimized data loading and navigation
- Cleaned up SQL scripts and organized migrations
- Enhanced performance through tree-shaking and lazy loading

### Technical Details
- All console.log calls replaced with logger that no-ops in production
- Debug scripts and temporary files archived or removed
- TypeScript strict mode enabled with unused variable detection
- Consistent loading states and error handling across components
- Stripe webhook logging normalized without functional changes
- SQL hygiene: ad-hoc scripts archived, migrations organized

### Notes
- Zero functional changes - UI and behavior remain identical
- Performance improvements through reduced debug overhead
- Build and typecheck now pass cleanly
- All existing features and API contracts preserved
