import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function CompleteProfile() {
  const [businessType, setBusinessType] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!supabase) {
      setError("Supabase is not initialized.");
      setLoading(false);
      return;
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }
    // Upsert venue for this user
    const { error: upsertError } = await supabase.from("venues").upsert({
      name: businessName,
      business_type: businessType,
      owner_id: user.id,
      venue_id: `${businessName.toLowerCase().replace(/\s+/g, '-')}-${user.id.substring(0, 8)}`,
    });
    if (upsertError) {
      setError("Failed to save profile. Please try again.");
      setLoading(false);
      return;
    }
    // Fetch the venue just created
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!venue || venueError) {
      setError("Failed to fetch venue after creation. Please try again.");
      setLoading(false);
      return;
    }
    // Set session in localStorage (for AuthWrapper and dashboard)
    const session = {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "",
        created_at: user.created_at,
      },
      venue,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("servio_session", JSON.stringify(session));
    }
    setLoading(false);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow max-w-md w-full space-y-6">
        <h2 className="text-2xl font-bold mb-4">Complete Your Business Profile</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div>
          <label className="block mb-1 font-medium">Business Type</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={businessType}
            onChange={e => setBusinessType(e.target.value)}
            required
          >
            <option value="">Select...</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Cafe">Cafe</option>
            <option value="Food Truck">Food Truck</option>
            <option value="Coffee Shop">Coffee Shop</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Business Name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving..." : "Save to continue"}
        </Button>
      </form>
    </div>
  );
} 