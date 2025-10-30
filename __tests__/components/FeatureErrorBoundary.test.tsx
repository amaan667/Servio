import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, beforeAll, afterAll } from "vitest";
import { FeatureErrorBoundary } from "@/components/error-boundaries/FeatureErrorBoundary";

function ThrowError() {
  throw new Error("Test error");
}

describe("FeatureErrorBoundary", () => {
  // Suppress console.error for these tests
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
      /* Empty */
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should render children when there is no error", () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <div>Test Content</div>
      </FeatureErrorBoundary>
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should show error UI when child component throws", () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText(/Test Feature Error/i)).toBeInTheDocument();
    expect(screen.getByText(/There was an issue loading Test Feature/i)).toBeInTheDocument();
  });

  it("should have reload button", () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ThrowError />
      </FeatureErrorBoundary>
    );

    const reloadButton = screen.getByRole("button", { name: /Reload Page/i });
    expect(reloadButton).toBeInTheDocument();
  });

  it("should use custom fallback if provided", () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature" fallback={<div>Custom Error Message</div>}>
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText("Custom Error Message")).toBeInTheDocument();
  });
});
