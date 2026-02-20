import { beforeEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

type SupabaseUser = { id: string; email?: string | null };

const getUserMock =
  vi.fn<
    (...args: unknown[]) => Promise<{ data: { user: SupabaseUser | null }; error: unknown | null }>
  >();
const refreshSessionMock =
  vi.fn<
    () => Promise<{
      data: { session: { user: SupabaseUser } | null };
      error: { message: string } | null;
    }>
  >();
const rpcMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      refreshSession: refreshSessionMock,
    },
    rpc: rpcMock,
  })),
}));

function makeRequest(
  pathname: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
  }
) {
  const url = new URL(`https://example.com${pathname}`);
  const method = options?.method || "GET";

  const cookiesStore = new Map<string, string>();
  const cookies = {
    get(name: string) {
      const value = cookiesStore.get(name);
      return value ? { value } : undefined;
    },
    getAll() {
      return [...cookiesStore.entries()].map(([name, value]) => ({ name, value }));
    },
    set(input: { name: string; value: string }) {
      cookiesStore.set(input.name, input.value);
    },
  };

  const headers = new Headers(options?.headers || {});
  headers.set("x-user-id", "spoof");
  headers.set("x-user-email", "spoof@example.com");

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    headers,
    cookies,
  };
}

describe("middleware security hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    refreshSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    rpcMock.mockResolvedValue({ data: null, error: { message: "not found" } });
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.CRON_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("denies unknown /api routes by default", async () => {
    const req = makeRequest("/api/not-a-real-route") as unknown as Parameters<typeof middleware>[0];
    const res = await middleware(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("ROUTE_NOT_IN_POLICY");
  });

  it("hard-fails system routes when internal secret is missing", async () => {
    const req = makeRequest("/api/cron/daily-reset", { method: "POST" }) as unknown as Parameters<
      typeof middleware
    >[0];
    const res = await middleware(req);
    expect(res.status).toBe(503);
  });

  it("requires system auth header for system routes", async () => {
    process.env.CRON_SECRET = "top-secret";

    const unauthReq = makeRequest("/api/cron/daily-reset", { method: "POST" }) as unknown as Parameters<
      typeof middleware
    >[0];
    const unauthRes = await middleware(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = makeRequest("/api/cron/daily-reset", {
      method: "POST",
      headers: { authorization: "Bearer top-secret" },
    }) as unknown as Parameters<typeof middleware>[0];
    const authRes = await middleware(authReq);
    expect(authRes.status).toBe(200);
  });

  it("returns 503 for protected API routes when Supabase env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = makeRequest("/api/inventory/stock/movements") as unknown as Parameters<
      typeof middleware
    >[0];
    const res = await middleware(req);
    expect(res.status).toBe(503);
  });

  it("returns 401 for protected API routes when user is unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    refreshSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "refresh_token_not_found" },
    });

    const req = makeRequest("/api/staff/list") as unknown as Parameters<typeof middleware>[0];
    const res = await middleware(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBeNull();
  });

  it("injects authenticated user headers and strips spoofed values", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "u@example.com" } },
      error: null,
    });

    const req = makeRequest("/api/auth/access-context") as unknown as Parameters<typeof middleware>[0];
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("user-123");
    expect(res.headers.get("x-middleware-request-x-user-email")).toBe("u@example.com");
    expect(res.headers.get("x-middleware-request-x-correlation-id")).toBeTruthy();
  });
});
