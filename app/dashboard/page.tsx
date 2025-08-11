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
          setVenues(venuesData || []);
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

  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome back, {user.email}!</h2>
          
          {venues.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Your Venues:</h3>
              {venues.map((venue) => (
                <div key={venue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <h4 className="font-medium">{venue.name}</h4>
                  <p className="text-gray-600">{venue.venue_type}</p>
                  <button
                    onClick={() => router.push(`/dashboard/${venue.id}`)}
                    className="mt-2 bg-servio-purple text-white px-4 py-2 rounded hover:bg-servio-purple/90"
                  >
                    Manage Venue
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No venues found. Complete your profile to get started.</p>
              <button
                onClick={() => router.push('/complete-profile')}
                className="bg-servio-purple text-white px-6 py-2 rounded hover:bg-servio-purple/90"
              >
                Complete Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
