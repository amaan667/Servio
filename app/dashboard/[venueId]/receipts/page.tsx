import { redirect } from "next/navigation";

export default async function ReceiptsRedirectPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  redirect(`/dashboard/${venueId}/payments`);
}
