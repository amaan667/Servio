"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

export default function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams?.get("venue") || "";
  const tableNumber = searchParams?.get("table") || "";
  const counterNumber = searchParams?.get("counter") || "";
  const isDemo = searchParams?.get("demo") === "1";
  const skipGroupSize = searchParams?.get("skipGroupSize") === "true";
  // Check if this is a table with collection (customer collects at counter)
  const requiresCollection = searchParams?.get("collection") === "true";

  const isCounterOrder = !!counterNumber;
  const orderLocation = isCounterOrder ? counterNumber : tableNumber;

  // Determine order type: counter, table, or table_pickup
  const orderType = isCounterOrder ? "counter" : requiresCollection ? "table_pickup" : "table";

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
    }).catch(() => {
      // Silently handle - error logging failed
      // Error is already handled server-side
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
    orderType: orderType as "counter" | "table" | "table_pickup",
    requiresCollection,
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

  const { menuItems, loadingMenu, menuError, categoryOrder, venueName, pdfImages } = useOrderMenu(
    venueSlug,
    isDemo
  );

  const { isSubmitting, submitOrder } = useOrderSubmission();

  const { customerInfo, showCheckout, setShowCheckout, updateCustomerInfo } =
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

  // Show error if no venue or neither table nor counter parameter - no automatic redirect
  if (!venueSlug || (!tableNumber && !counterNumber)) {
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
            {loadingMenu ? (
              // Loading - show nothing while fetching
              <div className="hidden" />
            ) : menuItems.length > 0 ? (
              <EnhancedPDFMenuDisplay
                venueId={venueSlug}
                pdfImages={pdfImages}
                menuItems={menuItems}
                categoryOrder={categoryOrder}
                onAddToCart={(item) => addToCart(item)}
                cart={cart}
                onRemoveFromCart={(itemId) => removeFromCart(itemId)}
                onUpdateQuantity={(itemId, quantity) => updateQuantity(itemId, quantity)}
                isOrdering={true}
                onViewCart={() => setShowMobileCart(true)}
              />
            ) : (
              // No items and not loading - show minimal empty state (no error message)
              <div className="flex items-center justify-center py-12 text-gray-500">
                <p>No menu items available</p>
              </div>
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
    </div>
  );
}
