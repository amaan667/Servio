import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureSections } from "@/app/dashboard/[venueId]/components/FeatureSections";

describe("FeatureSections", () => {
  it("renders Payments tile in Operations section", () => {
    render(<FeatureSections venueId="venue-123" userRole="owner" />);

    expect(screen.getByText("All Features")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });
});
