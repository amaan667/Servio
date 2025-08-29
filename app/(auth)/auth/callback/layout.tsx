export const dynamic = "force-dynamic";
export const revalidate = false;

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
