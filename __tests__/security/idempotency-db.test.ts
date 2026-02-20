import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredRecord = {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response_data: unknown;
  status_code: number;
  created_at: string;
  expires_at: string;
};

const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

function makeSupabaseClient(store: Map<string, StoredRecord>) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "idempotency_keys") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: vi.fn(async (row: Omit<StoredRecord, "id" | "created_at">) => {
          if (store.has(row.idempotency_key)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }

          const record: StoredRecord = {
            ...row,
            id: `id-${store.size + 1}`,
            created_at: new Date().toISOString(),
          };
          store.set(record.idempotency_key, record);
          return { data: [record], error: null };
        }),
        select: vi.fn(() => ({
          eq: vi.fn((_column: string, key: string) => ({
            single: vi.fn(async () => {
              const row = store.get(key);
              if (!row) {
                return { data: null, error: { code: "PGRST116", message: "not found" } };
              }
              return { data: row, error: null };
            }),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((_column: string, key: string) => ({
            lt: vi.fn(async () => {
              store.delete(key);
              return { error: null };
            }),
          })),
        })),
        update: vi.fn((updates: Partial<StoredRecord>) => ({
          eq: vi.fn((_column: string, key: string) => ({
            select: vi.fn(async () => {
              const existing = store.get(key);
              if (!existing) {
                return { data: [], error: null };
              }
              const updated: StoredRecord = { ...existing, ...updates };
              store.set(key, updated);
              return { data: [{ id: updated.id }], error: null };
            }),
          })),
        })),
      };
    }),
  };
}

describe("db idempotency atomic behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns in_progress for concurrent duplicate claims", async () => {
    const store = new Map<string, StoredRecord>();
    createAdminClientMock.mockReturnValue(makeSupabaseClient(store));

    const { claimIdempotencyKey } = await import("@/lib/db/idempotency");

    const first = await claimIdempotencyKey("key-1", "hash-a");
    const second = await claimIdempotencyKey("key-1", "hash-a");

    expect(first.status).toBe("acquired");
    expect(second.status).toBe("in_progress");
  });

  it("returns cached response after idempotency is finalized", async () => {
    const store = new Map<string, StoredRecord>();
    createAdminClientMock.mockReturnValue(makeSupabaseClient(store));

    const { claimIdempotencyKey, storeIdempotency } = await import("@/lib/db/idempotency");

    const first = await claimIdempotencyKey("key-2", "hash-b");
    expect(first.status).toBe("acquired");

    await storeIdempotency("key-2", "hash-b", { ok: true, orderId: "ord-1" }, 201);

    const cached = await claimIdempotencyKey("key-2", "hash-b");
    expect(cached.status).toBe("cached");
    if (cached.status === "cached") {
      expect(cached.response.status_code).toBe(201);
      expect(cached.response.response_data).toEqual({ ok: true, orderId: "ord-1" });
    }
  });

  it("returns hash_mismatch when the same key is reused for a different payload", async () => {
    const store = new Map<string, StoredRecord>();
    createAdminClientMock.mockReturnValue(makeSupabaseClient(store));

    const { claimIdempotencyKey, storeIdempotency } = await import("@/lib/db/idempotency");

    const first = await claimIdempotencyKey("key-3", "hash-c");
    expect(first.status).toBe("acquired");
    await storeIdempotency("key-3", "hash-c", { ok: true }, 200);

    const mismatch = await claimIdempotencyKey("key-3", "hash-other");
    expect(mismatch.status).toBe("hash_mismatch");
  });

  it("stores idempotency response even when no in-progress claim row exists", async () => {
    const store = new Map<string, StoredRecord>();
    createAdminClientMock.mockReturnValue(makeSupabaseClient(store));

    const { storeIdempotency, claimIdempotencyKey } = await import("@/lib/db/idempotency");

    await storeIdempotency("key-fresh", "hash-fresh", { ok: true }, 200);
    expect(store.has("key-fresh")).toBe(true);

    const cached = await claimIdempotencyKey("key-fresh", "hash-fresh");
    expect(cached.status).toBe("cached");
  });
});

