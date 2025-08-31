import { AuthProvider } from '@/components/auth-provider';

interface LayoutWithAuthProps {
  children: React.ReactNode;
}

export default function LayoutWithAuth({ children }: LayoutWithAuthProps) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}