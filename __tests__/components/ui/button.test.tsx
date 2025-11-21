/**
 * @fileoverview Tests for Button component
 * @module __tests__/components/ui/button
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("should render button with default variant", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("should render button with servio variant", () => {
    render(<Button variant="servio">Servio Button</Button>);
    const button = screen.getByRole("button", { name: /servio button/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-servio-purple", "text-white");
    expect(button).toHaveClass("hover:bg-white", "hover:text-servio-purple");
  });

  it("should render button with destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: /delete/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-red-600", "text-white");
  });

  it("should handle click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole("button", { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it("should render with different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let button = screen.getByRole("button", { name: /small/i });
    expect(button).toHaveClass("h-9");

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole("button", { name: /large/i });
    expect(button).toHaveClass("h-11");

    rerender(<Button size="icon">Icon</Button>);
    button = screen.getByRole("button", { name: /icon/i });
    expect(button).toHaveClass("h-10", "w-10");
  });

  it("should apply custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button", { name: /custom/i });
    expect(button).toHaveClass("custom-class");
  });

  it("should have touch-manipulation for mobile", () => {
    render(<Button>Touch Button</Button>);
    const button = screen.getByRole("button", { name: /touch button/i });
    expect(button).toHaveClass("touch-manipulation");
  });

  it("should have active scale animation", () => {
    render(<Button>Animated</Button>);
    const button = screen.getByRole("button", { name: /animated/i });
    expect(button).toHaveClass("active:scale-[0.97]");
  });

  it("should have will-change-transform for performance", () => {
    render(<Button>Optimized</Button>);
    const button = screen.getByRole("button", { name: /optimized/i });
    expect(button).toHaveClass("will-change-transform");
  });

  it("should meet minimum touch target size (44x44px)", () => {
    render(<Button>Touch Target</Button>);
    const button = screen.getByRole("button", { name: /touch target/i });
    expect(button).toHaveClass("min-h-[44px]", "min-w-[44px]");
  });

  it("should render as child component when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });
});
