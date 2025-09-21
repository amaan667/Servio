import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { todayWindowForTZ } from '@/lib/time';

const supabase = createClient();

export interface CounterOrder {
	id: string;
	table_number: number;
	customer_name: string | null;
	customer_phone?: string | null;
	order_status: string;
	payment_status: string;
	total_amount: number;
	created_at: string;
	updated_at: string;
	source: 'counter';
	items: Array<{
		item_name: string;
		quantity: number;
		price: number;
	}>;
}

// Get active counter orders (orders with source = 'counter' and active status)
export function useCounterOrders(venueId: string) {
	return useQuery({
		queryKey: ['counter-orders', venueId],
		queryFn: async () => {
			// Use proper daily reset logic - only show orders from today
			const todayWindow = todayWindowForTZ('Europe/London');
			const todayStartISO = todayWindow.startUtcISO;
			const todayEndISO = todayWindow.endUtcISO;

			const { data, error } = await supabase
				.from('orders')
				.select(`
					id,
					table_number,
					customer_name,
					customer_phone,
					order_status,
					payment_status,
					total_amount,
					created_at,
					updated_at,
					source,
					items
				`)
				.eq('venue_id', venueId)
				.eq('source', 'counter')
				// Only orders from today (proper daily reset logic)
				.gte('created_at', todayStartISO)
				.lt('created_at', todayEndISO)
				// Active statuses per requirement
				.in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'])
				.order('created_at', { ascending: false });

			if (error) throw error;
			return data as CounterOrder[];
		},
		refetchInterval: 15000,
		staleTime: 5000,
		gcTime: 30000,
		retry: 3,
		retryDelay: 1000
	});
}

// Get counter order counts
export function useCounterOrderCounts(venueId: string) {
	return useQuery({
		queryKey: ['counter-order-counts', venueId],
		queryFn: async () => {
			// Use proper daily reset logic - only count orders from today
			const todayWindow = todayWindowForTZ('Europe/London');
			const todayStartISO = todayWindow.startUtcISO;
			const todayEndISO = todayWindow.endUtcISO;

			const { data, error } = await supabase
				.from('orders')
				.select('order_status, source, created_at')
				.eq('venue_id', venueId)
				.eq('source', 'counter')
				// Only orders from today (proper daily reset logic)
				.gte('created_at', todayStartISO)
				.lt('created_at', todayEndISO)
				.in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

			if (error) throw error;
			
			const total = data?.length || 0;
			const byStatus = data?.reduce((acc: Record<string, number>, order: any) => {
				acc[order.order_status] = (acc[order.order_status] || 0) + 1;
				return acc;
			}, {} as Record<string, number>) || {};

			return {
				total,
				placed: byStatus.PLACED || 0,
				in_prep: byStatus.IN_PREP || 0,
				ready: byStatus.READY || 0,
				serving: byStatus.SERVING || 0,
			};
		},
		refetchInterval: 15000,
		staleTime: 5000,
		gcTime: 30000,
		retry: 3,
		retryDelay: 1000
	});
}
