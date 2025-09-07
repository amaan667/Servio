import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTableRealtime(venueId: string, onTableChange?: () => void) {
  const supabase = createClient()
  const onTableChangeRef = useRef(onTableChange)

  useEffect(() => {
    onTableChangeRef.current = onTableChange
  }, [onTableChange])

  useEffect(() => {
    if (!venueId) return

    console.log('[TABLE_REALTIME] Setting up real-time subscription for venue:', venueId)

    const channel = supabase
      .channel(`tables-${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `venue_id=eq.${venueId}`,
      }, (payload) => {
        console.log('[TABLE_REALTIME] Table session changed:', payload.event, payload.new?.id)
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `venue_id=eq.${venueId}`,
      }, (payload) => {
        console.log('[TABLE_REALTIME] Table changed:', payload.event, payload.new?.id)
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `venue_id=eq.${venueId}`,
      }, (payload) => {
        console.log('[TABLE_REALTIME] Reservation changed:', payload.event, payload.new?.id)
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .subscribe((status) => {
        console.log('[TABLE_REALTIME] Subscription status:', status)
      })

    return () => { 
      console.log('[TABLE_REALTIME] Cleaning up channel')
      supabase.removeChannel(channel) 
    }
  }, [venueId])
}
