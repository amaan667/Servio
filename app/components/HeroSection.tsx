"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, ArrowRight, CheckCircle } from "lucide-react";

interface HeroSectionProps {

}

export function HeroSection({
  isSignedIn,

  onGetStarted,
  onSignIn,
  onDemo,
}: HeroSectionProps) {
  return (
    <section className="relative bg-gradient-to-br from-[#7c3aed] via-[#7a3bec] to-[#6d28d9] text-white overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/5 pointer-events-none"></div>
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div
          className="absolute top-0 -right-4 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative max-w-screen-xl mx-auto px-6 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-3xl sm:max-w-xl md:max-w-2xl">
            <h1
              className="!text-white text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-tight font-extrabold"
              style={{
                textShadow:
                  "0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.8), 0 16px 64px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,1)",
                filter: "drop-shadow(0 0 20px rgba(255,255,255,0.4))",
              }}
            >
              POS & QR Ordering Made Simple
            </h1>
            <p
              className="mt-5 !text-white text-[clamp(1rem,2.2vw,1.25rem)] leading-relaxed max-w-[50ch]"
              style={{
                textShadow:
                  "0 2px 20px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.5), 0 0 30px rgba(255,255,255,0.2)",
              }}
            >
              Run your entire venue from any device — no hardware required. Accept orders, manage
              payments, display tickets in the kitchen, and track inventory — all in one simple
              platform.
            </p>
            <div className="mt-8 flex items-center gap-4 flex-wrap">
              {!isSignedIn && (
                <Button
                  size="lg"
                  onClick={onGetStarted}
                  variant="servio"
                  className="text-lg px-8 py-4"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
              {!isSignedIn && (
                <Button size="lg" onClick={onSignIn} variant="servio" className="text-lg px-8 py-4">
                  Sign In
                </Button>
              )}
              {isSignedIn && (
                <Button
                  size="lg"
                  onClick={onGetStarted}
                  variant="servio"
                  className="text-lg px-8 py-4"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
              <Button size="lg" onClick={onDemo} variant="servio" className="text-lg px-8 py-4">
                <QrCode className="mr-2 h-5 w-5" />
                View Demo
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle
                  className="h-5 w-5 !text-white"
                  strokeWidth={2}
                  style={{ color: "#ffffff", stroke: "#ffffff" }}
                />
                <span
                  className="font-semibold !text-white whitespace-nowrap"
                  style={{ color: "#ffffff" }}
                >
                  14-day free trial
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle
                  className="h-5 w-5 !text-white"
                  strokeWidth={2}
                  style={{ color: "#ffffff", stroke: "#ffffff" }}
                />
                <span
                  className="font-semibold !text-white whitespace-nowrap"
                  style={{ color: "#ffffff" }}
                >
                  No setup fees
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle
                  className="h-5 w-5 !text-white"
                  strokeWidth={2}
                  style={{ color: "#ffffff", stroke: "#ffffff" }}
                />
                <span
                  className="font-semibold !text-white whitespace-nowrap"
                  style={{ color: "#ffffff" }}
                >
                  Cancel anytime
                </span>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl blur-2xl opacity-40 animate-pulse"></div>
            <div
              className="relative bg-white rounded-2xl p-8 transform rotate-3 hover:rotate-0 transition-all duration-300"
              style={{
                boxShadow:
                  "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 60px rgba(255,255,255,0.3), 0 0 100px rgba(124,58,237,0.5)",
              }}
            >
              <div className="text-center">
                <div className="w-32 h-32 bg-purple-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Table 5</h3>
                <p className="text-gray-800 mb-4">Scan to view menu & order</p>
                <Badge className="bg-green-100 text-green-800">Ready to Order</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
