'use client';
import { ThemeProvider } from 'next-themes';
import { AuthenticatedClientProvider } from './authenticated-client-provider';
import { ClientErrorHandler } from '@/components/ClientErrorHandler';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ClientErrorHandler />
      <AuthenticatedClientProvider>
        {children}
      </AuthenticatedClientProvider>
    </ThemeProvider>
  );
}
