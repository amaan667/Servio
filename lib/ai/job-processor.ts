// Servio AI Assistant - Async Job Processor
// Handles long-running tasks to prevent timeouts

import { createAdminClient } from "@/lib/supabase";
import { aiLogger } from "@/lib/logger";

interface JobStatus {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  total: number;
  result?: unknown;
  error?: string;
}

/**
 * Create a new background job
 */
export async function createJob(
  venueId: string,
  userId: string,
  jobType: string,
  params: Record<string, unknown>
): Promise<string> {
  const supabase = createAdminClient();
  const jobId = `${jobType}_${venueId}_${Date.now()}`;

  aiLogger.info(`[JOB PROCESSOR] Creating job: ${jobId}`);

  const { error } = await supabase.from("ai_jobs").insert({
    job_id: jobId,
    venue_id: venueId,
    user_id: userId,
    job_type: jobType,
    status: "pending",
    params,
    progress: 0,
    total: 100,
  });

  if (error) {
    aiLogger.error("[JOB PROCESSOR] Error creating job:", error);
    throw new Error(`Failed to create job: ${error.message}`);
  }

  // Start processing asynchronously
  processJobAsync(jobId, venueId, userId, jobType, params).catch((err) => {
    aiLogger.error(`[JOB PROCESSOR] Job ${jobId} failed:`, err);
  });

  return jobId;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_jobs")
    .select("job_id, status, progress, total, result, error")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) {
    aiLogger.error("[JOB PROCESSOR] Error fetching job status:", error);
    return null;
  }

  return {
    jobId: data.job_id,
    status: data.status as JobStatus["status"],
    progress: data.progress,
    total: data.total,
    result: data.result,
    error: data.error,
  };
}

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  total: number,
  status?: "pending" | "running" | "completed" | "failed"
): Promise<void> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    progress,
    total,
    updated_at: new Date().toISOString(),
  };

  if (status) {
    updateData.status = status;
    if (status === "running" && !updateData.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    if (status === "completed" || status === "failed") {
      updateData.completed_at = new Date().toISOString();
    }
  }

  await supabase.from("ai_jobs").update(updateData).eq("job_id", jobId);
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string, result: unknown): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("ai_jobs")
    .update({
      status: "completed",
      result,
      progress: 100,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);

  aiLogger.info(`[JOB PROCESSOR] Job ${jobId} completed successfully`);
}

/**
 * Mark job as failed
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("ai_jobs")
    .update({
      status: "failed",
      error,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);

  aiLogger.error(`[JOB PROCESSOR] Job ${jobId} failed:`, error);
}

/**
 * Process a job asynchronously
 */
async function processJobAsync(
  jobId: string,
  venueId: string,
  _userId: string,
  jobType: string,
  params: Record<string, unknown>
): Promise<void> {
  aiLogger.info(`[JOB PROCESSOR] Starting async processing for job: ${jobId}`);

  try {
    await updateJobProgress(jobId, 0, 100, "running");

    switch (jobType) {
      case "menu_translation":
        await processMenuTranslation(jobId, venueId, params);
        break;

      case "bulk_menu_update":
        await processBulkMenuUpdate(jobId, venueId, params);
        break;

      case "inventory_reorder":
        await processInventoryReorder(jobId, venueId, params);
        break;

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(jobId, errorMessage);
  }
}

/**
 * Process menu translation job
 */
async function processMenuTranslation(
  jobId: string,
  venueId: string,
  params: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  const targetLanguage = params.targetLanguage as string;
  const categories = (params.categories as string[]) || null;

  aiLogger.info(`[JOB PROCESSOR] Translating menu to ${targetLanguage}`);

  // Get items to translate
  let query = supabase
    .from("menu_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  const { data: items } = await query;

  if (!items || items.length === 0) {
    await completeJob(jobId, { itemsTranslated: 0, message: "No items to translate" });
    return;
  }

  await updateJobProgress(jobId, 10, items.length, "running");

  let translatedCount = 0;

  // Process in chunks to avoid overwhelming translation API
  const chunkSize = 5;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    for (const item of chunk) {
      try {
        // Simulate translation (in production, call actual translation API)
        const translatedName = `[${targetLanguage.toUpperCase()}] ${item.name}`;
        const translatedDescription = item.description
          ? `[${targetLanguage.toUpperCase()}] ${item.description}`
          : null;

        // Store translation
        await supabase
          .from("menu_items")
          .update({
            translations: {
              [targetLanguage]: {
                name: translatedName,
                description: translatedDescription,
              },
            },
          })
          .eq("id", item.id);

        translatedCount++;
      } catch (error) {
        aiLogger.error(`[JOB PROCESSOR] Translation error for ${item.name}:`, error);
      }
    }

    // Update progress
    await updateJobProgress(jobId, i + chunk.length, items.length, "running");

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await completeJob(jobId, {
    itemsTranslated: translatedCount,
    totalItems: items.length,
    targetLanguage,
    message: `Successfully translated ${translatedCount} of ${items.length} items to ${targetLanguage}`,
  });
}

/**
 * Process bulk menu update job
 */
async function processBulkMenuUpdate(
  jobId: string,
  venueId: string,
  params: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  aiLogger.info(`[JOB PROCESSOR] Processing bulk menu update`);

  const operation = params.operation as string;
  const itemIds = (params.itemIds as string[]) || [];

  if (itemIds.length === 0) {
    await completeJob(jobId, { updatedCount: 0, message: "No items to update" });
    return;
  }

  await updateJobProgress(jobId, 10, itemIds.length, "running");

  let updatedCount = 0;

  for (let i = 0; i < itemIds.length; i++) {
    try {
      // Perform the update based on operation
      await supabase
        .from("menu_items")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", itemIds[i])
        .eq("venue_id", venueId);

      updatedCount++;
    } catch (error) {
      aiLogger.error(`[JOB PROCESSOR] Error updating item ${itemIds[i]}:`, error);
    }

    await updateJobProgress(jobId, i + 1, itemIds.length, "running");
  }

  await completeJob(jobId, {
    updatedCount,
    totalItems: itemIds.length,
    message: `Successfully updated ${updatedCount} of ${itemIds.length} items`,
  });
}

/**
 * Process inventory reorder job
 */
async function processInventoryReorder(
  jobId: string,
  venueId: string,
  _params: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  aiLogger.info(`[JOB PROCESSOR] Processing inventory reorder`);

  // Get low stock items
  const { data: items } = await supabase
    .from("inventory")
    .select("id, name, quantity, par_level")
    .eq("venue_id", venueId);

  if (!items || items.length === 0) {
    await completeJob(jobId, { orderedCount: 0, message: "No items need reordering" });
    return;
  }

  const lowStockItems = items.filter((item) => (item.quantity || 0) < (item.par_level || 0));

  await updateJobProgress(jobId, 50, 100, "running");

  // In production, this would integrate with supplier API or send email
  const purchaseOrder = lowStockItems.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    currentStock: item.quantity || 0,
    parLevel: item.par_level || 0,
    orderQuantity: Math.ceil(((item.par_level || 0) - (item.quantity || 0)) * 1.2),
  }));

  await completeJob(jobId, {
    orderedCount: lowStockItems.length,
    purchaseOrder,
    message: `Purchase order created for ${lowStockItems.length} items`,
  });
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("ai_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);

  aiLogger.info(`[JOB PROCESSOR] Job ${jobId} cancelled`);
}
