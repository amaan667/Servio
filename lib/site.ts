export function siteOrigin(): string {
  console.log('[AUTH DEBUG] ===== SITE ORIGIN DETERMINATION =====');
  console.log('[AUTH DEBUG] Timestamp:', new Date().toISOString());
  
  // Prefer runtime origin; fall back to NEXT_PUBLIC_SITE_URL
  const raw =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "");

  console.log('[AUTH DEBUG] Raw origin values:');
  console.log('[AUTH DEBUG] - typeof window:', typeof window);
  console.log('[AUTH DEBUG] - window.location.origin:', typeof window !== "undefined" ? window.location.origin : 'N/A');
  console.log('[AUTH DEBUG] - NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[AUTH DEBUG] - Raw value:', raw);

  // Normalize: trim whitespace, remove trailing slashes and stray punctuation
  // Ensure it matches exactly https://servio-production.up.railway.app
  const normalized = raw.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
  
  console.log('[AUTH DEBUG] Normalization:');
  console.log('[AUTH DEBUG] - Normalized value:', normalized);
  
  // In production, force the exact Railway URL
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = 'https://servio-production.up.railway.app';
    console.log('[AUTH DEBUG] Production environment detected:');
    console.log('[AUTH DEBUG] - NODE_ENV:', process.env.NODE_ENV);
    console.log('[AUTH DEBUG] - Forcing production URL:', productionUrl);
    console.log('[AUTH DEBUG] ✅ Returning production URL');
    return productionUrl;
  }
  
  console.log('[AUTH DEBUG] Non-production environment:');
  console.log('[AUTH DEBUG] - NODE_ENV:', process.env.NODE_ENV);
  console.log('[AUTH DEBUG] ✅ Returning normalized URL');
  return normalized;
}