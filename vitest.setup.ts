import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Ref for createSupabaseClient mock chain (tests can set (globalThis as any).__supabaseQueryResult)
(globalThis as unknown as { __supabaseQueryResult?: { data: unknown; error: unknown } }).__supabaseQueryResult = {
  data: [],
  error: null,
};

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  const getResult = () => (globalThis as unknown as { __supabaseQueryResult: { data: unknown; error: unknown } }).__supabaseQueryResult ?? { data: [], error: null };
  const chain: Record<string, unknown> = {
    then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(getResult()).then(onFulfilled);
    },
    from() {
      return chain;
    },
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    gte() {
      return chain;
    },
    lte() {
      return chain;
    },
    in() {
      return chain;
    },
    single() {
      return Promise.resolve(getResult());
    },
    maybeSingle() {
      return Promise.resolve(getResult());
    },
    update() {
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({ single: () => Promise.resolve(getResult()) }),
          }),
        }),
      };
    },
    insert() {
      return { select: () => chain };
    },
    rpc() {
      return Promise.resolve(getResult());
    },
  };
  const supabaseClient = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    single: () => Promise.resolve(getResult()),
    maybeSingle: () => Promise.resolve(getResult()),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: () => ({ single: () => Promise.resolve(getResult()) }),
        }),
      }),
    }),
    insert: () => ({
      select: () => ({ single: () => Promise.resolve(getResult()) }),
    }),
    rpc: () => Promise.resolve(getResult()),
  };
  // Shared admin/browser client shape: .from() returns chain so .from().select().in().eq() etc. work
  const adminClient = {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    from: () => chain,
  };
  const browserClient = {
    ...adminClient,
    auth: {
      ...adminClient.auth,
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  };

  // Use plain functions for createClient/createAdminClient/supabaseAdmin so mockReset doesn't clear them (routes get 500 otherwise)
  return {
    createSupabaseClient: vi.fn(() => Promise.resolve(supabaseClient)),
    __getSupabaseChainForTests: () => supabaseClient,
    createClient: () => adminClient,
    createAdminClient: () => adminClient,
    supabaseAdmin: () => adminClient,
    supabaseBrowser: () => browserClient,
    supabaseServer: () => adminClient,
    getSupabaseUrl: () => "https://test.supabase.co",
    getSupabaseAnonKey: () => "test-anon-key",
  };
});

// Suppress console errors in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock ResizeObserver for dashboard/chart tests
global.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {
    // Mock constructor
  }
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
};

// Mock window.matchMedia for use-mobile hook
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.innerWidth and innerHeight
Object.defineProperty(window, "innerWidth", {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, "innerHeight", {
  writable: true,
  configurable: true,
  value: 768,
});

// Mock environment variables for tests
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_for_testing";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-mock-openai-key-for-testing";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key";
