export const dynamic = "force-dynamic";
export const revalidate = false;

export default function CallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}