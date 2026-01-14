import FeedbackClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch questions server-side for instant load
  let initialQuestions: Array<{
    id: string;
    prompt: string;
    type: string;
    choices: string[];
    is_active: boolean;
  }> = [];

  try {
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
    const supabase = createAdminClient();

    const { data: questionsData, error } = await supabase
      .from("feedback_questions")
      .select("*")
      .eq("venue_id", normalizedVenueId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && questionsData) {
      initialQuestions = questionsData
        .map((q) => {
          const prompt = q.question_text || q.question || q.text || "";
          if (!prompt) return null;

          return {
            id: q.id,
            prompt,
            type: q.question_type || "stars",
            choices: q.options || [],
            is_active: q.is_active ?? true,
          };
        })
        .filter((q): q is NonNullable<typeof q> => q !== null);
    }
  } catch {
    // Continue with empty array on error
  }

  return (
    <FeedbackClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      initialQuestions={initialQuestions}
    />
  );
}
