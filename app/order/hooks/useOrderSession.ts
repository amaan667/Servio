import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { retrySupabaseQuery } from "@/lib/supabase-retry";
import { logger } from "@/lib/logger";
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
    logger.info("📱 [ORDER SESSION] Session check initialized", {
      venueSlug: orderParams.venueSlug,
      tableNumber: orderParams.tableNumber,
      orderType: orderParams.orderType,
    });

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

          logger.info("🔍 [ORDER SESSION] Checking existing order in DB", {
            orderId: orderData.orderId,
            venueId: orderParams.venueSlug,
          });

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

          if (orderError) {
            logger.error("❌ [ORDER SESSION] Failed to query order after retries", {
              orderId: orderData.orderId,
              error: orderError instanceof Error ? orderError.message : String(orderError),
            });
          }

          logger.info("📊 [ORDER SESSION] DB query result", {
            found: !!orderInDb,
            orderId: orderData.orderId,
            hadError: !!orderError,
          });

          if (orderInDb) {
            logger.info("✅ [ORDER SESSION] Redirecting to payment", {
              orderId: orderData.orderId,
            });
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

          if (sessionOrderError) {
            logger.error("❌ [ORDER SESSION] Failed to query session order", {
              orderId: orderData.orderId,
              error:
                sessionOrderError instanceof Error
                  ? sessionOrderError.message
                  : String(sessionOrderError),
            });
          }

          if (sessionOrderInDb) {
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
          logger.info("⏭️ [ORDER SESSION] Check already in progress, skipping", {
            venueSlug: orderParams.venueSlug,
            tableNumber: orderParams.tableNumber,
          });
          return;
        }

        if (timeSinceLastCheck < COOLDOWN_MS) {
          logger.info("⏳ [ORDER SESSION] Cooldown active, skipping check", {
            venueSlug: orderParams.venueSlug,
            tableNumber: orderParams.tableNumber,
            cooldownRemaining: COOLDOWN_MS - timeSinceLastCheck,
          });
          return;
        }

        isCheckingRef.current = true;
        lastCheckTimeRef.current = now;

        logger.info("🔍 [ORDER SESSION] Checking for active unpaid orders via API", {
          venueSlug: orderParams.venueSlug,
          tableNumber: orderParams.tableNumber,
        });

        // Use API endpoint instead of direct Supabase query
        // This uses service role and bypasses RLS (customers don't need auth)
        const response = await fetch(
          `/api/orders/check-active?venueId=${encodeURIComponent(orderParams.venueSlug)}&tableNumber=${encodeURIComponent(orderParams.tableNumber)}`
        );

        if (!response.ok) {
          logger.error("❌ [ORDER SESSION] API request failed", {
            status: response.status,
            statusText: response.statusText,
          });
          isCheckingRef.current = false;
          return;
        }

        const result = await response.json();
        const activeOrders = result.ok ? result.orders : null;

        logger.info("✅ [ORDER SESSION] Active orders check complete", {
          count: activeOrders?.length || 0,
          venueSlug: orderParams.venueSlug,
          tableNumber: orderParams.tableNumber,
        });

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
