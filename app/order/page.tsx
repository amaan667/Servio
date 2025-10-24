"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { logger } from "@/lib/logger";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Image as ImageIcon, List } from "lucide-react";
import { EnhancedPDFMenuDisplay } from "@/components/EnhancedPDFMenuDisplay";
import { StyledMenuDisplay } from "@/components/StyledMenuDisplay";
import { Button } from "@/components/ui/button";

// Hooks
import { useOrderCart } from './hooks/useOrderCart';
import { useOrderMenu } from './hooks/useOrderMenu';
import { useOrderSubmission } from './hooks/useOrderSubmission';
import { useOrderSession } from './hooks/useOrderSession';
import { useGroupSession } from './hooks/useGroupSession';

// Components
import { DemoBanner } from './components/DemoBanner';
import { OrderHeader } from './components/OrderHeader';
import { DesktopCart } from './components/DesktopCart';
import { MobileCart } from './components/MobileCart';
import { MobileCartButton } from './components/MobileCartButton';
import { CheckoutModal } from './components/CheckoutModal';
import { GroupSizeModal } from './components/GroupSizeModal';

export default function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams?.get("venue") || "demo-cafe";
  const tableNumber = searchParams?.get("table") || "1";
  const counterNumber = searchParams?.get("counter") || "";
  const isDemo = searchParams?.get("demo") === "1";
  
  const isCounterOrder = !!counterNumber;
  const orderLocation = isCounterOrder ? counterNumber : tableNumber;
  const orderType = isCounterOrder ? "counter" : "table";

  // Fetch venue subscription tier
  useEffect(() => {
    const fetchTier = async () => {
      if (isDemo) {
        setSubscriptionTier('premium');
        setLoadingTier(false);
        return;
      }

      try {
        const response = await fetch(`/api/venue/${venueSlug}/tier`);
        if (response.ok) {
          const data = await response.json();
          setSubscriptionTier(data.tier || 'basic');
        }
      } catch (error) {
        logger.error('Failed to fetch venue tier', { error });
        setSubscriptionTier('basic');
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
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString()
    };

    // Log to server (will appear in Railway logs)
    fetch('/api/log-qr-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch((err) => {
      // Fallback to client log if server fails
      logger.error('Failed to log QR scan to server', {
        error: err instanceof Error ? err.message : String(err)
      });
    });

    // Also log client-side for development
    logger.info('🔍 [QR SCAN - CLIENT] Order page accessed', logData);
  }, [venueSlug, tableNumber, counterNumber, orderType, isDemo]);

  const orderParams = {
    venueSlug,
    tableNumber,
    counterNumber,
    isDemo,
    isCounterOrder,
    orderLocation,
    orderType,
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

  const {
    menuItems,
    loadingMenu,
    menuError,
    categoryOrder,
    venueName,
  } = useOrderMenu(venueSlug, isDemo);

  const { isSubmitting, submitOrder } = useOrderSubmission();

  const {
    session,
    customerInfo,
    showCheckout,
    setShowCheckout,
    updateCustomerInfo,
  } = useOrderSession(orderParams);

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
  } = useGroupSession(venueSlug, tableNumber, isCounterOrder);

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'basic' | 'standard' | 'premium'>('basic');
  const [loadingTier, setLoadingTier] = useState(true);
  const [menuView, setMenuView] = useState<'pdf' | 'list'>('pdf'); // For premium users

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

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            {/* View Toggle for Premium Users */}
            {subscriptionTier === 'premium' && !loadingTier && !loadingMenu && !menuError && (
              <div className="mb-4 flex justify-end">
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
                  <Button
                    variant={menuView === 'pdf' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMenuView('pdf')}
                    className="rounded-md"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    PDF View
                  </Button>
                  <Button
                    variant={menuView === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMenuView('list')}
                    className="rounded-md"
                  >
                    <List className="h-4 w-4 mr-2" />
                    List View
                  </Button>
                </div>
              </div>
            )}

            {menuError ? (
              <Alert variant="destructive">
                <AlertDescription>{menuError}</AlertDescription>
              </Alert>
            ) : loadingMenu || loadingTier ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : subscriptionTier === 'premium' && menuView === 'pdf' ? (
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
            ) : (
              <StyledMenuDisplay
                venueId={venueSlug}
                menuItems={menuItems}
                categoryOrder={categoryOrder}
                onAddToCart={(item) => addToCart(item)}
                cart={cart}
                onRemoveFromCart={(itemId) => removeFromCart(itemId)}
                onUpdateQuantity={(itemId, quantity) => updateQuantity(itemId, quantity)}
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
          />
        </div>

        {/* Mobile Cart Button */}
        <MobileCartButton
          totalItems={getTotalItems()}
          onClick={() => setShowMobileCart(true)}
        />

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
          setCustomGroupSize('');
        }}
        onSetGroupSize={setGroupSize}
        onShowCustomGroupSize={() => setShowCustomGroupSize(true)}
        onSetCustomGroupSize={setCustomGroupSize}
        onHideCustomGroupSize={() => {
          setShowCustomGroupSize(false);
          setCustomGroupSize('');
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
          setCustomGroupSize('');
        }}
        onSetGroupSize={setGroupSize}
        onShowCustomGroupSize={() => setShowCustomGroupSize(true)}
        onSetCustomGroupSize={setCustomGroupSize}
        onHideCustomGroupSize={() => {
          setShowCustomGroupSize(false);
          setCustomGroupSize('');
        }}
        onSubmit={handleGroupSizeUpdate}
        mode="update"
      />
    </div>
  );
}
