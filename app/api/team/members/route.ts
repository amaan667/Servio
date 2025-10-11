import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { error: 'Missing venueId parameter' },
        { status: 400 }
      );
    }

    // Check if user is a member of this venue
    const userRole = await getUserRole(supabase, venueId);
    if (!userRole) {
      return NextResponse.json(
        { error: 'You are not a member of this venue' },
        { status: 403 }
      );
    }

    // Fetch all team members for this venue (RLS will enforce read access)
    const { data: members, error } = await supabase
      .from('user_venue_roles')
      .select(`
        id,
        user_id,
        role,
        created_at
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[TEAM MEMBERS] Error fetching members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    // For each member, fetch their profile data from auth.users
    const adminSupabase = createClient({ serviceRole: true });
    const membersWithProfiles = await Promise.all(
      (members || []).map(async (member) => {
        const { data: userData } = await adminSupabase.auth.admin.getUserById(member.user_id);
        return {
          ...member,
          email: userData.user?.email || 'Unknown',
          name: userData.user?.user_metadata?.name || userData.user?.user_metadata?.full_name || null,
          avatar_url: userData.user?.user_metadata?.avatar_url || null,
          last_sign_in: userData.user?.last_sign_in_at || null,
        };
      })
    );

    return NextResponse.json({
      members: membersWithProfiles,
      yourRole: userRole
    });

  } catch (error: any) {
    console.error('[TEAM MEMBERS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

