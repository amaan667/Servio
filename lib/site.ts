export function siteOrigin(): string {
  const raw =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  // Trim whitespace/semicolons; strip trailing slashes
  return raw.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
}