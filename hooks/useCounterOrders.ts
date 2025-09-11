import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface CounterOrder {
	id: string;
	table_number: number;
	customer_name: string | null;
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
			const thirtyMinutesAgoISO = new Date(Date.now() - 30 * 60 * 1000).toISOString();

			const { data, error } = await supabase
				.from('orders')
				.select(`
					id,
					table_number,
					customer_name,
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
				// Only live orders from the last 30 minutes
				.gte('created_at', thirtyMinutesAgoISO)
				// Active statuses per requirement
				.in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'])
				.order('created_at', { ascending: false });

			if (error) throw error;
			return data as CounterOrder[];
		},
		refetchInterval: 15000,
	});
}

// Get counter order counts
export function useCounterOrderCounts(venueId: string) {
	return useQuery({
		queryKey: ['counter-order-counts', venueId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('orders')
				.select('order_status, source')
				.eq('venue_id', venueId)
				.eq('source', 'counter')
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
	});
}
