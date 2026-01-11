import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {

  description:
    "Read Servio's terms of service, including subscription plans, refund policy, and acceptable use policy for our POS and ordering platform.",

  },
};

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          <p className="text-gray-600 mb-8">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-GB", {

            })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing or using Servio's point-of-sale and ordering platform ("Service"), you
              agree to be bound by these Terms of Service ("Terms"). If you do not agree to these
              Terms, please do not use our Service.
            </p>
            <p className="text-gray-700 mb-4">
              These Terms constitute a legally binding agreement between you and Servio.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              Servio provides a cloud-based point-of-sale (POS) and ordering platform for food and
              beverage businesses including restaurants, cafes, food trucks, and market stalls. The
              Service enables you to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Generate QR codes for tables, counters, trucks, and stalls</li>
              <li>Manage digital menus with AI-powered tools</li>
              <li>Receive and process customer orders in real-time</li>
              <li>Process payments through integrated payment systems</li>
              <li>Manage kitchen operations with Kitchen Display System (KDS)</li>
              <li>Track inventory and stock levels</li>
              <li>Manage staff with role-based permissions</li>
              <li>Access analytics and reporting tools</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.1 Eligibility</h3>
            <p className="text-gray-700 mb-4">
              You must be at least 18 years old and authorized to enter into contracts to use
              Servio. By registering, you represent that you have the legal authority to bind your
              business (restaurant, cafe, food truck, market stall, or other food service
              operation).
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Security</h3>
            <p className="text-gray-700 mb-4">You are responsible for:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of unknown unauthorized access</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Subscription Plans and Pricing</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Subscription Tiers</h3>
            <p className="text-gray-700 mb-4">Servio offers three subscription tiers:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Starter:</strong> £99/month - Up to 10 tables, 50 menu items, basic features
              </li>
              <li>
                <strong>Pro:</strong> £249/month - Up to 20 tables, 200 menu items, KDS & Inventory
              </li>
              <li>
                <strong>Enterprise:</strong> £449+/month - Unlimited tables & venues, AI Assistant,
                priority support
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Free Trial</h3>
            <p className="text-gray-700 mb-4">
              New accounts receive a 14-day free trial. You will not be charged during the trial
              period. To continue using Servio after the trial, you must provide valid payment
              information.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.3 Billing</h3>
            <p className="text-gray-700 mb-4">
              Subscriptions are billed monthly in advance. All prices are in British Pounds (GBP)
              and exclude VAT, which will be added where applicable.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.4 Payment</h3>
            <p className="text-gray-700 mb-4">
              Payments are processed securely through Stripe. By providing payment information, you
              authorize us to charge your payment method for all applicable fees.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Cancellation and Refunds</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Cancellation</h3>
            <p className="text-gray-700 mb-4">
              You may cancel your subscription at unknown time through your account settings or by
              contacting support. Cancellation takes effect at the end of your current billing
              period.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Refund Policy</h3>
            <p className="text-gray-700 mb-4">
              We offer refunds under the following circumstances:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Service Failure:</strong> If our Service is unavailable for more than 24
                consecutive hours (pro-rata refund)
              </li>
              <li>
                <strong>14-Day Money-Back:</strong> Full refund if you cancel within 14 days of your
                first paid subscription (after trial)
              </li>
              <li>
                <strong>Billing Errors:</strong> Full refund for unknown incorrect charges
              </li>
            </ul>
            <p className="text-gray-700 mb-4">
              Refunds are not provided for partial months or unused features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Acceptable Use Policy</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Use the Service for unknown illegal or unauthorized purpose</li>
              <li>Violate unknown laws in your jurisdiction</li>
              <li>Upload malicious code or attempt to breach security</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Scrape, copy, or reverse engineer our platform</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Use the Service to process fraudulent transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              Servio and its original content, features, and functionality are owned by us and are
              protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-gray-700 mb-4">
              You retain all rights to your business data (menus, orders, customer information). We
              do not claim ownership of your content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
            <p className="text-gray-700 mb-4">
              We strive to provide 99.9% uptime but do not guarantee uninterrupted service. We may:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Perform scheduled maintenance (with advance notice)</li>
              <li>Make emergency updates for security or performance</li>
              <li>Modify or discontinue features with reasonable notice</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              To the maximum extent permitted by law, Servio shall not be liable for:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Indirect, incidental, special, or consequential damages</li>
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Service interruptions or data loss</li>
              <li>Third-party actions (payment processor failures, infrastructure outages)</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Our total liability shall not exceed the amount you paid us in the 12 months preceding
              the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
            <p className="text-gray-700 mb-4">
              You agree to indemnify and hold Servio harmless from unknown claims, damages, or
              expenses arising from:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of unknown third-party rights</li>
              <li>Content you upload or process through our Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account immediately, without prior notice, if you:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Breach these Terms</li>
              <li>Fail to pay subscription fees</li>
              <li>Engage in fraudulent or illegal activity</li>
              <li>Violate our Acceptable Use Policy</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Upon termination, you will lose access to your account and data. We may retain data as
              required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These Terms are governed by the laws of England and Wales. Any disputes will be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify these Terms at unknown time. Material changes will be
              communicated via email at least 30 days before taking effect. Continued use of the
              Service after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p className="text-gray-700 mb-4">For questions about these Terms, please contact:</p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700">
                <strong>Email:</strong>{" "}
                <a href="mailto:legal@servio.app" className="text-purple-600 hover:underline">
                  legal@servio.app
                </a>
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Support:</strong>{" "}
                <a href="mailto:support@servio.app" className="text-purple-600 hover:underline">
                  support@servio.app
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
