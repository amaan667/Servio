import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/tables/cleanup-duplicates - Remove duplicate tables
export async function POST(req: Request) {
  try {
    const { venue_id } = await req.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Get all tables for this venue
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, created_at')
      .eq('venue_id', venue_id)
      .eq('is_active', true)
      .order('label');

    if (tablesError) {
      console.error('[CLEANUP DUPLICATES] Tables error:', tablesError);
      return NextResponse.json({ ok: false, error: tablesError.message }, { status: 500 });
    }

    if (!tables || tables.length === 0) {
      return NextResponse.json({ ok: true, message: 'No tables found', duplicates_removed: 0 });
    }

    // Group tables by label to find duplicates
    const tablesByLabel = new Map<string, any[]>();
    tables.forEach(table => {
      if (!tablesByLabel.has(table.label)) {
        tablesByLabel.set(table.label, []);
      }
      tablesByLabel.get(table.label)!.push(table);
    });

    // Find duplicates (keep the oldest one, remove the rest)
    const duplicatesToRemove: string[] = [];
    tablesByLabel.forEach((tablesWithSameLabel, label) => {
      if (tablesWithSameLabel.length > 1) {
        // Sort by created_at, keep the oldest
        const sorted = tablesWithSameLabel.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        // Mark all but the first (oldest) for removal
        for (let i = 1; i < sorted.length; i++) {
          duplicatesToRemove.push(sorted[i].id);
        }
      }
    });

    if (duplicatesToRemove.length === 0) {
      return NextResponse.json({ ok: true, message: 'No duplicates found', duplicates_removed: 0 });
    }

    console.log(`[CLEANUP DUPLICATES] Found ${duplicatesToRemove.length} duplicate tables to remove`);

    // Remove duplicate tables
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .in('id', duplicatesToRemove);

    if (deleteError) {
      console.error('[CLEANUP DUPLICATES] Delete error:', deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully removed ${duplicatesToRemove.length} duplicate tables`,
      duplicates_removed: duplicatesToRemove.length
    });

  } catch (error) {
    console.error('[CLEANUP DUPLICATES] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
