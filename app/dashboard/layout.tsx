// Force dynamic rendering to prevent static generation errors with cookies
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
