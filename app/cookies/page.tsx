import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {

  description:
    "Understand how Servio uses cookies and similar technologies. Learn about essential, functional, and analytics cookies on our platform.",

  },
};

export default function CookiePolicyPage() {
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
          <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
          <p className="text-gray-600 mb-8">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-GB", {

            })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies?</h2>
            <p className="text-gray-700 mb-4">
              Cookies are small text files that are placed on your device when you visit our
              website. They help us provide you with a better experience by remembering your
              preferences and enabling essential functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-700 mb-4">Servio uses cookies for the following purposes:</p>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Essential Cookies (Required)</h3>
            <p className="text-gray-700 mb-4">
              These cookies are necessary for the Service to function:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Authentication cookies</strong> - Keep you logged in securely
              </li>
              <li>
                <strong>Session cookies</strong> - Maintain your session state
              </li>
              <li>
                <strong>Security cookies</strong> - Protect against fraud and attacks
              </li>
              <li>
                <strong>Load balancing</strong> - Ensure optimal performance
              </li>
            </ul>
            <p className="text-gray-700 mb-4 italic">
              You cannot opt out of essential cookies as they are required for the Service to work.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Functional Cookies</h3>
            <p className="text-gray-700 mb-4">These cookies enhance your experience:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Preferences</strong> - Remember your settings (theme, language)
              </li>
              <li>
                <strong>Recent venues</strong> - Quick access to your venues
              </li>
              <li>
                <strong>Display preferences</strong> - UI customization
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Analytics Cookies (Optional)</h3>
            <p className="text-gray-700 mb-4">Help us understand how the Service is used:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Usage analytics</strong> - Page views, feature usage (anonymized)
              </li>
              <li>
                <strong>Performance monitoring</strong> - Loading times, errors
              </li>
              <li>
                <strong>Improvement insights</strong> - Help us enhance features
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Specific Cookies We Use</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Cookie Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">
                      sb-*-auth-token
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">
                      Authentication & session
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">Essential</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">7 days</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">theme</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">
                      Remember dark/light mode
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">Functional</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">1 year</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">
                      servio-session
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">
                      Session management
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">Essential</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-700">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Third-Party Cookies</h2>
            <p className="text-gray-700 mb-4">
              We use the following third-party services that may set cookies:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Stripe (Payment Processing)</h3>
            <p className="text-gray-700 mb-4">
              Stripe uses cookies to process payments securely and prevent fraud. See{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Stripe's Privacy Policy
              </a>
              .
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Supabase (Infrastructure)</h3>
            <p className="text-gray-700 mb-4">
              Our database provider uses cookies for authentication and session management. See{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Supabase's Privacy Policy
              </a>
              .
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.3 Google Cloud (AI Features)</h3>
            <p className="text-gray-700 mb-4">
              Google Cloud services process menu uploads and AI requests. See{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google's Privacy Policy
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Managing Cookies</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Browser Settings</h3>
            <p className="text-gray-700 mb-4">
              You can control cookies through your browser settings:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <strong>Chrome:</strong> Settings → Privacy and Security → Cookies
              </li>
              <li>
                <strong>Firefox:</strong> Options → Privacy & Security → Cookies
              </li>
              <li>
                <strong>Safari:</strong> Preferences → Privacy → Cookies
              </li>
              <li>
                <strong>Edge:</strong> Settings → Privacy → Cookies
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Impact of Disabling Cookies</h3>
            <p className="text-gray-700 mb-4">If you disable or refuse cookies:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>You may not be able to log in or use certain features</li>
              <li>Your preferences will not be saved</li>
              <li>Some functionality may be limited</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Updates to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Cookie Policy from time to time. Any changes will be posted on this
              page with an updated revision date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about our use of cookies, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700">
                <strong>Email:</strong>{" "}
                <a href="mailto:privacy@servio.app" className="text-purple-600 hover:underline">
                  privacy@servio.app
                </a>
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Website:</strong>{" "}
                <a href="https://servio.app" className="text-purple-600 hover:underline">
                  servio.app
                </a>
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. More Information</h2>
            <p className="text-gray-700 mb-4">
              For more information about cookies and how to manage them, visit:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>
                <a
                  href="https://www.allaboutcookies.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  AllAboutCookies.org
                </a>
              </li>
              <li>
                <a
                  href="https://ico.org.uk/for-the-public/online/cookies/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  UK ICO Cookie Guidance
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
