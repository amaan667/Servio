import { describe, it, expect } from "vitest";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase";

describe("Supabase Configuration", () => {
  describe("getSupabaseUrl", () => {
    it("should return Supabase URL from env", () => {
      const url = getSupabaseUrl();
      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
    });
  });

  describe("getSupabaseAnonKey", () => {
    it("should return Supabase anon key from env", () => {
      const key = getSupabaseAnonKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe("string");
    });
  });
});
