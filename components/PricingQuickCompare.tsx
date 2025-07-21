import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PricingQuickCompare() {
  return (
    <div className="w-full flex flex-col items-center gap-8 py-10">
      <h2 className="text-3xl font-bold mb-4">Simple Pricing, No Surprises</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Basic Tier */}
        <Card className="flex flex-col items-center p-6 gap-4">
          <div className="text-2xl font-semibold">Basic</div>
          <div className="text-3xl font-bold mb-1">£99<span className="text-lg font-normal">/mo</span></div>
          <div className="text-gray-500 mb-3">For small cafes & food trucks</div>
          <ul className="mb-4 space-y-1 text-center">
            <li>Up to <b>10 tables</b></li>
            <li>Menu uploads (PDF/URL)</li>
            <li>Core QR ordering</li>
            <li>14-day free trial</li>
          </ul>
          <Button className="w-full" variant="default">Choose Basic</Button>
        </Card>
        {/* Standard Tier */}
        <Card className="flex flex-col items-center p-6 gap-4 border-2 border-blue-500 shadow-lg scale-105">
          <div className="text-2xl font-semibold text-blue-700">Standard</div>
          <div className="text-3xl font-bold mb-1 text-blue-700">£169<span className="text-lg font-normal">/mo</span></div>
          <div className="text-gray-500 mb-3">Best for most restaurants</div>
          <ul className="mb-4 space-y-1 text-center">
            <li>Up to <b>20 tables</b></li>
            <li>Menu uploads (PDF/URL)</li>
            <li>Full analytics & support</li>
            <li>14-day free trial</li>
          </ul>
          <Button className="w-full" variant="default">Choose Standard</Button>
        </Card>
        {/* Premium Tier */}
        <Card className="flex flex-col items-center p-6 gap-4">
          <div className="text-2xl font-semibold">Premium</div>
          <div className="text-3xl font-bold mb-1">£299<span className="text-lg font-normal">/mo</span></div>
          <div className="text-gray-500 mb-3">Multi-site or unlimited venues</div>
          <ul className="mb-4 space-y-1 text-center">
            <li><b>Unlimited tables & venues</b></li>
            <li>Priority support</li>
            <li>Advanced integrations</li>
            <li>Custom onboarding</li>
          </ul>
          <Button className="w-full" variant="default">Choose Premium</Button>
        </Card>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        Need custom pricing or help deciding? <a href="mailto:support@servio.uk" className="underline text-blue-700">Contact us</a>
      </div>
    </div>
  );
} 