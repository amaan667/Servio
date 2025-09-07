// Minimal status endpoint - no imports, no dependencies
export async function GET() {
  return new Response('OK', { status: 200 });
}
