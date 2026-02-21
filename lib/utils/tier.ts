/**
 * Tier normalization — single source of truth for subscription tier values.
 * NEVER overwrites valid DB values with "starter". Only returns "starter"
 * when the DB has no tier (null/empty) for new/unsubscribed venues.
 */

export type Tier = "starter" | "pro" | "enterprise";

const VALID_TIERS: Tier[] = ["starter", "pro", "enterprise"];

/**
 * Normalize raw tier from DB to canonical form.
 * Accepts: "pro", "Pro", "PRO", " pro ", "Pro Plan", "enterprise", etc.
 * Returns canonical tier or null when we have no mappable value.
 * NEVER returns "starter" when the DB has pro/enterprise.
 */
export function normalizeTierFromDb(raw: string | null | undefined): Tier | null {
  if (raw == null || raw === "") return null;
  const t = String(raw).toLowerCase().trim();
  if (t === "starter" || t === "pro" || t === "enterprise") return t;
  if (t.includes("enterprise")) return "enterprise";
  if (t.includes("pro")) return "pro";
  if (t.includes("starter")) return "starter";
  return null;
}

/**
 * Resolve tier from DB: use normalized value, or "starter" ONLY when
 * we have no tier (new venue, no subscription). Never overwrites pro/enterprise.
 */
export function resolveTierFromDb(raw: string | null | undefined): Tier {
  const normalized = normalizeTierFromDb(raw);
  return normalized ?? "starter";
}

export function isValidTier(tier: string): tier is Tier {
  return VALID_TIERS.includes(tier as Tier);
}
