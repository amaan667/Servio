import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Servio collects, uses, and protects your personal information. UK GDPR compliant privacy policy for our POS and ordering platform.",
  openGraph: {
    title: "Privacy Policy | Servio",
    description: "Learn how Servio protects your data and complies with UK GDPR regulations.",
  },
};

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Welcome to Servio ("we," "our," or "us"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our point-of-sale and
              ordering platform and services.
            </p>
            <p className="text-gray-700 mb-4">
              Servio is operated from the United Kingdom and complies with the UK General Data
              Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Business Account Information</h3>
            <p className="text-gray-700 mb-4">
              When you create a Servio business account for your restaurant, cafe, food truck,
              market stall, or other food service business, we collect:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Name and email address</li>
              <li>Business name and address (or operating location)</li>
              <li>Phone number</li>
              <li>Payment information (processed securely by Stripe)</li>
              <li>VAT number (if applicable)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Customer Order Information</h3>
            <p className="text-gray-700 mb-4">
              When customers place orders through your QR codes (at tables, counters, trucks, or
              stalls), we collect:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Customer name (optional)</li>
              <li>Table number, counter location, truck window, or stall identifier</li>
              <li>Order details (items, quantities, special instructions)</li>
              <li>Payment information (processed by Stripe, we do not store card details)</li>
              <li>Order timestamps and status</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Technical Information</h3>
            <p className="text-gray-700 mb-4">We automatically collect:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>IP address and browser type</li>
              <li>Device information and operating system</li>
              <li>Usage data and analytics (pages visited, features used)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Provide Services:</strong> Process orders, manage your business operations,
                and deliver our platform features
              </li>
              <li>
                <strong>Process Payments:</strong> Handle billing and subscriptions through Stripe
              </li>
              <li>
                <strong>Customer Support:</strong> Respond to your inquiries and provide technical
                assistance
              </li>
              <li>
                <strong>Improve Our Platform:</strong> Analyze usage patterns to enhance features
                and performance
              </li>
              <li>
                <strong>Communication:</strong> Send service updates, security alerts, and marketing
                communications (with your consent)
              </li>
              <li>
                <strong>Legal Compliance:</strong> Comply with applicable laws and regulations
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing (UK GDPR)</h2>
            <p className="text-gray-700 mb-4">
              We process your personal data under the following legal bases:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Contract Performance:</strong> To provide services you've subscribed to
              </li>
              <li>
                <strong>Legitimate Interest:</strong> To improve our platform and prevent fraud
              </li>
              <li>
                <strong>Consent:</strong> For marketing communications (you can opt-out anytime)
              </li>
              <li>
                <strong>Legal Obligation:</strong> To comply with tax, accounting, and legal
                requirements
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Service Providers:</strong> Stripe (payments), Supabase (database), Google
                Cloud (infrastructure), OpenAI (AI features)
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In case of merger, acquisition, or asset sale
              </li>
            </ul>
            <p className="text-gray-700 mb-4">
              <strong>We never sell your personal data to third parties.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication with OAuth 2.0 and PKCE flow</li>
              <li>Row-level security in our database</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p className="text-gray-700 mb-4">We retain your information:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Account Data:</strong> Until you delete your account
              </li>
              <li>
                <strong>Order Data:</strong> For 7 years (UK tax compliance requirements)
              </li>
              <li>
                <strong>Analytics Data:</strong> For 2 years
              </li>
              <li>
                <strong>Backup Data:</strong> For 30 days after deletion
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights (UK GDPR)</h2>
            <p className="text-gray-700 mb-4">Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Rectification:</strong> Correct inaccurate or incomplete data
              </li>
              <li>
                <strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")
              </li>
              <li>
                <strong>Restrict Processing:</strong> Limit how we use your data
              </li>
              <li>
                <strong>Data Portability:</strong> Receive your data in a machine-readable format
              </li>
              <li>
                <strong>Object:</strong> Object to processing based on legitimate interests
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Withdraw consent for marketing communications
              </li>
            </ul>
            <p className="text-gray-700 mb-4">
              To exercise these rights, contact us at:{" "}
              <a href="mailto:privacy@servio.app" className="text-purple-600 hover:underline">
                privacy@servio.app
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">We use essential cookies to:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Maintain your session and keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Analyze platform usage (anonymized)</li>
            </ul>
            <p className="text-gray-700 mb-4">
              For more details, see our{" "}
              <Link href="/cookies" className="text-purple-600 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
            <p className="text-gray-700 mb-4">
              Your data may be transferred to and processed in countries outside the UK. We ensure
              adequate safeguards are in place through:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Standard Contractual Clauses approved by the UK ICO</li>
              <li>Service providers with UK GDPR-compliant practices</li>
              <li>Encryption and security measures during transfers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Servio is not intended for children under 16. We do not knowingly collect personal
              information from children. If you believe we have collected data from a child, please
              contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of unknown
              material changes by:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Posting the new policy on this page with an updated date</li>
              <li>Sending an email notification to your registered address</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy or wish to exercise your rights,
              please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg mb-4">
              <p className="text-gray-700">
                <strong>Email:</strong>{" "}
                <a href="mailto:privacy@servio.app" className="text-purple-600 hover:underline">
                  privacy@servio.app
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

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Supervisory Authority</h2>
            <p className="text-gray-700 mb-4">
              If you have concerns about how we handle your data, you have the right to lodge a
              complaint with the UK Information Commissioner's Office (ICO):
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700">
                <strong>Website:</strong>{" "}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  ico.org.uk
                </a>
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Phone:</strong> 0303 123 1113
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Address:</strong> Information Commissioner's Office, Wycliffe House, Water
                Lane, Wilmslow, Cheshire, SK9 5AF
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
