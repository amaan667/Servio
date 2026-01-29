"use client";

import React, { useState, useEffect } from "react";
import { Check, SkipForward, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveOnboardingProgress, getOnboardingProgress } from "@/lib/onboarding-progress";
import { useRouter } from "next/navigation";

interface OnboardingStep {
  number: 1 | 2 | 3 | 4;
  label: string;
  description: string;
  route: string;
  skippable: boolean;
  estimatedTime: string;
}

interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepChange?: (step: number) => void;
  allowSkip?: boolean;
  allowNavigation?: boolean;
}

export default function OnboardingProgress({
  currentStep,
  onStepChange,
  allowSkip = true,
  allowNavigation = true,
}: OnboardingProgressProps) {
  const router = useRouter();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const steps: OnboardingStep[] = [
    {
      number: 1,
      label: "Venue Setup",
      description: "Name, logo & payment",
      route: "/onboarding/venue-setup",
      skippable: false,
      estimatedTime: "2 min",
    },
    {
      number: 2,
      label: "Menu",
      description: "Upload or create your menu",
      route: "/onboarding/menu",
      skippable: true,
      estimatedTime: "1-2 min",
    },
    {
      number: 3,
      label: "Tables",
      description: "Set up tables & QR codes",
      route: "/onboarding/tables",
      skippable: true,
      estimatedTime: "1 min",
    },
    {
      number: 4,
      label: "Test Order",
      description: "Try the customer experience",
      route: "/onboarding/test-order",
      skippable: true,
      estimatedTime: "1 min",
    },
  ];

  // Load progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      const progress = await getOnboardingProgress();
      if (progress) {
        setCompletedSteps(progress.completed_steps);
      }
    };
    loadProgress();
  }, []);

  // Save progress when completed steps change
  useEffect(() => {
    const saveProgress = async () => {
      await saveOnboardingProgress(currentStep, completedSteps);
    };
    saveProgress();
  }, [currentStep, completedSteps]);

  const handleStepClick = (stepNumber: number) => {
    if (!allowNavigation) return;

    if (stepNumber !== currentStep) {
      const s = steps[stepNumber - 1];
      if (s) router.push(s.route);
      onStepChange?.(stepNumber);
    }
  };

  const handleSkipStep = async (stepNumber: number) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Mark step as completed (skipped)
      const newCompletedSteps = [...completedSteps];
      if (!newCompletedSteps.includes(stepNumber)) {
        newCompletedSteps.push(stepNumber);
      }
      setCompletedSteps(newCompletedSteps);

      // Move to next step or complete onboarding
      if (stepNumber < 4) {
        const nextStep = Math.min(
          ...steps.filter((s) => !newCompletedSteps.includes(s.number)).map((s) => s.number)
        );
        const next = nextStep != null && nextStep !== Infinity ? steps[nextStep - 1] : undefined;
        if (next) {
          router.push(next.route);
          onStepChange?.(nextStep);
        } else {
          // All steps completed, redirect to dashboard
          await completeOnboarding();
        }
      } else {
        // Last step skipped, complete onboarding
        await completeOnboarding();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      // Mark onboarding as completed in user metadata
      await fetch("/api/signup/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      // Set localStorage flag for banner
      localStorage.setItem("onboarding_complete", "true");

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (_error) {
      // Failed to complete onboarding
    }
  };

  const isStepCompleted = (stepNumber: number) => completedSteps.includes(stepNumber);
  const isStepClickable = (stepNumber: number) =>
    allowNavigation &&
    (stepNumber <= Math.max(currentStep, ...completedSteps) || isStepCompleted(stepNumber));

  return (
    <div className="mb-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => handleStepClick(step.number)}
                  disabled={!isStepClickable(step.number)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all ${
                    isStepCompleted(step.number)
                      ? "bg-green-500 text-white cursor-pointer hover:bg-green-600"
                      : step.number === currentStep
                        ? "bg-purple-600 text-white ring-4 ring-purple-200 cursor-default"
                        : isStepClickable(step.number)
                          ? "bg-gray-200 text-gray-500 hover:bg-gray-300 cursor-pointer"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isStepCompleted(step.number) ? <Check className="w-6 h-6" /> : step.number}
                </button>
                <div className="text-center mt-2">
                  <div
                    className={`font-semibold text-sm ${
                      isStepCompleted(step.number) || step.number <= currentStep
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 hidden sm:block">
                    {step.description}
                  </div>
                </div>

                {/* Skip Button */}
                {allowSkip &&
                  step.skippable &&
                  step.number === currentStep &&
                  !isStepCompleted(step.number) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSkipStep(step.number)}
                      disabled={isLoading}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <SkipForward className="w-3 h-3 mr-1" />
                      Skip
                    </Button>
                  )}
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 mt-[-40px] transition-all ${
                    isStepCompleted(step.number) ? "bg-green-500" : "bg-gray-200"
                  }`}
                  style={{ maxWidth: "120px" }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Info & Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Step {currentStep} of 4 • Estimated time: {steps[currentStep - 1]?.estimatedTime ?? "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">{completedSteps.length} of 4 steps completed</p>
        </div>

        {/* Quick Navigation */}
        {allowNavigation && (
          <div className="flex gap-2">
            {steps
              .filter((step) => step.number !== currentStep && isStepClickable(step.number))
              .map((step) => (
                <Button
                  key={step.number}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStepClick(step.number)}
                  className="text-xs"
                >
                  {step.label}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              ))}
          </div>
        )}
      </div>

      {/* Progress Summary */}
      {completedSteps.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ Completed:{" "}
            {steps
              .filter((step) => completedSteps.includes(step.number))
              .map((step) => step.label)
              .join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
