"use client";

import { Button } from "@/components/ui/button";
import { QrCode, ArrowRight } from "lucide-react";

interface CTASectionProps {

}

export function CTASection({
  isSignedIn,
  authLoading,
  onGetStarted,
  onSignIn,
  onDemo,
}: CTASectionProps) {
  return (
    <section className="py-24 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl font-bold mb-6 !text-white">
          Ready to Transform Your Food Business?
        </h2>
        <p className="text-xl !text-white mb-8">
          Join restaurants, cafes, food trucks, and stalls across the UK using Servio to streamline
          operations and delight customers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={onGetStarted}
            variant="servio"
            className="text-lg px-8 py-4"
            disabled={authLoading}
          >
            {authLoading ? "Loading..." : isSignedIn ? "Go to Dashboard" : "Start Your Free Trial"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {!authLoading && !isSignedIn && (
            <Button size="lg" onClick={onSignIn} variant="servio" className="text-lg px-8 py-4">
              Sign In
            </Button>
          )}
          <Button size="lg" onClick={onDemo} variant="servio" className="text-lg px-8 py-4">
            <QrCode className="mr-2 h-5 w-5" />
            Try the Demo
          </Button>
        </div>
      </div>
    </section>
  );
}
