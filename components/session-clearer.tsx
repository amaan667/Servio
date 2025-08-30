"use client";

import { useEffect } from "react";
import { supabase } from '../lib/supabase/client'

export default function SessionClearer() {
  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut()
    }
    clearSession()
  }, [])

  return null
}
