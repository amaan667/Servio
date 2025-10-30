import { createClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;

  if (!token) {
    redirect("/");
  }

  // Fetch invitation details on the server
  const supabase = await createClient();

  try {
    const { data: invitationData, error } = await supabase.rpc("get_invitation_by_token", {
      p_token: token,
    });

    if (error || !invitationData || invitationData.length === 0) {
      redirect("/invitation/invalid");
    }

    const invitation = invitationData[0];

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      redirect("/invitation/expired");
    }

    // Check if invitation is already accepted
    if (invitation.status !== "pending") {
      redirect("/invitation/invalid");
    }

    // Redirect to sign-up page with pre-populated email and invitation token
    redirect(
      `/sign-up?email=${encodeURIComponent(invitation.email)}&invitation=${token}&venue=${invitation.venue_id}&role=${invitation.role}`
    );
  } catch (_error) {
    redirect("/invitation/invalid");
  }
}
