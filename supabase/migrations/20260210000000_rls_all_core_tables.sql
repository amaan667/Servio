-- Migration: Enable RLS on core tables (only on tables that exist).
-- Safe to run manually in Supabase SQL Editor: skips any table that does not exist.
--
-- Strategy:
-- 1. Create a reusable helper function `user_has_venue_access(venue_id)`
--    that checks venue_membership + venues.owner_user_id (belt-and-suspenders).
-- 2. Enable RLS on every core table.
-- 3. Add policies: authenticated users see only their venue data;
--    service_role bypasses RLS automatically (used for public endpoints).
--
-- Safe to run: all statements are idempotent (IF NOT EXISTS / DROP IF EXISTS).

-- ============================================================
-- HELPER: Reusable venue-access check function
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_venue_access(p_venue_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.venue_membership
    WHERE venue_id = p_venue_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.venues
    WHERE venue_id = p_venue_id AND owner_user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_venue_access(TEXT) TO service_role;

-- ============================================================
-- venues
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN
    ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "venue_select_own" ON public.venues;
    CREATE POLICY "venue_select_own" ON public.venues FOR SELECT TO authenticated
      USING (owner_user_id = auth.uid() OR public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "venue_modify_owner" ON public.venues;
    CREATE POLICY "venue_modify_owner" ON public.venues FOR ALL TO authenticated
      USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
    DROP POLICY IF EXISTS "venue_service_role" ON public.venues;
    CREATE POLICY "venue_service_role" ON public.venues FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- user_venue_roles
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_venue_roles') THEN
    ALTER TABLE public.user_venue_roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "uvr_select_own" ON public.user_venue_roles;
    CREATE POLICY "uvr_select_own" ON public.user_venue_roles FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "uvr_manage_venue" ON public.user_venue_roles;
    CREATE POLICY "uvr_manage_venue" ON public.user_venue_roles FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "uvr_service_role" ON public.user_venue_roles;
    CREATE POLICY "uvr_service_role" ON public.user_venue_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- tables
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tables') THEN
    ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tables_venue_access" ON public.tables;
    CREATE POLICY "tables_venue_access" ON public.tables FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "tables_service_role" ON public.tables;
    CREATE POLICY "tables_service_role" ON public.tables FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- table_sessions
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_sessions') THEN
    ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "table_sessions_venue_access" ON public.table_sessions;
    CREATE POLICY "table_sessions_venue_access" ON public.table_sessions FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "table_sessions_service_role" ON public.table_sessions;
    CREATE POLICY "table_sessions_service_role" ON public.table_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- counter_sessions
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'counter_sessions') THEN
    ALTER TABLE public.counter_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "counter_sessions_venue_access" ON public.counter_sessions;
    CREATE POLICY "counter_sessions_venue_access" ON public.counter_sessions FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "counter_sessions_service_role" ON public.counter_sessions;
    CREATE POLICY "counter_sessions_service_role" ON public.counter_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- reservations
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
    ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reservations_venue_access" ON public.reservations;
    CREATE POLICY "reservations_venue_access" ON public.reservations FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "reservations_service_role" ON public.reservations;
    CREATE POLICY "reservations_service_role" ON public.reservations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- orders
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "orders_venue_access" ON public.orders;
    CREATE POLICY "orders_venue_access" ON public.orders FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "orders_service_role" ON public.orders;
    CREATE POLICY "orders_service_role" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- menu_categories
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
    ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "menu_categories_venue_access" ON public.menu_categories;
    CREATE POLICY "menu_categories_venue_access" ON public.menu_categories FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "menu_categories_service_role" ON public.menu_categories;
    CREATE POLICY "menu_categories_service_role" ON public.menu_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- menu_items
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
    ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "menu_items_venue_access" ON public.menu_items;
    CREATE POLICY "menu_items_venue_access" ON public.menu_items FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "menu_items_service_role" ON public.menu_items;
    CREATE POLICY "menu_items_service_role" ON public.menu_items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- menu_item_modifiers (skipped if table does not exist)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_item_modifiers') THEN
    ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "menu_item_modifiers_venue_access" ON public.menu_item_modifiers;
    CREATE POLICY "menu_item_modifiers_venue_access" ON public.menu_item_modifiers FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "menu_item_modifiers_service_role" ON public.menu_item_modifiers;
    CREATE POLICY "menu_item_modifiers_service_role" ON public.menu_item_modifiers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- menu_design
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_design') THEN
    ALTER TABLE public.menu_design ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "menu_design_venue_access" ON public.menu_design;
    CREATE POLICY "menu_design_venue_access" ON public.menu_design FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "menu_design_service_role" ON public.menu_design;
    CREATE POLICY "menu_design_service_role" ON public.menu_design FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- staff_invitations
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_invitations') THEN
    ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "staff_invitations_venue_access" ON public.staff_invitations;
    CREATE POLICY "staff_invitations_venue_access" ON public.staff_invitations FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "staff_invitations_service_role" ON public.staff_invitations;
    CREATE POLICY "staff_invitations_service_role" ON public.staff_invitations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- ingredients
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') THEN
    ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ingredients_venue_access" ON public.ingredients;
    CREATE POLICY "ingredients_venue_access" ON public.ingredients FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "ingredients_service_role" ON public.ingredients;
    CREATE POLICY "ingredients_service_role" ON public.ingredients FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- inventory_logs
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_logs') THEN
    ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "inventory_logs_venue_access" ON public.inventory_logs;
    CREATE POLICY "inventory_logs_venue_access" ON public.inventory_logs FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "inventory_logs_service_role" ON public.inventory_logs;
    CREATE POLICY "inventory_logs_service_role" ON public.inventory_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- kds_stations
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kds_stations') THEN
    ALTER TABLE public.kds_stations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "kds_stations_venue_access" ON public.kds_stations;
    CREATE POLICY "kds_stations_venue_access" ON public.kds_stations FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "kds_stations_service_role" ON public.kds_stations;
    CREATE POLICY "kds_stations_service_role" ON public.kds_stations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- kds_tickets
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kds_tickets') THEN
    ALTER TABLE public.kds_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "kds_tickets_venue_access" ON public.kds_tickets;
    CREATE POLICY "kds_tickets_venue_access" ON public.kds_tickets FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "kds_tickets_service_role" ON public.kds_tickets;
    CREATE POLICY "kds_tickets_service_role" ON public.kds_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- payments
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "payments_venue_access" ON public.payments;
    CREATE POLICY "payments_venue_access" ON public.payments FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "payments_service_role" ON public.payments;
    CREATE POLICY "payments_service_role" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- bill_splits
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bill_splits') THEN
    ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "bill_splits_venue_access" ON public.bill_splits;
    CREATE POLICY "bill_splits_venue_access" ON public.bill_splits FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "bill_splits_service_role" ON public.bill_splits;
    CREATE POLICY "bill_splits_service_role" ON public.bill_splits FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- feedback
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedback') THEN
    ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "feedback_venue_access" ON public.feedback;
    CREATE POLICY "feedback_venue_access" ON public.feedback FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "feedback_service_role" ON public.feedback;
    CREATE POLICY "feedback_service_role" ON public.feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- feedback_questions
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedback_questions') THEN
    ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "feedback_questions_venue_access" ON public.feedback_questions;
    CREATE POLICY "feedback_questions_venue_access" ON public.feedback_questions FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "feedback_questions_service_role" ON public.feedback_questions;
    CREATE POLICY "feedback_questions_service_role" ON public.feedback_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- analytics_events
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_events') THEN
    ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "analytics_events_venue_access" ON public.analytics_events;
    CREATE POLICY "analytics_events_venue_access" ON public.analytics_events FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "analytics_events_service_role" ON public.analytics_events;
    CREATE POLICY "analytics_events_service_role" ON public.analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- ai_chat_conversations
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_conversations') THEN
    ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ai_chat_conversations_own" ON public.ai_chat_conversations;
    CREATE POLICY "ai_chat_conversations_own" ON public.ai_chat_conversations FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "ai_chat_conversations_service_role" ON public.ai_chat_conversations;
    CREATE POLICY "ai_chat_conversations_service_role" ON public.ai_chat_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- ai_chat_messages
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_messages') THEN
    ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ai_chat_messages_own" ON public.ai_chat_messages;
    CREATE POLICY "ai_chat_messages_own" ON public.ai_chat_messages FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.ai_chat_conversations c WHERE c.id = ai_chat_messages.conversation_id AND c.user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.ai_chat_conversations c WHERE c.id = ai_chat_messages.conversation_id AND c.user_id = auth.uid())
      );
    DROP POLICY IF EXISTS "ai_chat_messages_service_role" ON public.ai_chat_messages;
    CREATE POLICY "ai_chat_messages_service_role" ON public.ai_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- ai_action_audit
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_action_audit') THEN
    ALTER TABLE public.ai_action_audit ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ai_action_audit_venue_access" ON public.ai_action_audit;
    CREATE POLICY "ai_action_audit_venue_access" ON public.ai_action_audit FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "ai_action_audit_service_role" ON public.ai_action_audit;
    CREATE POLICY "ai_action_audit_service_role" ON public.ai_action_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
