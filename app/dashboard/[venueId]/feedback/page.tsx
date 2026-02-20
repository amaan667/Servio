import FeedbackClientPage from "./page.client";
import { requireDashboardAccess } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Enforce server-side auth and venue authorization before feedback queries.
  const auth = await requireDashboardAccess(venueId);

  // Fetch questions server-side for instant load
  let initialQuestions: Array<{
    id: string;
    prompt: string;
    type: string;
    choices: string[];
    is_active: boolean;
  }> = [];

  try {
    const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
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
      tier={auth.tier}
      role={auth.role}
      initialQuestions={initialQuestions}
    />
  );
}
