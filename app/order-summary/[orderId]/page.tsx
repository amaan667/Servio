"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Clock,
  XCircle,
  User,
  Hash,
  Star,
  Loader2,
  Bell,
  RefreshCw,
  CheckCircle2,
  X,
} from "lucide-react";

// Hooks
import { useOrderDetails } from "./hooks/useOrderDetails";
import { useFeedbackManagement } from "./hooks/useFeedbackManagement";

// Constants
import { TABLE_ORDER_STATUSES, COUNTER_ORDER_STATUSES } from "./constants";

/**
 * Order Details Page
 * Shows order status and allows feedback
 * Now includes real-time updates and ORDER READY notifications for counter pickup
 */

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [showFeedback, setShowFeedback] = useState(false);

  const { order, loading, error, justBecameReady, dismissReadyAlert, lastUpdate, refetch } =
    useOrderDetails(orderId);
  const feedback = useFeedbackManagement(order?.venue_id || "");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Order Not Found</p>
          <p className="text-gray-600 mb-4">{error || "This order does not exist"}</p>
          <Button onClick={() => (window.location.href = "/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const isTableOrder = order.order_type === "table" || (order.table_number && !order.source);
  const isCounterOrder = order.source === "counter" || order.order_type === "counter";
  const orderStatuses = isTableOrder ? TABLE_ORDER_STATUSES : COUNTER_ORDER_STATUSES;
  const currentStatusIndex = orderStatuses.findIndex((s) => s.key === order.order_status);
  const isOrderReady = order.order_status === "READY";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ORDER READY Alert Banner - Shows when order becomes ready */}
        {(justBecameReady || isOrderReady) && isCounterOrder && (
          <div className="mb-6 animate-pulse">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.3),transparent_50%)]" />
              </div>

              <div className="relative z-10">
                {justBecameReady && (
                  <button
                    onClick={dismissReadyAlert}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="bg-white/20 rounded-full p-3">
                    <Bell className="h-8 w-8 animate-bounce" />
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold text-center mb-2">
                  🎉 Your Order is Ready!
                </h2>

                <p className="text-xl text-center text-white/90 mb-4">
                  Please collect your order at the counter
                </p>

                <div className="bg-white/20 rounded-xl p-4 text-center">
                  <p className="text-sm text-white/80 mb-1">Order Number</p>
                  <p className="text-4xl font-bold tracking-wider">
                    #{order.id.slice(-6).toUpperCase()}
                  </p>
                </div>

                <p className="text-center text-white/70 text-sm mt-4">
                  Show this screen to collect your order
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Order #{order.id.slice(-6).toUpperCase()}
            </h1>
            <p className="text-gray-600 mt-2">{new Date(order.created_at).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Real-time update indicator */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live updates enabled - this page updates automatically
        </div>

        {/* Order Status Timeline */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderStatuses.map((status, index) => {
                const StatusIcon = status.icon;
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;

                return (
                  <div key={status.key} className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted ? status.color : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${isCompleted ? "text-gray-900" : "text-gray-500"}`}
                      >
                        {status.label}
                      </p>
                      <p className="text-sm text-gray-600">{status.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-medium">
                  {order.table_number
                    ? `Table ${order.table_number}`
                    : `Counter ${order.counter_number}`}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-gray-600">Payment Status</p>
              <Badge
                variant={order.payment_status === "PAID" ? "default" : "secondary"}
                className="mt-1"
              >
                {order.payment_status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{item.item_name}</p>
                      {item.specialInstructions && (
                        <p className="text-sm text-gray-600 mt-1">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">£{(item.price * item.quantity).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  {index < order.items.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}

              <Separator className="my-4" />

              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold">Total</p>
                <p className="text-xl font-bold text-purple-600">
                  £{order.total_amount.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Section */}
        {order.order_status === "COMPLETED" && !showFeedback && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="text-center">
                <Star className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How was your experience?
                </h3>
                <p className="text-gray-600 mb-4">We'd love to hear your feedback!</p>
                <Button
                  onClick={() => setShowFeedback(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Leave Feedback
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback Form */}
        {showFeedback && feedback.feedbackQuestions.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedback.feedbackQuestions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label className="text-sm font-medium">{question.prompt}</Label>
                  {question.type === "stars" && (
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            feedback.updateFeedbackResponse(question.id, {
                              answer_stars: star,
                              type: "stars",
                            })
                          }
                          className="text-2xl"
                        >
                          <Star
                            className={`${
                              (feedback.feedbackResponses.find((r) => r.question_id === question.id)
                                ?.answer_stars ?? 0) >= star
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {question.type === "multiple_choice" && question.choices && (
                    <div className="space-y-2 mt-2">
                      {question.choices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() =>
                            feedback.updateFeedbackResponse(question.id, {
                              answer_choice: choice,
                              type: "multiple_choice",
                            })
                          }
                          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                            feedback.feedbackResponses.find((r) => r.question_id === question.id)
                              ?.answer_choice === choice
                              ? "border-purple-600 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {question.type === "paragraph" && (
                    <textarea
                      className="w-full mt-2 p-3 border border-gray-300 rounded-lg resize-none"
                      rows={4}
                      placeholder="Enter your feedback..."
                      value={
                        feedback.feedbackResponses.find((r) => r.question_id === question.id)
                          ?.answer_text || ""
                      }
                      onChange={(e) =>
                        feedback.updateFeedbackResponse(question.id, {
                          answer_text: e.target.value,
                          type: "paragraph",
                        })
                      }
                    />
                  )}
                </div>
              ))}

              <Button
                onClick={() => feedback.submitFeedback(order.id)}
                disabled={feedback.submittingFeedback}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {feedback.submittingFeedback ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
