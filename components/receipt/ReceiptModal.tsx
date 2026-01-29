"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, MessageSquare, Download, Printer, Loader2, CheckCircle2 } from "lucide-react";
import { Order } from "@/types/order";

interface ReceiptModalProps {
  order: Order;
  venueEmail?: string;
  venueAddress?: string;
  logoUrl?: string;
  primaryColor?: string;
  isOpen: boolean;
  onClose: () => void;
  showVAT?: boolean;
  isCustomerView?: boolean;
}

export function ReceiptModal({
  order,
  venueEmail: _venueEmail,
  venueAddress: _venueAddress,
  logoUrl: _logoUrl,
  primaryColor: _primaryColor = "#8b5cf6",
  isOpen,
  onClose,
  showVAT = true,
  isCustomerView = false,
}: ReceiptModalProps) {
  const [email, setEmail] = useState(order.customer_email || "");
  const [phone, setPhone] = useState(order.customer_phone || "");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate VAT (20% UK standard rate)
  const subtotal = order.total_amount || 0;
  const vatRate = 0.2;
  const vatAmount = showVAT ? subtotal * (vatRate / (1 + vatRate)) : 0;
  const netAmount = showVAT ? subtotal - vatAmount : subtotal;

  const getShortOrderNumber = (orderId: string) => {
    return orderId.slice(-6).toUpperCase();
  };

  const handleSendEmail = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setSendingEmail(true);
      setError(null);

      const response = await fetch("/api/receipts/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          email,
          venueId: order.venue_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    try {
      setSendingSMS(true);
      setError(null);

      const response = await fetch("/api/receipts/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          phone,
          venueId: order.venue_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send SMS");
      }

      setSmsSent(true);
      setTimeout(() => setSmsSent(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSendingSMS(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/receipts/pdf/${order.id}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const contentType = response.headers.get("content-type");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Determine file extension based on content type
      const isPDF = contentType?.includes("application/pdf");
      a.download = `receipt-${getShortOrderNumber(order.id)}.${isPDF ? "pdf" : "html"}`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt - Order #{getShortOrderNumber(order.id)}</DialogTitle>
          <DialogDescription>
            {order.customer_name} - Table {order.table_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Order Date:</span>
              <span>{order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Table:</span>
              <span>{order.table_number}</span>
            </div>
            {showVAT && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span>Net Amount:</span>
                  <span>£{netAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT (20%):</span>
                  <span>£{vatAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
          </div>

          {!isCustomerView && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || emailSent || !email}
                    variant="outline"
                    size="sm"
                  >
                    {sendingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : emailSent ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <Mail className="h-4 w-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 7XXX XXXXXX"
                  />
                  <Button
                    onClick={handleSendSMS}
                    disabled={sendingSMS || smsSent || !phone}
                    variant="outline"
                    size="sm"
                  >
                    {sendingSMS ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : smsSent ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
            </>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <Button onClick={onClose} className="w-full" variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
