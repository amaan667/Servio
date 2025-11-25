"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { EnhancedPDFMenuDisplay } from "@/components/EnhancedPDFMenuDisplay";

// Hooks
import { useOrderCart } from "./hooks/useOrderCart";
import { useOrderMenu } from "./hooks/useOrderMenu";
import { useOrderSubmission } from "./hooks/useOrderSubmission";
import { useOrderSession } from "./hooks/useOrderSession";
import type { OrderParams } from "./types";
import { useGroupSession } from "./hooks/useGroupSession";

// Components
import { DemoBanner } from "./components/DemoBanner";
import { OrderHeader } from "./components/OrderHeader";
import { DesktopCart } from "./components/DesktopCart";
import { MobileCart } from "./components/MobileCart";
import { MobileCartButton } from "./components/MobileCartButton";
import { CheckoutModal } from "./components/CheckoutModal";
import { GroupSizeModal } from "./components/GroupSizeModal";
import { BillSplitModal, type BillSplit } from "./components/BillSplitModal";
import { Button } from "@/components/ui/button";

export default function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams?.get("venue") || "";
  const tableNumber = searchParams?.get("table") || "";
  const counterNumber = searchParams?.get("counter") || "";
  const isDemo = searchParams?.get("demo") === "1";
  const skipGroupSize = searchParams?.get("skipGroupSize") === "true";

  const isCounterOrder = !!counterNumber;
  const orderLocation = isCounterOrder ? counterNumber : tableNumber;
  const orderType = isCounterOrder ? "counter" : "table";

  // Fetch venue subscription tier
  useEffect(() => {
    const fetchTier = async () => {
      if (isDemo) {
        setSubscriptionTier("enterprise");
        setLoadingTier(false);
        return;
      }

      try {
        const response = await fetch(`/api/venue/${venueSlug}/tier`);
        if (response.ok) {
          const data = await response.json();
          setSubscriptionTier(data.tier || "starter");
        }
      } catch (_error) {
        setSubscriptionTier("starter");
      } finally {
        setLoadingTier(false);
      }
    };

    fetchTier();
  }, [venueSlug, isDemo]);

  // Log QR code scan to Railway server logs
  useEffect(() => {
    const logData = {
      venueSlug,
      tableNumber,
      counterNumber,
      orderType,
      isDemo,
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      userAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
      timestamp: new Date().toISOString(),
    };

    // Log to server (will appear in Railway logs)
    fetch("/api/log-qr-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData),
    }).catch((err) => {
      // Fallback to client log if server fails
      console.error("Failed to log QR scan:", err instanceof Error ? err.message : String(err));
    });

    // Also log client-side for development
  }, [venueSlug, tableNumber, counterNumber, orderType, isDemo]);

  const orderParams: OrderParams = {
    venueSlug,
    tableNumber,
    counterNumber,
    isDemo,
    isCounterOrder,
    orderLocation,
    orderType: orderType as "counter" | "table",
  };

  // Use custom hooks
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSpecialInstructions,
    getTotalPrice,
    getTotalItems,
    resetCart,
  } = useOrderCart();

  const { menuItems, loadingMenu, menuError, categoryOrder, venueName } = useOrderMenu(
    venueSlug,
    isDemo
  );

  const { isSubmitting, submitOrder } = useOrderSubmission();

  const { session, customerInfo, showCheckout, setShowCheckout, updateCustomerInfo } =
    useOrderSession(orderParams);

  const {
    showGroupSizeModal,
    setShowGroupSizeModal,
    showGroupSizePopup,
    setShowGroupSizePopup,
    groupSize,
    setGroupSize,
    showCustomGroupSize,
    setShowCustomGroupSize,
    customGroupSize,
    setCustomGroupSize,
    groupSessionId,
    handleGroupSizeSubmit,
    handleGroupSizeUpdate,
  } = useGroupSession(venueSlug, tableNumber, isCounterOrder, skipGroupSize);

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showBillSplit, setShowBillSplit] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<"starter" | "pro" | "enterprise">("starter");
  const [loadingTier, setLoadingTier] = useState(true);
  const shouldSplitBill = searchParams?.get("splitBill") === "true";

  // Log menu loading for debugging
  useEffect(() => {
    if (!loadingMenu) {
      /* Empty */
    }
  }, [loadingMenu, menuItems.length, menuError, venueName, venueSlug]);

  const handleSubmitOrder = () => {
    submitOrder({
      cart,
      customerInfo,
      venueSlug,
      tableNumber,
      counterNumber,
      orderLocation,
      orderType,
      isCounterOrder,
      isDemo,
      isDemoFallback: false,
    });
  };

  const handleBillSplitComplete = async (splits: BillSplit[]) => {
    try {
      const response = await fetch("/api/orders/create-split-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venueSlug,
          tableNumber: parseInt(tableNumber) || 1,
          customerName: customerInfo.name || "Customer",
          customerPhone: customerInfo.phone || "",
          splits: splits.map((split) => ({
            name: split.name,
            items: split.items.map((item) => ({
              id: item.id && item.id.startsWith("demo-") ? null : item.id,
              name: item.name,
              price: item.price + (item.modifierPrice || 0),
              quantity: item.quantity,
              specialInstructions: item.specialInstructions || null,
              modifiers: item.selectedModifiers || null,
              modifierPrice: item.modifierPrice || 0,
            })),
            total: split.total,
          })),
          source: orderType === "counter" ? "counter" : "qr",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create split orders");
      }

      const data = await response.json();
      
      // Redirect to payment page with split checkout sessions
      localStorage.setItem("servio-split-checkout", JSON.stringify({
        groupId: data.groupId,
        checkoutSessions: data.checkoutSessions,
        venueId: venueSlug,
        tableNumber,
      }));

      // Redirect to first checkout session
      if (data.checkoutSessions && data.checkoutSessions.length > 0) {
        window.location.href = data.checkoutSessions[0].url || "/payment";
      }
    } catch (error) {
      alert("Failed to create split orders. Please try again.");
    }
  };

  // Show bill split modal if URL param is set
  useEffect(() => {
    if (shouldSplitBill && cart.length > 0) {
      setShowBillSplit(true);
    }
  }, [shouldSplitBill, cart.length]);

  // Show error if no venue or table parameter - no automatic redirect
  if (!venueSlug || !tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 mb-2">Invalid QR Code</p>
          <p className="text-gray-600">Please scan a valid QR code to access the menu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DemoBanner isDemo={isDemo} onResetCart={resetCart} />

      <OrderHeader
        venueName={venueName}
        isDemo={isDemo}
        isCounterOrder={isCounterOrder}
        tableNumber={tableNumber}
        counterNumber={counterNumber}
        groupSessionId={groupSessionId}
        groupSize={groupSize}
        totalItems={getTotalItems()}
        onShowMobileCart={() => setShowMobileCart(true)}
        onShowGroupSizePopup={() => setShowGroupSizePopup(true)}
        venueSlug={venueSlug}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-4 sm:py-5 md:py-6 lg:py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 sm:gap-5 md:gap-6 lg:gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-1">
            {menuError ? (
              <Alert variant="destructive">
                <AlertDescription>{menuError}</AlertDescription>
              </Alert>
            ) : (
              <EnhancedPDFMenuDisplay
                venueId={venueSlug}
                menuItems={menuItems}
                categoryOrder={categoryOrder}
                onAddToCart={(item) => addToCart(item)}
                cart={cart}
                onRemoveFromCart={(itemId) => removeFromCart(itemId)}
                onUpdateQuantity={(itemId, quantity) => updateQuantity(itemId, quantity)}
                isOrdering={true}
              />
            )}
          </div>

          {/* Desktop Cart */}
          <DesktopCart
            cart={cart}
            totalPrice={getTotalPrice()}
            totalItems={getTotalItems()}
            onRemoveFromCart={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onUpdateSpecialInstructions={updateSpecialInstructions}
            onShowCheckout={() => setShowCheckout(true)}
            isDemo={isDemo}
            onDirectSubmit={handleSubmitOrder}
          />
          
          {/* Bill Split Button (if cart has items) */}
          {cart.length > 0 && !isDemo && (
            <div className="lg:col-span-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowBillSplit(true)}
                className="w-full"
              >
                Split Bill
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Cart Button */}
        <MobileCartButton totalItems={getTotalItems()} onClick={() => setShowMobileCart(true)} />

        {/* Mobile Cart Modal */}
        <MobileCart
          cart={cart}
          totalPrice={getTotalPrice()}
          totalItems={getTotalItems()}
          showMobileCart={showMobileCart}
          onClose={() => setShowMobileCart(false)}
          onRemoveFromCart={removeFromCart}
          onUpdateQuantity={updateQuantity}
          onUpdateSpecialInstructions={updateSpecialInstructions}
          onShowCheckout={() => {
            setShowMobileCart(false);
            setShowCheckout(true);
          }}
          isDemo={isDemo}
          onDirectSubmit={handleSubmitOrder}
        />
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        show={showCheckout}
        customerInfo={customerInfo}
        totalPrice={getTotalPrice()}
        isSubmitting={isSubmitting}
        onClose={() => setShowCheckout(false)}
        onUpdateCustomerInfo={updateCustomerInfo}
        onSubmit={handleSubmitOrder}
      />

      {/* Group Size Modals */}
      <GroupSizeModal
        show={showGroupSizeModal}
        groupSize={groupSize}
        showCustomGroupSize={showCustomGroupSize}
        customGroupSize={customGroupSize}
        onClose={() => {
          setShowGroupSizeModal(false);
          setShowCustomGroupSize(false);
          setCustomGroupSize("");
        }}
        onSetGroupSize={setGroupSize}
        onShowCustomGroupSize={() => setShowCustomGroupSize(true)}
        onSetCustomGroupSize={setCustomGroupSize}
        onHideCustomGroupSize={() => {
          setShowCustomGroupSize(false);
          setCustomGroupSize("");
        }}
        onSubmit={handleGroupSizeSubmit}
        mode="initial"
      />

      <GroupSizeModal
        show={showGroupSizePopup}
        groupSize={groupSize}
        showCustomGroupSize={showCustomGroupSize}
        customGroupSize={customGroupSize}
        onClose={() => {
          setShowGroupSizePopup(false);
          setShowCustomGroupSize(false);
          setCustomGroupSize("");
        }}
        onSetGroupSize={setGroupSize}
        onShowCustomGroupSize={() => setShowCustomGroupSize(true)}
        onSetCustomGroupSize={setCustomGroupSize}
        onHideCustomGroupSize={() => {
          setShowCustomGroupSize(false);
          setCustomGroupSize("");
        }}
        onSubmit={handleGroupSizeUpdate}
        mode="update"
      />

      {/* Bill Split Modal */}
      <BillSplitModal
        isOpen={showBillSplit}
        onClose={() => setShowBillSplit(false)}
        cart={cart}
        totalPrice={getTotalPrice()}
        onSplitComplete={handleBillSplitComplete}
      />
    </div>
  );
}
