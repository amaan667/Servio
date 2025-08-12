// app/auth/layout.tsx
export const runtime = 'nodejs';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Minimal layout for auth pages; avoids importing NavBar or client-only modules
  return <>{children}</>;
}
