"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, ChefHat, Truck, Utensils } from "lucide-react";

interface OrderTimelineProps {

}

const ORDER_STATUSES = [
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
];

export function OrderTimeline({
  orderId,
  currentStatus = "PLACED",
  estimatedTime,
}: OrderTimelineProps) {
  const currentStatusIndex = ORDER_STATUSES.findIndex((status) => status.id === currentStatus);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Order Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order ID Display */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-900">Order ID</p>
          <p className="font-mono text-sm font-medium text-gray-900">{orderId}</p>
        </div>

        {/* Estimated Time */}
        {estimatedTime && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">
              Estimated completion: {estimatedTime}
            </p>
          </div>
        )}

        {/* Timeline Steps */}
        <div className="space-y-4">
          {ORDER_STATUSES.map((status, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const IconComponent = status.icon;

            return (
              <div key={status.id} className="relative">
                <div className="flex items-start space-x-3">
                  {/* Timeline Icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? `${status.color} text-white` : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </div>

                  {/* Timeline Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p
                        className={`text-sm font-medium ${
                          isCompleted ? status.textColor : "text-gray-900"
                        }`}
                      >
                        {status.label}
                      </p>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                      {isCompleted && !isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          Complete
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-900 mt-1">{status.description}</p>
                  </div>
                </div>

                {/* Timeline Line */}
                {index < ORDER_STATUSES.length - 1 && (
                  <div
                    className={`absolute left-4 top-8 w-0.5 h-4 ${
                      isCompleted ? "bg-gray-300" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Status Note */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-900">
            You'll receive updates as your order progresses. The kitchen team is working hard to
            prepare your meal!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
