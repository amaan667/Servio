// Minimal status endpoint - no imports, no dependencies
// Healthcheck for Railway deployment - connected
export async function GET() {
  return new Response("OK", { status: 200 });
}
