# Marketing Components

This directory contains reusable marketing components for the Servio homepage and landing pages.

## FAQ Component

A premium, accessible FAQ accordion component optimized for conversions and SEO.

### Features

✅ **Premium Design**
- Constrained width (`max-w-3xl`) for optimal readability
- Card-based styling with smooth hover effects
- Animated chevron icons that rotate on open/close
- Purple brand colors throughout

✅ **Full Accessibility**
- Semantic HTML with proper heading hierarchy
- ARIA attributes (`aria-expanded`, `aria-controls`, `aria-labelledby`)
- Full keyboard navigation (Enter/Space to toggle)
- Focus visible states for keyboard users
- Screen reader friendly
- Respects `prefers-reduced-motion`

✅ **SEO Optimized**
- JSON-LD `FAQPage` schema for rich search results
- Semantic markup
- Proper content structure

✅ **Conversion Focused**
- Shorter, punchier copy
- Strategic CTA footer with two actions:
  - "Contact us" → `mailto:support@servio.uk`
  - "Start free trial" → `/sign-up`

✅ **Analytics Ready**
- Optional callback for toggle tracking
- Optional callback for CTA clicks
- Easy integration with GA, Mixpanel, etc.

✅ **Performance**
- No heavy libraries (uses existing lucide-react icons)
- Lightweight component tree
- No layout shifts during hydration
- No console warnings

### Quick Start

#### 1. Basic Usage

```tsx
import { FAQ } from "@/components/marketing/FAQ";

export default function HomePage() {
  return (
    <div>
      {/* Your pricing section */}
      <section id="pricing">
        {/* ... */}
      </section>

      {/* FAQ directly below pricing */}
      <FAQ />
    </div>
  );
}
```

#### 2. With JSON-LD Schema (Recommended for SEO)

```tsx
import { FAQ, faqSchema } from "@/components/marketing/FAQ";

export default function HomePage() {
  return (
    <div>
      {/* Add schema for rich search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Your content */}
      <FAQ />
    </div>
  );
}
```

#### 3. With Analytics Tracking

```tsx
import { FAQ } from "@/components/marketing/FAQ";

export default function HomePage() {
  const handleFAQToggle = (question: string, isOpen: boolean) => {
    // Track with your analytics service
    analytics.track('faq_toggle', {
      question,
      state: isOpen ? 'open' : 'closed'
    });
  };

  const handleFAQCTA = (type: 'contact' | 'trial') => {
    analytics.track('faq_cta_click', { type });
  };

  return (
    <FAQ 
      onToggle={handleFAQToggle}
      onCTAClick={handleFAQCTA}
    />
  );
}
```

### Editing FAQ Content

To update questions and answers:

1. Open `components/marketing/FAQ.tsx`
2. Find the `faqItems` array (around line 30)
3. Edit the questions and answers
4. Save the file

```tsx
const faqItems: FAQItem[] = [
  {
    id: "hardware",
    question: "Do I need new hardware to use Servio?",
    answer: "**No.** Customers use their own phones...",
  },
  // Add more items...
];
```

**Bold text**: Wrap text in `**` for bold formatting (e.g., `**No.**` renders as **No.**)

### Current FAQ Content

1. **Do I need new hardware to use Servio?**
   - Answer emphasizes: No hardware needed, customers use their phones

2. **Can I try Servio for free?**
   - Answer emphasizes: 14-day free trial, no credit card

3. **How do customers place orders?**
   - Answer emphasizes: Scan QR, order from phone, no app

4. **Is Servio available outside the UK?**
   - Answer emphasizes: UK-first, expanding soon, join waitlist

### Component Props

```tsx
interface FAQProps {
  /** Optional class name for wrapper customization */
  className?: string;
  
  /** Optional callback for analytics tracking on toggle */
  onToggle?: (question: string, isOpen: boolean) => void;
  
  /** Optional callback for CTA click tracking */
  onCTAClick?: (type: "contact" | "trial") => void;
}
```

### Styling

The FAQ uses Tailwind CSS with the Servio brand colors:

- **Cards**: `rounded-xl`, `border-purple-200/60`, `bg-white`, `shadow-sm`
- **Hover**: Smooth shadow transition
- **Focus**: Purple ring (`focus:ring-purple-500`)
- **Chevrons**: Rotate 180° when open
- **Animations**: `duration-200 ease-out`

### Accessibility Checklist

- [x] Semantic HTML (`<section>`, `<h2>`, `<button>`)
- [x] ARIA attributes for screen readers
- [x] Keyboard navigation (Enter/Space)
- [x] Focus visible states
- [x] Proper heading hierarchy (h2)
- [x] Region roles for answers
- [x] Respects `prefers-reduced-motion`

### Testing

A comprehensive test suite is available in `__tests__/components/marketing/FAQ.test.tsx`.

To run tests:

1. Install testing dependencies:
```bash
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
```

2. Create `jest.config.js` and `jest.setup.js` (see test file for details)

3. Run tests:
```bash
pnpm test
```

### Examples

See `components/marketing/FAQ.stories.tsx` for detailed usage examples including:
- Basic usage
- Analytics tracking
- Custom styling
- Conditional rendering
- Multiple FAQ sections

### Dark Mode

The FAQ component automatically adapts to dark mode when used in authenticated routes (dashboard, settings, etc.). The homepage does not have dark mode enabled to maintain brand consistency.

### Performance Notes

- Component is client-side rendered (`"use client"`)
- No layout shifts during animations
- Chevron rotation uses CSS transforms
- Accordion animation is GPU-accelerated
- No heavy dependencies

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Full keyboard navigation
- Screen reader tested (NVDA, JAWS, VoiceOver)

### Support

For questions or issues:
- Email: support@servio.uk
- Review the test file for expected behavior
- Check the stories file for usage examples

---

## Future Marketing Components

This directory will house additional marketing components:
- Hero sections
- Feature showcases
- Testimonials
- CTAs
- etc.

Each component should follow the same patterns:
- Accessible by default
- SEO-friendly
- Analytics-ready
- Performance-optimized
- Well-documented

