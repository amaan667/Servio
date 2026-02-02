# ADR 0004: Use Radix UI + shadcn/ui Component Library

## Status
Accepted

## Context
We need a component library for the Servio platform UI. The platform requires:
- Accessible components (WCAG 2.1 AA compliant)
- Customizable design system
- Modern, professional appearance
- Good TypeScript support
- Active maintenance and community

## Decision
We will use Radix UI primitives with shadcn/ui as our component library. This combination provides:
- Unstyled, accessible primitives from Radix UI
- Beautiful, customizable components from shadcn/ui
- Full control over styling with Tailwind CSS
- Copy-paste components (no npm dependency)
- Excellent TypeScript support
- Active community and regular updates

### Implementation Details

1. **Component Structure**
   - Components in `components/ui/` directory
   - Each component is a separate file
   - Uses Tailwind CSS for styling
   - Follows Radix UI patterns for accessibility

2. **Design System**
   - Consistent color palette
   - Typography scale
   - Spacing system
   - Border radius and shadows
   - Dark mode support

3. **Key Components**
   - Button, Input, Select, Dialog
   - Table, Card, Badge
   - Form components with validation
   - Navigation components
   - Data display components

4. **Customization**
   - Tailwind config for design tokens
   - CSS variables for theming
   - Component variants for flexibility

## Consequences
- Positive:
  - Excellent accessibility out of the box
  - Full control over styling
  - No dependency on a monolithic library
  - Easy to customize and extend
  - Great TypeScript support
- Negative:
  - Need to copy components manually
  - Requires understanding of Radix patterns
  - Initial setup time
  - Need to maintain component updates

## Alternatives Considered
- **Material UI**: Too opinionated, harder to customize
- **Chakra UI**: Good but less flexible styling
- **Mantine**: Good but larger bundle size
- **Headless UI**: Good but less feature-rich

## References
- [Radix UI Documentation](https://www.radix-ui.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
