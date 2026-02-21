import { describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Keep env access simple for middleware tests; we toggle process.env per test.
vi.mock("@/lib/env", () => ({
  env: <K extends string>(key: K) => process.env[key],
}));

type SupabaseUser = { id: string; email?: string | null };

const getUserMock =
  vi.fn<() => Promise<{ data: { user: SupabaseUser | null }; error: unknown | null }>>();

const refreshSessionMock =
  vi.fn<() => Promise<{ data: { session: null }; error: { message: string } | null }>>();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      refreshSession: refreshSessionMock,
    },
  })),
}));

function makeRequest(pathname: string) {
  const url = new URL(`https://example.com${pathname}`);

  const cookiesStore = new Map<string, string>();
  const cookies = {
    get(name: string) {
      const value = cookiesStore.get(name);
      return value ? { value } : undefined;
    },
    set(input: { name: string; value: string }) {
      cookiesStore.set(input.name, input.value);
    },
  };

  const headers = new Headers();
  headers.set("x-user-id", "spoof");
  headers.set("x-user-email", "spoof@example.com");

  return {
    nextUrl: url,
    url: url.toString(),
    headers,
    cookies,
  };
}

describe("middleware (pilot hardening)", () => {
  it("returns 503 for protected API routes when Supabase env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = makeRequest("/api/inventory/stock/movements") as unknown as Parameters<
      typeof middleware
    >[0];

    const res = await middleware(req);
    expect(res.status).toBe(503);
  });

  it("passes through without x-user-* headers when user is unauthenticated", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    refreshSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "refresh_token_not_found" },
    });

    const req = makeRequest("/api/staff/list") as unknown as Parameters<typeof middleware>[0];
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBeNull();
  });

  it("injects x-user-* headers for authenticated protected API routes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "u@example.com" } },
      error: null,
    });

    const req = makeRequest("/api/inventory") as unknown as Parameters<typeof middleware>[0];
    const res = await middleware(req);

    // Next.js middleware uses special headers to pass request-header overrides downstream.
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("user-123");
    expect(res.headers.get("x-middleware-request-x-user-email")).toBe("u@example.com");
  });
});
