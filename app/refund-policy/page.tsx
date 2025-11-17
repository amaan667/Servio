import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Servio's refund policy for food business POS subscriptions including 14-day money-back guarantee, service failure refunds, and fair cancellation terms.",
  openGraph: {
    title: "Refund Policy | Servio",
    description: "14-day money-back guarantee and fair refund terms for Servio POS subscriptions.",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-8">Refund Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Our Commitment</h2>
            <p className="text-foreground mb-4">
              At Servio, we're committed to your satisfaction. This Refund Policy explains the circumstances under which we provide refunds 
              and how to request one.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. 14-Day Free Trial</h2>
            <p className="text-foreground mb-4">
              All new accounts include a 14-day free trial. During this period:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>You can test all features of your selected plan</li>
              <li>No payment is required or charged</li>
              <li>You can cancel anytime with no obligation</li>
              <li>If you cancel before the trial ends, you will not be charged</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Money-Back Guarantee</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">3.1 14-Day Money-Back Guarantee</h3>
            <p className="text-foreground mb-4">
              If you're not satisfied with Servio within the first 14 days of your first paid subscription (after the trial period ends), 
              we'll provide a full refund. To be eligible:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Request must be made within 14 days of your first payment</li>
              <li>Contact us at <a href="mailto:support@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@servio.app</a></li>
              <li>Provide your account email and reason for cancellation</li>
            </ul>
            <p className="text-foreground mb-4">
              Refunds are processed within 5-10 business days to your original payment method.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Service Failure Refunds</h2>
            <p className="text-foreground mb-4">
              We strive for 99.9% uptime. If our Service is unavailable for more than 24 consecutive hours due to issues on our end:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>You're eligible for a pro-rata refund for the downtime period</li>
              <li>Downtime must be reported within 7 days of occurrence</li>
              <li>Scheduled maintenance (with notice) is not eligible</li>
              <li>Third-party service failures (Stripe, internet providers) are not eligible</li>
            </ul>
            <p className="text-foreground mb-4">
              To claim a service failure refund, contact <a href="mailto:support@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@servio.app</a> with:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Date and time of the outage</li>
              <li>Duration of service unavailability</li>
              <li>Impact on your business (optional)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Billing Error Refunds</h2>
            <p className="text-foreground mb-4">
              If you're charged incorrectly due to a billing error:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Contact us immediately at <a href="mailto:billing@servio.app" className="text-purple-600 hover:underline">billing@servio.app</a></li>
              <li>We'll investigate and process a refund within 5 business days</li>
              <li>Full refund will be issued for the incorrect amount</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Non-Refundable Situations</h2>
            <p className="text-foreground mb-4">
              Refunds are <strong>NOT</strong> provided in the following cases:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Partial month usage:</strong> No refunds for unused time in a billing period</li>
              <li><strong>Feature changes:</strong> After the 14-day guarantee period</li>
              <li><strong>Account termination:</strong> For violating our Terms of Service</li>
              <li><strong>Downgrade requests:</strong> When switching to a lower-tier plan mid-cycle</li>
              <li><strong>Third-party issues:</strong> Problems with Stripe, payment processors, or your bank</li>
              <li><strong>Change of mind:</strong> After the 14-day money-back guarantee period</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cancellation vs. Refund</h2>
            <p className="text-foreground mb-4">
              Important distinction:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Cancellation:</strong> Stops future billing but no refund for current period</li>
              <li><strong>Refund:</strong> Returns money for eligible charges as per this policy</li>
            </ul>
            <p className="text-foreground mb-4">
              When you cancel, you retain access until the end of your paid period. See our <Link href="/terms" className="text-purple-600 dark:text-purple-400 hover:underline">Terms of Service</Link> for details.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. How to Request a Refund</h2>
            <p className="text-foreground mb-4">
              To request a refund:
            </p>
            <div className="bg-purple-50 dark:bg-purple-950/30 border-l-4 border-purple-500 dark:border-purple-600 p-6 mb-4">
              <ol className="list-decimal pl-6 space-y-2 text-foreground">
                <li>Email <a href="mailto:support@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">support@servio.app</a> with subject "Refund Request"</li>
                <li>Include your account email and subscription details</li>
                <li>State the reason for your refund request</li>
                <li>Provide unknown supporting documentation (for service failures)</li>
              </ol>
            </div>
            <p className="text-foreground mb-4">
              We aim to respond to all refund requests within 2 business days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Refund Processing Time</h2>
            <p className="text-foreground mb-4">
              Once approved, refunds are processed:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Stripe refunds:</strong> 5-10 business days to appear in your account</li>
              <li><strong>Bank processing:</strong> May take additional 3-5 days depending on your bank</li>
              <li><strong>Credit card:</strong> Appears as a credit on your next statement</li>
            </ul>
            <p className="text-foreground mb-4">
              You'll receive an email confirmation when the refund is processed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Disputes and Chargebacks</h2>
            <p className="text-foreground mb-4">
              <strong>Please contact us before initiating a chargeback.</strong> Chargebacks:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>May result in immediate account suspension</li>
              <li>Incur additional fees that may be passed to you</li>
              <li>Can be resolved more quickly through our support team</li>
            </ul>
            <p className="text-foreground mb-4">
              We're committed to resolving billing issues fairly and quickly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-foreground mb-4">
              We may update this Refund Policy from time to time. Changes will be posted on this page with an updated date. 
              Material changes will be communicated via email.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-foreground mb-4">
              Questions about our refund policy? We're here to help:
            </p>
            <div className="bg-muted dark:bg-card p-6 rounded-lg">
              <p className="text-foreground"><strong>Email:</strong> <a href="mailto:support@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@servio.app</a></p>
              <p className="text-foreground mt-2"><strong>Billing:</strong> <a href="mailto:billing@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline">billing@servio.app</a></p>
              <p className="text-foreground mt-2"><strong>General:</strong> <a href="mailto:hello@servio.app" className="text-purple-600 dark:text-purple-400 hover:underline">hello@servio.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

