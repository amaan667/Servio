import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to test logging
 * Call: GET /api/debug/logs
 * 
 * This endpoint tests if console.log statements are visible in Railway logs.
 * Visit: https://servio-production.up.railway.app/api/debug/logs
 */
export async function GET(req: NextRequest) {
  // Force output to stdout/stderr (Railway captures these)
  const timestamp = new Date().toISOString();
  
  // Test different logging methods - Railway should capture all of these
  console.log(`[${timestamp}] [DEBUG LOGS] ✅ console.log works`);
  console.error(`[${timestamp}] [DEBUG LOGS] ✅ console.error works`);
  console.warn(`[${timestamp}] [DEBUG LOGS] ✅ console.warn works`);
  console.info(`[${timestamp}] [DEBUG LOGS] ✅ console.info works`);
  
  // Also write directly to stdout (Railway definitely captures this)
  process.stdout.write(`[${timestamp}] [DEBUG LOGS] ✅ process.stdout.write works\n`);
  process.stderr.write(`[${timestamp}] [DEBUG LOGS] ✅ process.stderr.write works\n`);
  
  // Test with structured data
  const logData = {
    timestamp,
    url: req.url,
    method: req.method,
    headers: {
      "x-user-id": req.headers.get("x-user-id") || "not set",
      "user-agent": req.headers.get("user-agent")?.substring(0, 50) || "not set",
    },
  };
  
  console.log(`[${timestamp}] [DEBUG LOGS] Test object:`, JSON.stringify(logData, null, 2));
  
  return NextResponse.json({
    success: true,
    message: "Logs sent to console. Check Railway logs.",
    timestamp,
    logMethods: [
      "console.log",
      "console.error", 
      "console.warn",
      "console.info",
      "process.stdout.write",
      "process.stderr.write",
    ],
    note: "All log statements should appear in Railway logs. Check Railway dashboard or run 'railway logs'",
    instructions: [
      "1. Visit Railway dashboard: https://railway.app",
      "2. Go to your project → Deployments → Latest → View Logs",
      "3. Or run: railway logs",
      "4. Look for [DEBUG LOGS] entries",
    ],
  });
}

