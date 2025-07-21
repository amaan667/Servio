import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import GlobalNav from "@/components/global-nav";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
};

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    let ignore = false;
    supabase?.auth.getUser().then(({ data: { user } }) => {
      if (ignore) return;
      setUser(user);
      if (!user) {
        setLoading(false);
        router.replace("/sign-in");
      }
    });
    const { data: listener } = supabase?.auth.onAuthStateChange?.((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        setLoading(false);
        router.replace("/sign-in");
      }
    }) || { data: { subscription: { unsubscribe: () => {} } } };
    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    async function checkProfile() {
      if (!supabase || !user) return;
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!ignore && (!data || error)) {
        setProfileComplete(false);
        router.replace("/complete-profile");
      } else {
        setProfileComplete(true);
        setLoading(false);
      }
    }
    checkProfile();
    return () => { ignore = true; };
  }, [user, router]);

  if (loading || profileComplete === false) return <div>Loading...</div>;
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GlobalNav />
          <AuthWrapper>{children}</AuthWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
