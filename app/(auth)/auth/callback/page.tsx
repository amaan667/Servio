export const dynamic = "force-dynamic";
export const revalidate = false;
import CallbackClient from "./CallbackClient";

export default function OAuthCallback() {
  return <CallbackClient />;
}