// AI Job Status API
// Poll status of long-running AI jobs

import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/ai/job-processor";
import { logger } from "@/lib/logger";
import { apiErrors } from '@/lib/api/standard-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return apiErrors.badRequest('jobId is required');
    }

    logger.info(`[AI JOB STATUS] Checking status for job: ${jobId}`);

    const status = await getJobStatus(jobId);

    if (!status) {
      return apiErrors.notFound('Job not found');
    }

    return NextResponse.json({
      ok: true,
      job: {
        jobId: status.jobId,
        status: status.status,
        progress: status.progress,
        total: status.total,
        progressPercent: status.total > 0 ? Math.round((status.progress / status.total) * 100) : 0,
        result: status.result,
        error: status.error,
        isComplete: status.status === "completed" || status.status === "failed",
      },
    });
  } catch (error) {
    logger.error("[AI JOB STATUS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get job status" },
      { status: 500 }
    );
  }
}
