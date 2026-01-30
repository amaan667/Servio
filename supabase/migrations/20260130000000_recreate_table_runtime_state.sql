-- Recreate table_runtime_state view (dropped by Security Advisor script).
-- Run in Supabase SQL Editor if the view is missing.
-- Matches app usage: SELECT, UPDATE (primary_status -> FREE), DELETE by venue_id.

-- Drop if exists so migration is idempotent
DROP VIEW IF EXISTS public.table_runtime_state;

CREATE VIEW public.table_runtime_state
WITH (security_invoker = true)
AS
SELECT
  t.id AS table_id,
  t.venue_id,
  COALESCE(t.label, 'Table ' || COALESCE(t.table_number::text, '')) AS label,
  COALESCE(t.seat_count, 0)::int AS seat_count,
  COALESCE(t.is_active, true) AS is_active,
  ts.id AS session_id,
  ts.status AS primary_status,
  ts.opened_at,
  ts.server_id,
  t.table_number,
  'NONE'::text AS reservation_status,
  NULL::uuid AS reserved_now_id,
  NULL::timestamp AS reserved_now_start,
  NULL::timestamp AS reserved_now_end,
  NULL::int AS reserved_now_party_size,
  NULL::text AS reserved_now_name,
  NULL::text AS reserved_now_phone,
  NULL::uuid AS next_reservation_id,
  NULL::timestamp AS next_reservation_start,
  NULL::timestamp AS next_reservation_end,
  NULL::int AS next_reservation_party_size,
  NULL::text AS next_reservation_name,
  NULL::text AS next_reservation_phone,
  NOW() AS updated_at,
  NULL::uuid AS order_id
FROM public.tables t
LEFT JOIN public.table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL;

-- INSTEAD OF UPDATE: when primary_status = 'FREE', close the table_session
CREATE OR REPLACE FUNCTION public.table_runtime_state_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_status = 'FREE' AND (OLD.primary_status IS DISTINCT FROM 'FREE' OR OLD.session_id IS NOT NULL) THEN
    UPDATE public.table_sessions
    SET closed_at = NOW()
    WHERE id = OLD.session_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_runtime_state_instead_of_update ON public.table_runtime_state;
CREATE TRIGGER table_runtime_state_instead_of_update
  INSTEAD OF UPDATE ON public.table_runtime_state
  FOR EACH ROW EXECUTE FUNCTION public.table_runtime_state_update();

-- INSTEAD OF DELETE: close sessions for the deleted "rows" (by venue_id the app deletes all for venue)
CREATE OR REPLACE FUNCTION public.table_runtime_state_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.session_id IS NOT NULL THEN
    UPDATE public.table_sessions SET closed_at = NOW() WHERE id = OLD.session_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS table_runtime_state_instead_of_delete ON public.table_runtime_state;
CREATE TRIGGER table_runtime_state_instead_of_delete
  INSTEAD OF DELETE ON public.table_runtime_state
  FOR EACH ROW EXECUTE FUNCTION public.table_runtime_state_delete();
