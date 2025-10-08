"use client";

import { useState } from "react";
import { ChevronDown, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * FAQ Item Type
 * 
 * To edit FAQ content, modify the `faqItems` array below
 */
interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * FAQ Data
 * 
 * EDIT HERE: To update FAQ questions and answers, modify this array
 */
const faqItems: FAQItem[] = [
  {
    id: "hardware",
    question: "Do I need new hardware to use Servio?",
    answer: "**No.** Customers use their own phones. You print the QR codes; staff manage orders from any device with a browser.",
  },
  {
    id: "free-trial",
    question: "Can I try Servio for free?",
    answer: "Yes — **14-day free trial** with full access. No credit card required. Cancel anytime.",
  },
  {
    id: "how-it-works",
    question: "How do customers place orders?",
    answer: "They scan the QR, browse your digital menu, and pay from their phone — no app needed. Orders appear instantly in your dashboard.",
  },
  {
    id: "availability",
    question: "Is Servio available outside the UK?",
    answer: "We're UK-first today (GBP + Stripe). **Expanding soon.** Join the waitlist and we'll notify you when Servio launches in your region.",
  },
];

/**
 * FAQ Component Props
 */
interface FAQProps {
  /** Optional class name for wrapper customization */
  className?: string;
  /** Optional callback for analytics tracking on toggle */
  onToggle?: (question: string, isOpen: boolean) => void;
  /** Optional callback for CTA click tracking */
  onCTAClick?: (type: "contact" | "trial") => void;
}

/**
 * FAQ Component
 * 
 * Premium, accessible FAQ accordion for the Servio homepage.
 * 
 * Features:
 * - Fully accessible with ARIA attributes and keyboard navigation
 * - Smooth animations with prefers-reduced-motion support
 * - Premium card styling with hover effects
 * - SEO-friendly semantic HTML
 * - Optional analytics hooks
 * - Conversion-focused CTA footer
 * 
 * @example
 * ```tsx
 * <FAQ 
 *   onToggle={(q, isOpen) => analytics.track('faq_toggle', { question: q, state: isOpen ? 'open' : 'closed' })}
 *   onCTAClick={(type) => analytics.track('faq_cta_click', { type })}
 * />
 * ```
 */
export function FAQ({ className = "", onToggle, onCTAClick }: FAQProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      const willBeOpen = !newSet.has(id);
      
      if (willBeOpen) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }

      // Analytics callback
      const item = faqItems.find((faq) => faq.id === id);
      if (item && onToggle) {
        onToggle(item.question, willBeOpen);
      }

      return newSet;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleItem(id);
    }
  };

  const handleCTAClick = (type: "contact" | "trial") => {
    if (onCTAClick) {
      onCTAClick(type);
    }
  };

  return (
    <section
      aria-labelledby="faq-heading"
      className={`w-full max-w-3xl mx-auto px-4 pt-16 pb-8 ${className}`}
    >
      {/* Heading */}
      <h2
        id="faq-heading"
        className="text-3xl font-bold text-center text-gray-900 mb-8"
      >
        Frequently Asked Questions
      </h2>

      {/* FAQ Items */}
      <div className="space-y-3">
        {faqItems.map((item) => {
          const isOpen = openItems.has(item.id);
          const contentId = `faq-content-${item.id}`;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-purple-200/60 bg-white shadow-sm hover:shadow transition-shadow duration-200 focus-within:ring-2 focus-within:ring-purple-500 focus-within:ring-offset-2"
              data-state={isOpen ? "open" : "closed"}
            >
              {/* Question Button */}
              <button
                onClick={() => toggleItem(item.id)}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="w-full px-5 py-4 text-left flex justify-between items-center gap-4 focus:outline-none group"
              >
                <span className="font-semibold text-gray-900 text-base md:text-lg">
                  {item.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 text-purple-600 flex-shrink-0 transition-transform duration-200 ease-out ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Answer Region */}
              <div
                id={contentId}
                role="region"
                aria-labelledby={`faq-question-${item.id}`}
                className={`overflow-hidden transition-all duration-200 ease-out ${
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
                style={{
                  // Respect prefers-reduced-motion
                  transitionDuration:
                    typeof window !== "undefined" &&
                    window.matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "0ms"
                      : "200ms",
                }}
              >
                <div className="px-5 pb-4 text-gray-700 leading-relaxed">
                  {/* Support bold markdown with simple string replacement */}
                  {item.answer.split("**").map((part, index) => {
                    // Odd indices are bolded
                    if (index % 2 === 1) {
                      return (
                        <strong key={index} className="font-semibold text-gray-900">
                          {part}
                        </strong>
                      );
                    }
                    return <span key={index}>{part}</span>;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-700 font-medium mb-4">Still have questions?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            asChild
            className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
            onClick={() => handleCTAClick("contact")}
          >
            <a href="mailto:support@servio.uk">
              <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
              Contact us
            </a>
          </Button>
          <Button
            variant="servio"
            asChild
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => handleCTAClick("trial")}
          >
            <Link href="/sign-up">
              Start free trial
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * FAQ JSON-LD Schema for SEO
 * 
 * Use this in your page's <head> or Next.js metadata for rich search results.
 * 
 * @example
 * ```tsx
 * // In app/page.tsx or layout.tsx
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
 * />
 * ```
 */
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
        .replace(/\*\*/g, "") // Remove markdown bold markers
        .trim(),
    },
  })),
};

