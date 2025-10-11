import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireRole, PERMISSIONS } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!venueId) {
      return NextResponse.json(
        { error: 'Missing venueId parameter' },
        { status: 400 }
      );
    }

    // Only owners and managers can view audit log
    const userRole = await requireRole(supabase, venueId, ['owner', 'manager']);

    // Fetch role changes (RLS will enforce read access)
    const { data: changes, error } = await supabase
      .from('role_changes')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AUDIT LOG] Error fetching changes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit log' },
        { status: 500 }
      );
    }

    // Enrich with user details
    const adminSupabase = createClient({ serviceRole: true });
    const enrichedChanges = await Promise.all(
      (changes || []).map(async (change) => {
        const [changedByData, targetUserData] = await Promise.all([
          adminSupabase.auth.admin.getUserById(change.changed_by),
          adminSupabase.auth.admin.getUserById(change.target_user)
        ]);

        return {
          ...change,
          changed_by_email: changedByData.data.user?.email || 'Unknown',
          changed_by_name: changedByData.data.user?.user_metadata?.name || null,
          target_user_email: targetUserData.data.user?.email || 'Unknown',
          target_user_name: targetUserData.data.user?.user_metadata?.name || null,
        };
      })
    );

    return NextResponse.json({
      changes: enrichedChanges,
      total: enrichedChanges.length,
      yourRole: userRole
    });

  } catch (error: any) {
    console.error('[AUDIT LOG] Error:', error);
    
    if (error.status === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

