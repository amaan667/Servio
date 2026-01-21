import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <p className="text-gray-300 mb-6 max-w-md">
              Servio provides complete POS and ordering solutions for food businesses of all sizes.
              Transform your operations today.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white">
                <span className="sr-only">Facebook</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white"
                asChild
              >
                <Link href="https://www.instagram.com/servio__/" target="_blank" rel="noopener noreferrer">
                  <span className="sr-only">Instagram</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12.017 0C8.396 0 7.917.016 6.737.07 5.558.126 4.75.333 4.025.63c-.78.306-1.44.716-2.096 1.372C1.273 2.658 1.273 3.318.967 4.098.67 4.823.463 5.631.407 6.81.353 7.99.337 8.469.337 12.09c0 3.621.016 4.1.07 5.28.056 1.179.263 1.987.56 2.712.306.78.716 1.44 1.372 2.096.656.656 1.316 1.066 2.096 1.372.725.297 1.533.504 2.712.56 1.18.054 1.659.07 5.28.07 3.621 0 4.1-.016 5.28-.07 1.179-.056 1.987-.263 2.712-.56.78-.306 1.44-.716 2.096-1.372.656-.656 1.066-1.316 1.372-2.096.297-.725.504-1.533.56-2.712.054-1.18.07-1.659.07-5.28 0-3.621-.016-4.1-.07-5.28-.056-1.179-.263-1.987-.56-2.712-.306-.78-.716-1.44-1.372-2.096C20.682 1.273 20.022.967 19.242.67c-.725-.297-1.533-.504-2.712-.56C16.35.016 15.871 0 12.25 0h-.233zm0 2.163c3.574 0 4.01.014 5.42.078 1.302.061 2.007.277 2.47.46.608.238 1.04.554 1.498 1.012.458.458.774.89 1.012 1.498.183.463.399 1.168.46 2.47.064 1.41.078 1.846.078 5.42s-.014 4.01-.078 5.42c-.061 1.302-.277 2.007-.46 2.47-.238.608-.554 1.04-1.012 1.498-.458.458-.89.774-1.498 1.012-.463.183-1.168.399-2.47.46-1.41.064-1.846.078-5.42.078s-4.01-.014-5.42-.078c-1.302-.061-2.007-.277-2.47-.46-.608-.238-1.04-.554-1.498-1.012-.458-.458-.774-.89-1.012-1.498-.183-.463-.399-1.168-.46-2.47-.064-1.41-.078-1.846-.078-5.42s.014-4.01.078-5.42c.061-1.302.277-2.007.46-2.47.238-.608.554-1.04 1.012-1.498.458-.458.89-.774 1.498-1.012.463-.183 1.168-.399 2.47-.46 1.41-.064 1.846-.078 5.42-.078zm0 3.957a6.907 6.907 0 100 13.814 6.907 6.907 0 000-13.814zm0 2.163a4.744 4.744 0 110 9.488 4.744 4.744 0 010-9.488zm6.406-3.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white"
                asChild
              >
                <Link href="http://linkedin.com/company/servioplatform" target="_blank" rel="noopener noreferrer">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/demo" className="text-gray-300 hover:text-white transition-colors">
                  Demo
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="text-gray-300 hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:support@servio.app"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-gray-300 hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; 2024 Servio. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
