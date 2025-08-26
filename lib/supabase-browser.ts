'use client';
import { createClient } from './supabase/client';

// Legacy export for backward compatibility
export const supabaseBrowser = () => createClient();
