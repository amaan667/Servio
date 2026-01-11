// Helper functions for onboarding progress tracking

export async function saveOnboardingProgress(

  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/onboarding/progress", {

      headers: { "Content-Type": "application/json" },

        data: data || {},
      }),

  } catch (_error) {
    // Silently fail - progress tracking is not critical

  }
}

export async function getOnboardingProgress(): Promise<{

  data: Record<string, unknown>;
} | null> {
  try {
    const response = await fetch("/api/onboarding/progress");
    const result = await response.json();
    if (result.success && result.progress) {
      return {

        data: result.progress.data || {},
      };
    }
    return null;
  } catch {
    return null;
  }
}
