import { Order } from "../types";
import { calculateOrderTotal } from "@/lib/pricing-utils";

export const getTableSummary = (orders: Order[]) => {
  const total = orders.reduce((sum, order) => {
    return sum + calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
  }, 0);

  const statuses = orders.map((order) => order.order_status);
  const paymentStatuses = orders.map((order) => order.payment_status).filter(Boolean);

  let overallStatus = "MIXED";
  const uniqueStatuses = [...new Set(statuses)];
  if (uniqueStatuses.length === 1) {
    overallStatus = uniqueStatuses[0];
  } else if (uniqueStatuses.includes("READY")) {
    overallStatus = "MIXED_READY";
  } else if (uniqueStatuses.includes("IN_PREP")) {
    overallStatus = "MIXED_PREP";
  }

  const uniquePaymentStatuses = [...new Set(paymentStatuses)];
  let overallPaymentStatus = "MIXED";
  if (uniquePaymentStatuses.length === 1 && uniquePaymentStatuses[0]) {
    overallPaymentStatus = uniquePaymentStatuses[0];
  }

  return {
    total,
    orderCount: orders.length,
    overallStatus,
    overallPaymentStatus,
    statuses: uniqueStatuses,
    paymentStatuses: uniquePaymentStatuses,
  };
};
