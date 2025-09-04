// Global route segment configuration to prevent static generation errors
// This ensures all routes are rendered dynamically when they use cookies or authentication

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const preferredRegion = 'auto';
