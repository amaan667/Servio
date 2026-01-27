import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { retrySupabaseQuery } from "@/lib/supabase-retry";

import { CustomerInfo, OrderParams } from "../types";
import { safeGetItem, safeSetItem, safeRemoveItem, safeParseJSON } from "../utils/safeStorage";

export function useOrderSession(orderParams: OrderParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<unknown>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "",
    phone: "",
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const lastLogKeyRef = useRef<string | null>(null);

  // Prevent infinite API spam with ref-based tracking
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const COOLDOWN_MS = 2000; // 2 second cooldown between checks

  const updateCustomerInfo = (field: "name" | "phone", value: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const paramsKey = searchParams?.toString() || "";
    const logKey = [
      orderParams.venueSlug,
      orderParams.tableNumber,
      orderParams.counterNumber,
      orderParams.orderType,
      orderParams.orderLocation,
      orderParams.isDemo ? "demo" : "live",
      paramsKey,
    ].join("|");

    if (lastLogKeyRef.current !== logKey) {
      lastLogKeyRef.current = logKey;

      // Log order access (best-effort)
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
    }
  }, [
    orderParams.venueSlug,
    orderParams.tableNumber,
    orderParams.counterNumber,
    orderParams.orderType,
    orderParams.orderLocation,
    orderParams.isDemo,
    searchParams,
  ]);

  const checkForExistingOrder = async () => {
    try {
      const sessionParam = searchParams?.get("session");

      if (sessionParam) {
        const storedOrderData = safeGetItem(localStorage, `servio-order-${sessionParam}`);
        if (storedOrderData) {
          const orderData = safeParseJSON<Record<string, unknown>>(storedOrderData, {});

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
            // If order has payment_method="PAY_LATER" and payment_status="UNPAID", redirect directly to Stripe checkout
            const isPayLater =
              (orderInDb.payment_method === "PAY_LATER" ||
                orderInDb.payment_mode === "pay_later" ||
                orderInDb.payment_mode === "deferred") &&
              orderInDb.payment_status === "UNPAID";

            if (isPayLater) {
              // Create Stripe checkout session and redirect directly
              try {
                const checkoutResponse = await fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    amount: orderInDb.total_amount,
                    venue_id: orderData.venueId,
                    venue_name: orderParams.venueSlug || "Restaurant",
                    table_number: orderData.tableNumber,
                    order_id: orderData.orderId,
                    customer_name: orderInDb.customer_name || orderData.customerName,
                    customer_email: orderInDb.customer_email || orderData.customerEmail,
                    items: orderInDb.items || [],
                    source: "qr",
                    qr_type: orderInDb.qr_type || "TABLE_FULL_SERVICE",
                  }),
                });

                if (checkoutResponse.ok) {
                  const { url } = await checkoutResponse.json();
                  if (url) {
                    window.location.href = url;
                    return;
                  }
                }
              } catch (checkoutError) {
                // If checkout creation fails, fall back to payment page
                console.error("Failed to create checkout session:", checkoutError);
              }
            }

            const checkoutData = {
              venueId: orderData.venueId,
              venueName: orderParams.venueSlug || "Venue",
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

            safeSetItem(localStorage, "servio-checkout-data", JSON.stringify(checkoutData));
            window.location.href = "/payment";
            return;
          } else {
            safeRemoveItem(localStorage, `servio-order-${sessionParam}`);
          }
        }
      }

      const storedSession = safeGetItem(localStorage, "servio-current-session");
      if (storedSession && !sessionParam) {
        const storedOrderData = safeGetItem(localStorage, `servio-order-${storedSession}`);
        if (storedOrderData) {
          const orderData = safeParseJSON<Record<string, unknown>>(storedOrderData, {});

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
            // If order has payment_method="PAY_LATER" and payment_status="UNPAID", redirect directly to Stripe checkout
            const isPayLater =
              (sessionOrderInDb.payment_method === "PAY_LATER" ||
                sessionOrderInDb.payment_mode === "pay_later" ||
                sessionOrderInDb.payment_mode === "deferred") &&
              sessionOrderInDb.payment_status === "UNPAID";

            if (isPayLater) {
              // Create Stripe checkout session and redirect directly
              try {
                const checkoutResponse = await fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    amount: sessionOrderInDb.total_amount,
                    venue_id: orderData.venueId,
                    venue_name: orderParams.venueSlug || "Restaurant",
                    table_number: orderData.tableNumber,
                    order_id: orderData.orderId,
                    customer_name: sessionOrderInDb.customer_name || orderData.customerName,
                    customer_email: sessionOrderInDb.customer_email || orderData.customerEmail,
                    items: sessionOrderInDb.items || [],
                    source: "qr",
                    qr_type: sessionOrderInDb.qr_type || "TABLE_FULL_SERVICE",
                  }),
                });

                if (checkoutResponse.ok) {
                  const { url } = await checkoutResponse.json();
                  if (url) {
                    window.location.href = url;
                    return;
                  }
                }
              } catch (checkoutError) {
                // If checkout creation fails, fall back to payment page
                console.error("Failed to create checkout session:", checkoutError);
              }
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
              venueName: orderParams.venueSlug || "Venue",
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

            safeSetItem(localStorage, "servio-checkout-data", JSON.stringify(checkoutData));
            window.location.href = "/payment";
            return;
          } else {
            safeRemoveItem(localStorage, `servio-order-${storedSession}`);
            safeRemoveItem(localStorage, "servio-current-session");
          }
        }
      }

      // NEW: Check for unpaid Pay Later orders for this table even without localStorage session
      // This handles cases where customer rescans QR on different device
      // For Pay Later orders, redirect directly to Stripe checkout
      if (orderParams.tableNumber && !orderParams.isCounterOrder && !orderParams.isDemo) {
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const { data: unpaidPayLaterOrders } = await supabase
            .from("orders")
            .select("id, venue_id, table_number, customer_name, customer_email, total_amount, items, qr_type, payment_method, payment_status")
            .eq("venue_id", orderParams.venueSlug)
            .eq("table_number", parseInt(orderParams.tableNumber))
            .eq("payment_method", "PAY_LATER")
            .eq("payment_status", "UNPAID")
            .gte("created_at", todayStart.toISOString())
            .lte("created_at", todayEnd.toISOString())
            .order("created_at", { ascending: false })
            .limit(1);

          if (unpaidPayLaterOrders && unpaidPayLaterOrders.length > 0) {
            const order = unpaidPayLaterOrders[0];
            if (order) {
              // Create Stripe checkout session and redirect directly
              try {
                const checkoutResponse = await fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    amount: order.total_amount,
                    venue_id: order.venue_id,
                    venue_name: orderParams.venueSlug || "Restaurant",
                    table_number: order.table_number,
                    order_id: order.id,
                    customer_name: order.customer_name || "Customer",
                    customer_email: order.customer_email || undefined,
                    items: order.items || [],
                    source: "qr",
                    qr_type: order.qr_type || "TABLE_FULL_SERVICE",
                  }),
                });

                if (checkoutResponse.ok) {
                  const { url } = await checkoutResponse.json();
                  if (url) {
                    window.location.href = url;
                    return;
                  }
                }
              } catch (checkoutError) {
                // If checkout creation fails, continue to normal order flow
                console.error("Failed to create checkout session:", checkoutError);
              }
            }
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
          const tableSessionData = safeGetItem(localStorage, tableSessionKey);

          const sessionId = searchParams?.get("sessionId");
          const sessionSessionKey = sessionId ? `servio-session-${sessionId}` : null;
          const sessionSessionData = sessionSessionKey
            ? safeGetItem(localStorage, sessionSessionKey)
            : null;

          const sessionData = tableSessionData || sessionSessionData;

          if (sessionData) {
            try {
              const session = safeParseJSON<Record<string, unknown>>(sessionData, {});

              if (session.paymentStatus === "unpaid" || session.paymentStatus === "till") {
                safeSetItem(localStorage, "servio-unpaid-order", JSON.stringify(session));
                router.push(
                  `/order-summary?${orderParams.isCounterOrder ? "counter" : "table"}=${orderParams.orderLocation}&session=${session.orderId}`
                );
                isCheckingRef.current = false;
                return;
              }

              setShowCheckout(true);
              setCustomerInfo({
                name: (session.customerName as string) || "",
                phone: (session.customerPhone as string) || "",
              });
            } catch (_error) {
              // Error silently handled
            }
          }
        } else {
          const tableSessionKey = `servio-session-${orderParams.tableNumber}`;
          safeRemoveItem(localStorage, tableSessionKey);

          const sessionId = searchParams?.get("sessionId");
          if (sessionId) {
            const sessionSessionKey = `servio-session-${sessionId}`;
            safeRemoveItem(localStorage, sessionSessionKey);
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
