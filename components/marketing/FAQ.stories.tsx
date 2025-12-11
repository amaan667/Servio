/**
 * FAQ Component Usage Examples
 *
 * This file demonstrates how to use the FAQ component in different scenarios.
 * Can be used with Storybook if you set it up, or as a reference.
 */

import { FAQ } from "./FAQ";
import { logger } from "@/lib/logger";

/**
 * Example 1: Basic usage
 *
 * The simplest way to use the FAQ component - just import and render it.
 */
export function BasicFAQ() {
  return <FAQ />;
}

/**
 * Example 2: With analytics tracking
 *
 * Track when users interact with the FAQ for insights.
 */
export function FAQWithAnalytics() {
  const handleToggle = (_question: string, _isOpen: boolean) => {
    // Send to your analytics service
    // Example with Google Analytics
    // if (typeof window !== 'undefined' && window.gtag) {
    //   window.gtag('event', 'faq_toggle', {
    //     question: _question,
    //     state: _isOpen ? 'open' : 'closed',
    //   });
    // }
  };

  const handleCTAClick = (_type: "contact" | "trial") => {
    // Example with Google Analytics
    // if (typeof window !== 'undefined' && window.gtag) {
    //   window.gtag('event', 'faq_cta_click', {
    //     cta_type: type,
    //   });
    // }
  };

  return <FAQ onToggle={handleToggle} onCTAClick={handleCTAClick} />;
}

/**
 * Example 3: Custom styling
 *
 * Add custom classes to integrate with your design system.
 */
export function CustomStyledFAQ() {
  return <FAQ className="my-12 lg:my-20" />;
}

/**
 * Example 4: In a page layout
 *
 * How to use FAQ in your homepage after pricing.
 */
export function HomepageWithFAQ() {
  return (
    <div>
      {/* Your pricing section */}
      <section id="pricing" className="py-24">
        {/* Pricing cards here */}
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* Footer or other sections */}
    </div>
  );
}

/**
 * Example 5: Conditional rendering
 *
 * Only show FAQ on certain pages or conditions.
 */
export function ConditionalFAQ({ showFAQ }: { showFAQ: boolean }) {
  if (!showFAQ) return null;

  return <FAQ />;
}

/**
 * Example 6: Multiple FAQ sections
 *
 * You can render the FAQ component multiple times with different styling.
 */
export function MultipleFAQSections() {
  return (
    <div>
      <section className="bg-white py-16">
        <div className="container">
          <h2 className="text-3xl font-bold mb-8">General Questions</h2>
          <FAQ />
        </div>
      </section>

      {/* Other content */}

      <section className="bg-gray-50 py-16">
        <div className="container">
          <h2 className="text-3xl font-bold mb-8">Technical Questions</h2>
          {/* You could create a different FAQ component for technical questions */}
        </div>
      </section>
    </div>
  );
}

/**
 * ADDING THE JSON-LD SCHEMA TO YOUR PAGE
 *
 * In your Next.js page (app/page.tsx), add this to the component:
 */

// import { FAQ, faqSchema } from "@/components/marketing/FAQ";
//
// export default function HomePage() {
//   return (
//     <div>
//       {/* Add JSON-LD schema for SEO */}
//       <script
//         type="application/ld+json"
//         dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
//       />
//
//       {/* Your page content */}
//       <FAQ />
//     </div>
//   );
// }

/**
 * EDITING FAQ CONTENT
 *
 * To update the FAQ questions and answers:
 * 1. Open: components/marketing/FAQ.tsx
 * 2. Find the `faqItems` array (around line 30)
 * 3. Edit the questions and answers
 * 4. Save the file
 *
 * Example:
 * ```
 * const faqItems: FAQItem[] = [
 *   {
 *     id: "my-question",
 *     question: "My new question?",
 *     answer: "My answer with **bold** text.",
 *   },
 *   // ... more items
 * ];
 * ```
 */

/**
 * ACCESSIBILITY FEATURES
 *
 * The FAQ component includes:
 * - Proper ARIA attributes (aria-expanded, aria-controls)
 * - Semantic HTML (<section>, <h2>, <button>)
 * - Keyboard navigation (Enter/Space to toggle)
 * - Focus visible states
 * - Screen reader support
 * - prefers-reduced-motion support
 */

/**
 * STORYBOOK SETUP (Optional)
 *
 * If you want to use Storybook:
 *
 * 1. Install Storybook:
 *    ```bash
 *    npx storybook@latest init
 *    ```
 *
 * 2. Rename this file to FAQ.stories.tsx
 *
 * 3. Update exports:
 */

// export default {
//   title: 'Marketing/FAQ',
//   component: FAQ,
// };

// export const Default = () => <FAQ />;
// export const WithAnalytics = () => <FAQWithAnalytics />;
// export const CustomStyled = () => <CustomStyledFAQ />;
