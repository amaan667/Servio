import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Receipt, Mail, FileText } from "lucide-react";

interface ReceiptSettingsCardProps {
  autoEmailReceipts: boolean;
  setAutoEmailReceipts: (value: boolean) => void;
  showVATBreakdown: boolean;
  setShowVATBreakdown: (value: boolean) => void;
  allowEmailInput: boolean;
  setAllowEmailInput: (value: boolean) => void;
  receiptLogoUrl?: string;
  setReceiptLogoUrl: (url: string) => void;
  receiptFooterText?: string;
  setReceiptFooterText: (text: string) => void;
}

export function ReceiptSettingsCard({
  autoEmailReceipts,
  setAutoEmailReceipts,
  showVATBreakdown,
  setShowVATBreakdown,
  allowEmailInput,
  setAllowEmailInput,
  receiptLogoUrl,
  setReceiptLogoUrl,
  receiptFooterText,
  setReceiptFooterText,
}: ReceiptSettingsCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Receipt className="h-5 w-5 text-purple-600" />
          Receipts & Payments
        </CardTitle>
        <CardDescription>Configure receipt settings and payment behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Auto Email Receipts Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="autoEmailReceipts" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Automatically email receipts after each order
            </Label>
            <p className="text-sm text-gray-600">
              Customers will receive receipts via email automatically when orders are placed
            </p>
          </div>
          <Switch
            id="autoEmailReceipts"
            checked={autoEmailReceipts}
            onCheckedChange={setAutoEmailReceipts}
          />
        </div>

        {/* Show VAT Breakdown Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showVATBreakdown" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Show VAT breakdown on receipts
            </Label>
            <p className="text-sm text-gray-600">
              Display VAT amount separately on receipts (UK standard 20% VAT)
            </p>
          </div>
          <Switch
            id="showVATBreakdown"
            checked={showVATBreakdown}
            onCheckedChange={setShowVATBreakdown}
          />
        </div>

        {/* Allow Email Input Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allowEmailInput" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Allow customers to enter email on success screen
            </Label>
            <p className="text-sm text-gray-600">
              Show email input field on order success screen for receipt delivery
            </p>
          </div>
          <Switch
            id="allowEmailInput"
            checked={allowEmailInput}
            onCheckedChange={setAllowEmailInput}
          />
        </div>

        <div className="border-t pt-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Receipt Branding</h3>

          {/* Receipt Logo URL */}
          <div>
            <Label htmlFor="receiptLogoUrl">Receipt Logo URL</Label>
            <Input
              id="receiptLogoUrl"
              type="url"
              value={receiptLogoUrl || ""}
              onChange={(e) => setReceiptLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="rounded-lg mt-1"
            />
            <p className="text-sm text-gray-600 mt-1">
              URL to your logo image to display on receipts
            </p>
          </div>

          {/* Receipt Footer Text */}
          <div>
            <Label htmlFor="receiptFooterText">Receipt Footer Text</Label>
            <Input
              id="receiptFooterText"
              value={receiptFooterText || ""}
              onChange={(e) => setReceiptFooterText(e.target.value)}
              placeholder="Thank you for your order!"
              className="rounded-lg mt-1"
            />
            <p className="text-sm text-gray-600 mt-1">
              Custom text to display at the bottom of receipts
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


