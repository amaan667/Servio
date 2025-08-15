import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import AppHeader from "@/components/AppHeader";
import AuthWrapper from "@/components/AuthWrapper";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            <AppHeader />
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
