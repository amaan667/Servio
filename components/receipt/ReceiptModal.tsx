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
import {
  Receipt,
  Mail,
  MessageSquare,
  Download,
  Printer,
  Loader2,
  CheckCircle2,
} from "lucide-react";
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
  venueEmail,
  venueAddress,
  logoUrl,
  primaryColor = "#8b5cf6",
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
    <>
      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .receipt-print-content,
            .receipt-print-content * {
              visibility: visible;
            }
            .receipt-print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white;
            }
            .no-print {
              display: none !important;
            }
            @page {
              margin: 15mm;
              size: A4;
            }
          }
        `,
        }}
      />

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none receipt-print-content">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipt #{getShortOrderNumber(order.id)}
            </DialogTitle>
            <DialogDescription>
              {order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Receipt Content */}
          <div className="space-y-6 print:space-y-4">
            {/* Venue Info */}
            <div 
              className="text-center border-b pb-6 print:border-b-2 print:pb-8"
              style={{ borderBottomColor: primaryColor }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-32 mx-auto mb-4 print:h-40 print:mb-6 max-w-full object-contain"
                />
              )}
              {venueAddress && (
                <p className="text-sm text-gray-600 mt-2 print:text-base">{venueAddress}</p>
              )}
              {venueEmail && <p className="text-sm text-gray-600 print:text-base">{venueEmail}</p>}
            </div>

            {/* Order Details */}
            <div className="bg-gray-50 p-4 rounded-lg print:bg-transparent print:p-0 print:border print:border-gray-200 print:rounded print:p-3">
              <div className="mb-3 pb-2 border-b border-gray-300 print:border-b-2">
                <span 
                  className="text-lg font-bold print:text-xl"
                  style={{ color: primaryColor }}
                >
                  Order #{getShortOrderNumber(order.id)}
                </span>
              </div>
              <div className="space-y-2">
                {order.table_number && (
                  <div className="flex justify-between text-sm print:text-base">
                    <span className="text-gray-600 font-medium">Table:</span>
                    <span className="font-semibold">{order.table_number}</span>
                  </div>
                )}
                {order.customer_name && (
                  <div className="flex justify-between text-sm print:text-base">
                    <span className="text-gray-600 font-medium">Customer:</span>
                    <span className="font-semibold">{order.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm print:text-base">
                  <span className="text-gray-600 font-medium">Date:</span>
                  <span className="font-semibold">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm print:text-base">
                  <span className="text-gray-600 font-medium">Time:</span>
                  <span className="font-semibold">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg print:text-xl print:border-b print:border-gray-300 print:pb-2">
                Items
              </h3>
              {order.items && order.items.length > 0 ? (
                <div className="space-y-3 print:space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start pb-2 border-b border-gray-100 print:border-gray-200 last:border-b-0"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-base print:text-lg">
                          {item.item_name || `Item ${index + 1}`} × {item.quantity}
                        </div>
                        {(item.special_instructions ||
                          (item as { specialInstructions?: string }).specialInstructions) && (
                          <div className="text-sm text-gray-600 italic mt-1 print:text-base">
                            Note:{" "}
                            {item.special_instructions ||
                              (item as { specialInstructions?: string }).specialInstructions}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-base print:text-lg">
                          £{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 print:text-base">
                          £{(item.price || 0).toFixed(2)} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm print:text-base">No items found</p>
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 pt-4 border-t-2 border-gray-300 print:border-t-2 print:border-gray-400">
              {showVAT && (
                <>
                  <div className="flex justify-between text-sm print:text-base">
                    <span className="text-gray-600 font-medium">Subtotal:</span>
                    <span className="font-semibold">£{netAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm print:text-base">
                    <span className="text-gray-600 font-medium">VAT (20%):</span>
                    <span className="font-semibold">£{vatAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-300 print:text-2xl print:pt-4 print:border-t-2 print:border-gray-400">
                <span>Total:</span>
                <span style={{ color: primaryColor }}>£{subtotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Info */}
            {order.payment_method && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 print:bg-transparent print:border print:border-gray-300 print:p-3">
                <div className="flex justify-between text-sm print:text-base mb-2">
                  <span className="text-gray-600 font-medium">Payment Method:</span>
                  <span className="font-semibold capitalize">
                    {order.payment_method.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                {order.payment_status && (
                  <div className="flex justify-between text-sm print:text-base">
                    <span className="text-gray-600 font-medium">Payment Status:</span>
                    <span className="font-semibold text-green-700 capitalize">
                      {order.payment_status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t print:text-sm print:pt-6 print:border-t-2 print:border-gray-300">
              <p className="font-medium">Thank you for your order!</p>
              {isCustomerView && (
                <p className="mt-2 print:mt-3">
                  You can always re-open this receipt from the link in your email/SMS.
                </p>
              )}
              <p className="mt-2 print:mt-3 text-gray-400">
                Receipt #{getShortOrderNumber(order.id)}
              </p>
            </div>
          </div>

          {/* Actions - Hidden when printing */}
          <div className="flex flex-col gap-3 pt-4 border-t no-print">
            {isCustomerView ? (
              <>
                {/* Customer View: Email/SMS Input */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="receipt-email">Email Address</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="receipt-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={sendingEmail || emailSent}
                      />
                      <Button
                        onClick={handleSendEmail}
                        disabled={sendingEmail || emailSent || !email}
                        size="sm"
                        className="shrink-0"
                      >
                        {sendingEmail ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : emailSent ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="receipt-phone">Phone Number</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="receipt-phone"
                        type="tel"
                        placeholder="+44 7XXX XXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={sendingSMS || smsSent}
                      />
                      <Button
                        onClick={handleSendSMS}
                        disabled={sendingSMS || smsSent || !phone}
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                      >
                        {sendingSMS ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : smsSent ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            SMS
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Merchant View: Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || emailSent || !order.customer_email}
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
                    Email
                  </Button>
                  <Button
                    onClick={handleSendSMS}
                    disabled={sendingSMS || smsSent || !order.customer_phone}
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
                    SMS
                  </Button>
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

            <Button onClick={onClose} className="w-full" variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
