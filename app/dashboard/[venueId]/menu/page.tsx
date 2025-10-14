import { redirect } from 'next/navigation';

export default async function MenuPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  // Redirect to menu-management since that's where the actual menu functionality is
  redirect(`/dashboard/${venueId}/menu-management`);
}
