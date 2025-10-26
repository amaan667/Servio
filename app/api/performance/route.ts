import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface PerformanceMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  userAgent: string;
  connection: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export async function POST(_request: NextRequest) {
  try {
    const metric: PerformanceMetric = await _request.json();

    // Log performance metric
    logger.info("[PERFORMANCE] Metric received:", {
      name: metric.name,
      value: metric.value,
      url: metric.url,
      connection: metric.connection,
      deviceMemory: metric.deviceMemory,
      hardwareConcurrency: metric.hardwareConcurrency,
    });

    // Store in database or send to analytics service
    // For now, we'll just log it
    // In production, you might want to store this in a database
    // or send it to a service like Google Analytics, Mixpanel, etc.

    // Example: Store in Supabase
    // const supabase = createServerSupabase();
    // await supabase.from('performance_metrics').insert({
    //   name: metric.name,
    //   value: metric.value,
    //   url: metric.url,
    //   user_agent: metric.userAgent,
    //   connection_type: metric.connection,
    //   device_memory: metric.deviceMemory,
    //   hardware_concurrency: metric.hardwareConcurrency,
    //   created_at: new Date().toISOString(),
    // });

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[PERFORMANCE] Error processing metric:", _error as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to process performance metric" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Performance monitoring endpoint",
    status: "active",
  });
}
