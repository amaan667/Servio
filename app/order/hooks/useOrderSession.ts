import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { retrySupabaseQuery } from "@/lib/supabase-retry";

import { CustomerInfo, OrderParams } from "../types";

export function useOrderSession(orderParams: OrderParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<unknown>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "",
    phone: "",
  });
  const [showCheckout, setShowCheckout] = useState(false);

  // Prevent infinite API spam with ref-based tracking
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const COOLDOWN_MS = 2000; // 2 second cooldown between checks

  const updateCustomerInfo = (field: "name" | "phone", value: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {

    // Log order access
    fetch("/api/log-order-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueSlug: orderParams.venueSlug,
        tableNumber: orderParams.tableNumber,
        counterNumber: orderParams.counterNumber,
        orderType: orderParams.orderType,
        orderLocation: orderParams.orderLocation,
        isDemo: orderParams.isDemo,
        url: window.location.href,
      }),
    }).catch(() => {
      /* Empty */
    });

    checkForExistingOrder();
  }, [orderParams, searchParams]);

  const checkForExistingOrder = async () => {
    try {
      const sessionParam = searchParams?.get("session");

      if (sessionParam) {
        const storedOrderData = localStorage.getItem(`servio-order-${sessionParam}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);

          const { data: orderInDb, error: orderError } = await retrySupabaseQuery(
            async () => {
              const result = await supabase
                .from("orders")
                .select("*")
                .eq("id", orderData.orderId)
                .eq("venue_id", orderParams.venueSlug)
                .in("order_status", [
                  "PLACED",
                  "ACCEPTED",
                  "IN_PREP",
                  "READY",
                  "OUT_FOR_DELIVERY",
                  "SERVING",
                ])
                .in("payment_status", ["UNPAID", "PAY_LATER", "IN_PROGRESS"])
                .single();
              return { data: result.data, error: result.error };
            },
            { maxRetries: 5, delayMs: 500, logContext: "Check Existing Order" }
          );

          if (orderError) { /* Condition handled */ }

          if (orderInDb) {
            // If order has payment_method="PAY_LATER" or payment_mode="pay_later" and payment_status="UNPAID", redirect to Stripe checkout
            const isPayLater =
              (orderInDb.payment_method === "PAY_LATER" ||
                orderInDb.payment_mode === "pay_later" ||
                orderInDb.payment_mode === "deferred") &&
              (orderInDb.payment_status === "UNPAID" ||
                orderInDb.payment_status === "PAY_LATER_PENDING");

            // For unpaid Pay Later or Pay at Till orders, redirect to payment page
            // where customer can choose payment method (Stripe checkout or Pay at Till)
            const isPayAtTill =
              (orderInDb.payment_method === "PAY_AT_TILL" ||
                orderInDb.payment_mode === "offline") &&
              orderInDb.payment_status === "UNPAID";

            if (isPayLater || isPayAtTill) {

              // Redirect to payment page where customer can choose payment method
              const checkoutData = {
                venueId: orderData.venueId,
                venueName: "Restaurant",
                tableNumber: orderData.tableNumber,
                customerName: orderInDb.customer_name || orderData.customerName,
                customerPhone: orderInDb.customer_phone || orderData.customerPhone,
                customerEmail: orderInDb.customer_email || orderData.customerEmail,
                cart: orderData.cart || [],
                total: orderInDb.total_amount || orderData.total,
                orderId: orderData.orderId,
                orderNumber: orderData.orderNumber,
                sessionId: sessionParam,
                isDemo: orderParams.isDemo,
              };

              localStorage.setItem("servio-checkout-data", JSON.stringify(checkoutData));
              window.location.href = "/payment";
              return;
            }

            const checkoutData = {
              venueId: orderData.venueId,
              venueName: "Restaurant",
              tableNumber: orderData.tableNumber,
              customerName: orderData.customerName,
              customerPhone: orderData.customerPhone,
              cart: orderData.cart || [],
              total: orderData.total,
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              sessionId: sessionParam,
              isDemo: orderParams.isDemo,
            };

            localStorage.setItem("servio-checkout-data", JSON.stringify(checkoutData));
            window.location.href = "/payment";
            return;
          } else {
            localStorage.removeItem(`servio-order-${sessionParam}`);
          }
        }
      }

      const storedSession = localStorage.getItem("servio-current-session");
      if (storedSession && !sessionParam) {
        const storedOrderData = localStorage.getItem(`servio-order-${storedSession}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);

          const { data: sessionOrderInDb, error: sessionOrderError } = await retrySupabaseQuery(
            async () => {
              const result = await supabase
                .from("orders")
                .select("*")
                .eq("id", orderData.orderId)
                .eq("venue_id", orderParams.venueSlug)
                .in("order_status", [
                  "PLACED",
                  "ACCEPTED",
                  "IN_PREP",
                  "READY",
                  "OUT_FOR_DELIVERY",
                  "SERVING",
                ])
                .in("payment_status", ["UNPAID", "PAY_LATER", "IN_PROGRESS"])
                .single();
              return { data: result.data, error: result.error };
            },
            { maxRetries: 5, delayMs: 500, logContext: "Check Session Order" }
          );

          if (sessionOrderError) { /* Condition handled */ }

          if (sessionOrderInDb) {
            // If order has payment_method="PAY_LATER" or payment_mode="pay_later" and payment_status="UNPAID", redirect to Stripe checkout
            // For unpaid Pay Later or Pay at Till orders, redirect to payment page
            // where customer can choose payment method (Stripe checkout or Pay at Till)
            const isPayLater =
              (sessionOrderInDb.payment_method === "PAY_LATER" ||
                sessionOrderInDb.payment_mode === "pay_later" ||
                sessionOrderInDb.payment_mode === "deferred") &&
              (sessionOrderInDb.payment_status === "UNPAID" ||
                sessionOrderInDb.payment_status === "PAY_LATER_PENDING");

            const isPayAtTill =
              (sessionOrderInDb.payment_method === "PAY_AT_TILL" ||
                sessionOrderInDb.payment_mode === "offline") &&
              sessionOrderInDb.payment_status === "UNPAID";

            if (isPayLater || isPayAtTill) {

              // Redirect to payment page where customer can choose payment method
              const checkoutData = {
                venueId: orderData.venueId,
                venueName: "Restaurant",
                tableNumber: orderData.tableNumber,
                customerName: sessionOrderInDb.customer_name || orderData.customerName,
                customerPhone: sessionOrderInDb.customer_phone || orderData.customerPhone,
                customerEmail: sessionOrderInDb.customer_email || orderData.customerEmail,
                cart: orderData.cart || [],
                total: sessionOrderInDb.total_amount || orderData.total,
                orderId: orderData.orderId,
                orderNumber: orderData.orderNumber,
                sessionId: sessionParam,
                isDemo: orderParams.isDemo,
              };

              localStorage.setItem("servio-checkout-data", JSON.stringify(checkoutData));
              window.location.href = "/payment";
              return;
            }

            // Check if there are multiple unpaid orders for this table
            // If so, show table payment screen instead of single order payment
            try {
              const { data: tableOrders } = await supabase
                .from("orders")
                .select("id, payment_status, payment_mode")
                .eq("venue_id", orderParams.venueSlug)
                .eq("table_number", orderData.tableNumber)
                .in("payment_status", ["UNPAID"])
                .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
                .lte("created_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString());

              if (tableOrders && tableOrders.length > 1) {
                // Multiple unpaid orders - redirect to table payment screen

                window.location.href = `/payment/table?venue=${orderParams.venueSlug}&table=${orderData.tableNumber}`;
                return;
              }
            } catch (tableCheckError) {
              // Fall back to single order payment if table check fails

            }

            // Single order or fallback - use existing payment flow
            const checkoutData = {
              venueId: orderData.venueId,
              venueName: "Restaurant",
              tableNumber: orderData.tableNumber,
              customerName: orderData.customerName,
              customerPhone: orderData.customerPhone,
              cart: orderData.cart || [],
              total: orderData.total,
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              sessionId: storedSession,
              isDemo: orderParams.isDemo,
            };

            localStorage.setItem("servio-checkout-data", JSON.stringify(checkoutData));
            window.location.href = "/payment";
            return;
          } else {
            localStorage.removeItem(`servio-order-${storedSession}`);
            localStorage.removeItem("servio-current-session");
          }
        }
      }

      // NEW: Check for unpaid orders for this table even without localStorage session
      // This handles cases where customer rescans QR on different device
      if (orderParams.tableNumber && !orderParams.isCounterOrder && !orderParams.isDemo) {
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const { data: unpaidTableOrders } = await supabase
            .from("orders")
            .select("id, payment_status, payment_mode, total_amount")
            .eq("venue_id", orderParams.venueSlug)
            .eq("table_number", parseInt(orderParams.tableNumber))
            .in("payment_status", ["UNPAID"])
            .in("payment_mode", ["pay_later", "pay_at_till", "online"])
            .gte("created_at", todayStart.toISOString())
            .lte("created_at", todayEnd.toISOString());

          if (unpaidTableOrders && unpaidTableOrders.length > 0) {

            // Redirect to table payment screen
            window.location.href = `/payment/table?venue=${orderParams.venueSlug}&table=${orderParams.tableNumber}`;
            return;
          }
        } catch (tableCheckError) {
          // Silently continue to normal order flow if check fails

        }
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      setSession(user ? { user } : null);
    };
    checkUser();

    const checkUnpaidOrders = async () => {
      try {
        // Prevent concurrent checks and enforce cooldown
        const now = Date.now();
        const timeSinceLastCheck = now - lastCheckTimeRef.current;

        if (isCheckingRef.current) {

          return;
        }

        if (timeSinceLastCheck < COOLDOWN_MS) {

          return;
        }

        isCheckingRef.current = true;
        lastCheckTimeRef.current = now;

        // Use API endpoint instead of direct Supabase query
        // This uses service role and bypasses RLS (customers don't need auth)
        const response = await fetch(
          `/api/orders/check-active?venueId=${encodeURIComponent(orderParams.venueSlug)}&tableNumber=${encodeURIComponent(orderParams.tableNumber)}`
        );

        if (!response.ok) {

          isCheckingRef.current = false;
          return;
        }

        const result = await response.json();
        const activeOrders = result.ok ? result.orders : null;

        if (activeOrders && activeOrders.length > 0) {
          const tableSessionKey = `servio-session-${orderParams.tableNumber}`;
          const tableSessionData = localStorage.getItem(tableSessionKey);

          const sessionId = searchParams?.get("sessionId");
          const sessionSessionKey = sessionId ? `servio-session-${sessionId}` : null;
          const sessionSessionData = sessionSessionKey
            ? localStorage.getItem(sessionSessionKey)
            : null;

          const sessionData = tableSessionData || sessionSessionData;

          if (sessionData) {
            try {
              const session = JSON.parse(sessionData);

              if (session.paymentStatus === "unpaid" || session.paymentStatus === "till") {
                localStorage.setItem("servio-unpaid-order", JSON.stringify(session));
                router.push(
                  `/order-summary?${orderParams.isCounterOrder ? "counter" : "table"}=${orderParams.orderLocation}&session=${session.orderId}`
                );
                isCheckingRef.current = false;
                return;
              }

              setShowCheckout(true);
              setCustomerInfo({
                name: session.customerName,
                phone: session.customerPhone,
              });
            } catch (_error) {
              // Error silently handled
            }
          }
        } else {
          const tableSessionKey = `servio-session-${orderParams.tableNumber}`;
          localStorage.removeItem(tableSessionKey);

          const sessionId = searchParams?.get("sessionId");
          if (sessionId) {
            const sessionSessionKey = `servio-session-${sessionId}`;
            localStorage.removeItem(sessionSessionKey);
          }
        }
      } catch (_error) {
        // Error silently handled
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkUnpaidOrders();

    try {
      if (supabase?.auth?.onAuthStateChange) {
        const result = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
          setSession(session);
        });
        return () => {
          try {
            const subscription = (
              result as { data?: { subscription?: { unsubscribe?: () => void } } }
            )?.data?.subscription;
            subscription?.unsubscribe?.();
          } catch {
            // Error handled silently
          }
        };
      }
    } catch (_err) {
      // Auth state change setup failed
    }
    return () => {
      /* Empty */
    };
  }, [
    orderParams.venueSlug,
    orderParams.tableNumber,
    orderParams.isCounterOrder,
    orderParams.orderLocation,
    router,
    searchParams,
  ]);

  return {
    session,
    customerInfo,
    showCheckout,
    setShowCheckout,
    updateCustomerInfo,
  };
}
