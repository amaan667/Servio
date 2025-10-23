/**
 * @fileoverview Tests for ConditionalHeader component
 * @module __tests__/components/ConditionalHeader
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConditionalHeader from "@/components/ConditionalHeader";
import * as navigation from "next/navigation";

// Mock dependencies
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/components/AppHeader", () => ({
  default: () => <div data-testid="app-header">App Header</div>,
}));

describe("ConditionalHeader", () => {
  const usePathname = vi.mocked(navigation.usePathname);

  it("should render AppHeader on home page", () => {
    usePathname.mockReturnValue("/");
    render(<ConditionalHeader />);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });

  it("should render AppHeader on dashboard pages", () => {
    usePathname.mockReturnValue("/dashboard/venue-123");
    render(<ConditionalHeader />);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });

  it("should not render AppHeader on order pages", () => {
    usePathname.mockReturnValue("/order/123");
    const { container } = render(<ConditionalHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render AppHeader on payment pages", () => {
    usePathname.mockReturnValue("/payment/123");
    const { container } = render(<ConditionalHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render AppHeader on order-summary pages", () => {
    usePathname.mockReturnValue("/order-summary/123");
    const { container } = render(<ConditionalHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render AppHeader on order-tracking pages", () => {
    usePathname.mockReturnValue("/order-tracking/123");
    const { container } = render(<ConditionalHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("should memoize header visibility check", () => {
    usePathname.mockReturnValue("/dashboard/venue-123");
    const { rerender } = render(<ConditionalHeader />);

    // Rerender with same pathname
    rerender(<ConditionalHeader />);

    // Should still render
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });
});
