 
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import SignInPage from "@/app/sign-in/page";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/app/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockPush = vi.fn();
const mockSignIn = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (useRouter as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
  });

  (useAuth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
    signIn: mockSignIn,
    signUp: vi.fn(),
    signOut: vi.fn(),
    user: null,
    loading: false,
  });
});

describe("Authentication Flow Integration", () => {
  it("should render sign-in form with all required fields", () => {
    render(<SignInPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("should handle successful sign-in", async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: "123" } }, error: null });

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should display error message on failed sign-in", async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("should validate email format", async () => {
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "invalid-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("should validate password requirements", async () => {
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "123" }, // Too short
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
    });
  });
});
