'use client';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './auth-provider';
import { AuthenticatedClientProvider } from './authenticated-client-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthenticatedClientProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </AuthenticatedClientProvider>
    </ThemeProvider>
  );
}
