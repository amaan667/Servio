// Minimal status endpoint - no imports, no dependencies
// Healthcheck for Railway deployment
export async function GET() {
  return new Response('OK', { status: 200 });
}
