import { Suspense } from 'react';
import InvitationAcceptanceClient from './InvitationAcceptanceClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;

  if (!token) {
    redirect('/');
  }

  // Fetch invitation details on the server
  const supabase = await createClient();
  
  try {
    const { data: invitationData, error } = await supabase
      .rpc('get_invitation_by_token', { p_token: token });

    if (error || !invitationData || invitationData.length === 0) {
      redirect('/invitation/invalid');
    }

    const invitation = invitationData[0];

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      redirect('/invitation/expired');
    }

    // Check if invitation is already accepted
    if (invitation.status !== 'pending') {
      redirect('/invitation/invalid');
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Suspense fallback={
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading invitation...</p>
            </div>
          }>
            <InvitationAcceptanceClient invitation={invitation} token={token} />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    redirect('/invitation/invalid');
  }
}
