"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          router.replace('/sign-in');
          return;
        }

        setUser(session.user);

        // Get user's venues
        const { data: venuesData, error } = await supabase
          .from('venues')
          .select('*')
          .eq('owner_id', session.user.id);

        if (error) {
          console.error('Error fetching venues:', error);
        } else {
          const list = venuesData || [];
          setVenues(list);
          // If user has a venue, go straight to it
          if (list.length > 0 && list[0]?.id) {
            router.replace(`/dashboard/${list[0].id}`);
            return;
          }
        }
      } catch (error) {
        console.error('Error getting user:', error);
        router.replace('/sign-in');
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  // If no venues, present CTA
  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">No venues found. Complete your profile to get started.</p>
          <button
            onClick={() => router.push('/complete-profile')}
            className="bg-servio-purple text-white px-6 py-2 rounded hover:bg-servio-purple/90"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </main>
  );
}
