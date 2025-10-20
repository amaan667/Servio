import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

export function useTableRealtime(venueId: string, onTableChange?: () => void) {
  const supabase = createClient()
  const onTableChangeRef = useRef(onTableChange)

  useEffect(() => {
    onTableChangeRef.current = onTableChange
  }, [onTableChange])

  useEffect(() => {
    if (!venueId) return


    const channel = supabase
      .channel(`tables-${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `venue_id=eq.${venueId}`,
      }, (payload: any) => {
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `venue_id=eq.${venueId}`,
      }, (payload: any) => {
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `venue_id=eq.${venueId}`,
      }, (payload: any) => {
        if (onTableChangeRef.current) {
          onTableChangeRef.current()
        }
      })
      .subscribe((status: any) => {
      })

    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [venueId])
}
