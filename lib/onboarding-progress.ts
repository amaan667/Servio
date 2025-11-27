// Helper functions for onboarding progress tracking

export async function saveOnboardingProgress(
  currentStep: number,
  completedSteps: number[],
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_step: currentStep,
        completed_steps: completedSteps,
        data: data || {},
      }),
    });
  } catch (_error) {
    // Silently fail - progress tracking is not critical
    logger.error("Failed to save onboarding progress:", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
  }
}

export async function getOnboardingProgress(): Promise<{
  current_step: number;
  completed_steps: number[];
  data: Record<string, unknown>;
} | null> {
  try {
    const response = await fetch("/api/onboarding/progress");
    const result = await response.json();
    if (result.success && result.progress) {
      return {
        current_step: result.progress.current_step || 1,
        completed_steps: result.progress.completed_steps || [],
        data: result.progress.data || {},
      };
    }
    return null;
  } catch {
    return null;
  }
}
