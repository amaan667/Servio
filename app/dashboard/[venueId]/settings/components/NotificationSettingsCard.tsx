import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, MessageSquare, Mail, Smartphone } from "lucide-react";

interface NotificationSettingsCardProps {
  notifyCustomerOnReady: boolean;
  setNotifyCustomerOnReady: (value: boolean) => void;
  serviceType: string;
}

export function NotificationSettingsCard({
  notifyCustomerOnReady,
  setNotifyCustomerOnReady,
  serviceType,
}: NotificationSettingsCardProps) {
  const isCounterService = serviceType === "counter_pickup" || serviceType === "both";

  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Bell className="h-5 w-5 text-green-600" />
          Customer Notifications
        </CardTitle>
        <CardDescription>Configure how customers are notified about their orders</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Order Ready Notification Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifyCustomerOnReady" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notify customers when order is ready
            </Label>
            <p className="text-sm text-gray-600">
              Send SMS/email notification when an order status changes to "Ready"
            </p>
            {isCounterService && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Recommended for counter pickup service
              </p>
            )}
          </div>
          <Switch
            id="notifyCustomerOnReady"
            checked={notifyCustomerOnReady}
            onCheckedChange={setNotifyCustomerOnReady}
          />
        </div>

        {/* Info section about notification channels */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900 text-sm">How notifications work:</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Smartphone className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <span className="font-medium">In-App Notification:</span> Customers viewing their
                order page will see an instant alert with sound when the order is ready.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 mt-0.5 text-green-500" />
              <div>
                <span className="font-medium">SMS:</span> If customer provided a phone number,
                they'll receive an SMS notification (requires Twilio integration).
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-purple-500" />
              <div>
                <span className="font-medium">Email:</span> If customer provided an email, they'll
                receive an email notification with order details.
              </div>
            </div>
          </div>
        </div>

        {/* Service type reminder */}
        {serviceType === "table_service" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your venue is set to "Table Service". Order ready notifications
              are most useful for counter pickup / collection service where customers need to
              collect their orders. You can enable this if you'd like to notify customers anyway.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
