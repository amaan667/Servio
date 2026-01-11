import { OrderCard } from "@/components/orders/OrderCard";
import { mapCounterOrderToCardData } from "@/lib/orders/mapCounterOrderToCardData";
import type { CounterOrder } from "@/hooks/useCounterOrders";

interface CounterOrdersSectionProps {

}

export function CounterOrdersSection({ counterOrders }: CounterOrdersSectionProps) {
  if (counterOrders.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Counter Orders</h2>
        <p className="text-sm text-gray-900">
          Fast-moving orders from counter service - work FIFO ({counterOrders.length} active)
        </p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {counterOrders
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((order) => (
              <div key={order.id} className="flex-shrink-0 w-80">
                <OrderCard order={mapCounterOrderToCardData(order)} variant="counter" />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
