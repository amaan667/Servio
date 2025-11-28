import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { id } = await req.json().catch(()=>({ /* Empty */ }));
  if (!id) return apiErrors.badRequest('id required');
      const admin = createAdminClient();
  const { error } = await admin.from('staff_shifts').delete().eq('id', id);
  if (error) return apiErrors.badRequest(error.message);
  return success({ success: true });
}

