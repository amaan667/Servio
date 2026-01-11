"use client";

import React from "react";
import { Check } from "lucide-react";

interface OnboardingProgressProps {

}

export default function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const steps = [
    { number: 1, label: "Venue Setup", description: "Name, logo & payment" },
    { number: 2, label: "Menu", description: "Upload or create your menu" },
    { number: 3, label: "Tables", description: "Set up tables & QR codes" },
    { number: 4, label: "Test Order", description: "Try the customer experience" },
  ];

  return (
    <div className="mb-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all ${
                    step.number < currentStep
                      ? "bg-green-500 text-white"

                  }`}
                >
                  {step.number < currentStep ? <Check className="w-6 h-6" /> : step.number}
                </div>
                <div className="text-center mt-2">
                  <div
                    className={`font-semibold text-sm ${
                      step.number <= currentStep ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 hidden sm:block">
                    {step.description}
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 mt-[-40px] transition-all ${
                    step.number < currentStep ? "bg-green-500" : "bg-gray-200"
                  }`}
                  style={{ maxWidth: "120px" }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Counter */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-600">
          Step {currentStep} of 4 • Estimated time:{" "}
          {currentStep === 1
            ? "2 min"

                : "1 min"}
        </p>
      </div>
    </div>
  );
}
