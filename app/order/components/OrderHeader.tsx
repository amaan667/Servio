import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Table, Receipt } from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

interface OrderHeaderProps {
  venueName: string;
  isDemo: boolean;
  isCounterOrder: boolean;
  tableNumber: string;
  counterNumber: string;
  groupSessionId: string | null;
  groupSize: number | null;
  totalItems: number;
  onShowMobileCart: () => void;
  onShowGroupSizePopup: () => void;
  venueSlug: string;
}

export function OrderHeader({
  venueName,
  isDemo,
  isCounterOrder,
  tableNumber,
  counterNumber,
  groupSessionId,
  groupSize,
  totalItems,
  onShowMobileCart,
  onShowGroupSizePopup,
  venueSlug,
}: OrderHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {/* Breadcrumb Navigation for Demo */}
        {isDemo && (
          <div className="mb-3 sm:mb-4">
            <NavigationBreadcrumb
              customBackPath={venueSlug ? `/dashboard/${venueSlug}` : "/"}
              customBackLabel="Dashboard"
              showBackButton={true}
              isDemo={true}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
            {/* Servio Logo */}
            <div className="flex items-center flex-shrink-0">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
                priority
              />
            </div>

            {/* Business Name and Location */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {isDemo ? "Demo Café" : venueName}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                <div className="flex items-center gap-2">
                  {isCounterOrder ? (
                    <>
                      <Receipt className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      <span className="text-sm sm:text-base text-orange-600 dark:text-orange-400 font-medium">
                        Counter {counterNumber}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs"
                      >
                        Counter Order
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Table className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-sm sm:text-base text-blue-600 dark:text-blue-400 font-medium">
                        Table {tableNumber}
                      </span>
                    </>
                  )}
                </div>
                {!isCounterOrder && groupSessionId && groupSize && (
                  <button
                    onClick={onShowGroupSizePopup}
                    className="px-3 py-1 bg-purple-600 dark:bg-purple-700 text-white rounded-full text-xs font-medium hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors self-start sm:self-auto"
                  >
                    {groupSize} {groupSize === 1 ? "person" : "people"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Cart Button */}
          <Button
            onClick={onShowMobileCart}
            className="md:hidden ml-2 flex-shrink-0"
            variant="servio"
            size="default"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="ml-1 text-sm font-medium">{totalItems}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
