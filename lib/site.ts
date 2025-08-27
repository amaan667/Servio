export function siteOrigin(): string {
  // Prefer runtime origin; fall back to NEXT_PUBLIC_SITE_URL
  const raw =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "");

  // Normalize: trim whitespace, remove trailing slashes and stray punctuation
  return raw.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
}