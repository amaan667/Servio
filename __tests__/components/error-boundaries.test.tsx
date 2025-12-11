import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardErrorBoundary } from "@/components/error-boundaries/DashboardErrorBoundary";
import { APIErrorBoundary } from "@/components/error-boundaries/APIErrorBoundary";

const ThrowError = ({ message = "Test error" }: { message?: string }) => {
  throw new Error(message);
};

describe("Error Boundaries", () => {
  describe("DashboardErrorBoundary", () => {
    it("should render children when no error", () => {
      render(
        <DashboardErrorBoundary>
          <div>Test content</div>
        </DashboardErrorBoundary>
      );
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("should render error UI when error occurs", () => {
      // Suppress error console output in test
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        /* Empty */
      });

      render(
        <DashboardErrorBoundary>
          <ThrowError />
        </DashboardErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/Reload Page/i)).toBeInTheDocument();

      spy.mockRestore();
    });
  });

  describe("APIErrorBoundary", () => {
    it("should render children when no error", () => {
      render(
        <APIErrorBoundary>
          <div>API content</div>
        </APIErrorBoundary>
      );
      expect(screen.getByText("API content")).toBeInTheDocument();
    });

    it("should render error message when error occurs", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        /* Empty */
      });

      render(
        <APIErrorBoundary>
          <ThrowError />
        </APIErrorBoundary>
      );

      expect(screen.getByText(/Failed to load data/i)).toBeInTheDocument();

      spy.mockRestore();
    });
  });
});
