/**
 * Bulk Operations Background Queue
 *
 * Background job queue integration for bulk operations with:
 * - Progress tracking
 * - Notification on completion
 * - Retry logic for failed operations
 */

import type { BulkOperationType, BulkOperationResult } from "./types";

// Job status enum
export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETRYING = "retrying",
}

// Job interface
export interface BulkOperationJob {
  id: string;
  venueId: string;
  operationType: BulkOperationType;
  entityType: string;
  status: JobStatus;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  errors: Array<{ index: number; error: string }>;
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

// Queue configuration
export interface QueueConfig {
  maxConcurrentJobs: number;
  maxRetries: number;
  retryDelayMs: number;
}

// Default queue configuration
export const defaultQueueConfig: QueueConfig = {
  maxConcurrentJobs: 3,
  maxRetries: 3,
  retryDelayMs: 5000,
};

// In-memory job store (replace with Redis/database in production)
const jobStore = new Map<string, BulkOperationJob>();

// Active jobs counter
let activeJobs = 0;

// Notification callbacks
const completionCallbacks = new Map<string, (job: BulkOperationJob) => void>();
const progressCallbacks = new Map<string, (progress: { jobId: string; processed: number; total: number; percentage: number; status: string }) => void>();

/**
 * Create a new bulk operation job
 */
export function createJob(
  venueId: string,
  operationType: BulkOperationType,
  entityType: string,
  totalItems: number
): BulkOperationJob {
  const job: BulkOperationJob = {
    id: generateJobId(),
    venueId,
    operationType,
    entityType,
    status: JobStatus.PENDING,
    totalItems,
    processedItems: 0,
    successfulItems: 0,
    failedItems: 0,
    errors: [],
    progress: 0,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    maxRetries: defaultQueueConfig.maxRetries,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobStore.set(job.id, job);
  return job;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): BulkOperationJob | undefined {
  return jobStore.get(jobId);
}

/**
 * Get all jobs for a venue
 */
export function getJobsByVenue(venueId: string): BulkOperationJob[] {
  return Array.from(jobStore.values()).filter((job) => job.venueId === venueId);
}

/**
 * Get active jobs count
 */
export function getActiveJobsCount(): number {
  return activeJobs;
}

/**
 * Register a completion callback
 */
export function onJobComplete(
  jobId: string,
  callback: (job: BulkOperationJob) => void
): () => void {
  completionCallbacks.set(jobId, callback);
  return () => completionCallbacks.delete(jobId);
}

/**
 * Register a progress callback
 */
export function onJobProgress(
  jobId: string,
  callback: (progress: { jobId: string; processed: number; total: number; percentage: number; status: string }) => void
): () => void {
  progressCallbacks.set(jobId, callback);
  return () => progressCallbacks.delete(jobId);
}

/**
 * Start processing a job
 */
export async function startJob(jobId: string): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.PROCESSING) {
    return;
  }

  // Wait if too many active jobs
  while (activeJobs >= defaultQueueConfig.maxConcurrentJobs) {
    await sleep(100);
  }

  activeJobs++;
  job.status = JobStatus.PROCESSING;
  job.startedAt = new Date();
  job.updatedAt = new Date();
  jobStore.set(jobId, job);

  // Notify progress
  notifyProgress(jobId, {
    jobId,
    processed: job.processedItems,
    total: job.totalItems,
    percentage: job.progress,
    status: "processing",
  });
}

/**
 * Update job progress
 */
export function updateJobProgress(
  jobId: string,
  processed: number,
  successful: number,
  failed: number,
  errors?: Array<{ index: number; error: string }>
): void {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.processedItems = processed;
  job.successfulItems = successful;
  job.failedItems = failed;
  job.progress = Math.round((processed / job.totalItems) * 100);
  job.updatedAt = new Date();

  if (errors && errors.length > 0) {
    job.errors = [...job.errors, ...errors];
  }

  jobStore.set(jobId, job);

  // Notify progress
  notifyProgress(jobId, {
    jobId,
    processed,
    total: job.totalItems,
    percentage: job.progress,
    status: job.progress < 100 ? "processing" : "completed",
  });
}

/**
 * Complete a job
 */
export function completeJob(
  jobId: string,
  _result: BulkOperationResult
): void {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = JobStatus.COMPLETED;
  job.completedAt = new Date();
  job.updatedAt = new Date();
  jobStore.set(jobId, job);

  activeJobs--;

  // Notify completion
  const callback = completionCallbacks.get(jobId);
  if (callback) {
    callback(job);
  }

  // Cleanup callbacks
  completionCallbacks.delete(jobId);
  progressCallbacks.delete(jobId);
}

/**
 * Fail a job
 */
export function failJob(jobId: string, error: string): void {
  const job = jobStore.get(jobId);
  if (!job) return;

  if (job.retryCount < job.maxRetries) {
    job.status = JobStatus.RETRYING;
    job.retryCount++;
    job.updatedAt = new Date();
    jobStore.set(jobId, job);

    // Schedule retry
    setTimeout(() => {
      startJob(jobId).catch((err) => {
        failJob(jobId, err.message);
      });
    }, defaultQueueConfig.retryDelayMs);
  } else {
    job.status = JobStatus.FAILED;
    job.errors.push({ index: -1, error });
    job.completedAt = new Date();
    job.updatedAt = new Date();
    jobStore.set(jobId, job);

    activeJobs--;

    // Notify completion
    const callback = completionCallbacks.get(jobId);
    if (callback) {
      callback(job);
    }

    completionCallbacks.delete(jobId);
    progressCallbacks.delete(jobId);
  }
}

/**
 * Cancel a job
 */
export function cancelJob(jobId: string): void {
  const job = jobStore.get(jobId);
  if (!job) return;

  if (job.status === JobStatus.PROCESSING) {
    activeJobs--;
  }

  job.status = JobStatus.CANCELLED;
  job.completedAt = new Date();
  job.updatedAt = new Date();
  jobStore.set(jobId, job);

  completionCallbacks.delete(jobId);
  progressCallbacks.delete(jobId);
}

/**
 * Process a bulk operation with queue support
 */
export async function processWithQueue(
  venueId: string,
  operationType: BulkOperationType,
  entityType: string,
  items: unknown[],
  processor: (
    item: unknown,
    index: number,
    onProgress: (update: { success: boolean; error?: string }) => void
  ) => Promise<{ success: boolean; error?: string }>,
  config?: {
    batchSize?: number;
    delayMs?: number;
    skipMissingOnUpdate?: boolean;
    skipInvalidOnDelete?: boolean;
    continueOnError?: boolean;
    progressCallback?: (update: { jobId: string; processed: number; total: number; percentage: number; status: string }) => void;
    rollbackOnFailure?: boolean;
  }
): Promise<BulkOperationJob> {
  const batchSize = config?.batchSize ?? 50;
  const delayMs = config?.delayMs ?? 100;

  const job = createJob(venueId, operationType, entityType, items.length);

  await startJob(job.id);

  let processed = 0;
  let successful = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];

  try {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchStartIndex = i;

      // Process batch
      const results = await Promise.all(
        batch.map((item, batchIndex) =>
          processor(item, batchStartIndex + batchIndex, (update) => {
            const currentProcessed = processed + batchIndex + 1;
            const currentSuccessful = successful + (update.success ? 1 : 0);
            const currentFailed = failed + (update.success ? 0 : 1);

            updateJobProgress(job.id, currentProcessed, currentSuccessful, currentFailed);

            if (!update.success) {
              errors.push({
                index: batchStartIndex + batchIndex,
                error: update.error || "Unknown error",
              });
            }
          })
        )
      );

      // Update counts
      for (const result of results) {
        processed++;
        if (result.success) {
          successful++;
        } else {
          failed++;
          errors.push({ index: processed - 1, error: result.error || "Unknown error" });
        }
      }

      // Check for cancellation
      const currentJob = jobStore.get(job.id);
      if (currentJob?.status === JobStatus.CANCELLED) {
        break;
      }

      // Delay between batches
      if (i + batchSize < items.length) {
        await sleep(delayMs);
      }
    }

    // Complete the job
    completeJob(job.id, {
      operationId: job.id,
      type: operationType,
      entityType,
      total: processed,
      successful,
      failed,
      skipped: 0,
      results: [],
      validationErrors: [],
      status: "completed",
      elapsedMs: job.completedAt ? job.completedAt.getTime() - job.startedAt!.getTime() : 0,
      warnings: [],
    });
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
  }

  return job;
}

/**
 * Get job statistics
 */
export function getJobStatistics(): {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
} {
  const jobs = Array.from(jobStore.values());

  return {
    totalJobs: jobs.length,
    activeJobs: jobs.filter((j) => j.status === JobStatus.PROCESSING).length,
    completedJobs: jobs.filter((j) => j.status === JobStatus.COMPLETED).length,
    failedJobs: jobs.filter((j) => j.status === JobStatus.FAILED).length,
    pendingJobs: jobs.filter(
      (j) => j.status === JobStatus.PENDING || j.status === JobStatus.RETRYING
    ).length,
  };
}

/**
 * Cleanup old completed jobs
 */
export function cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const cutoff = new Date(Date.now() - maxAgeMs);
  let cleaned = 0;

  for (const [jobId, job] of jobStore.entries()) {
    if (
      job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED ||
      job.status === JobStatus.CANCELLED
    ) {
      if (job.completedAt && job.completedAt < cutoff) {
        jobStore.delete(jobId);
        completionCallbacks.delete(jobId);
        progressCallbacks.delete(jobId);
        cleaned++;
      }
    }
  }

  return cleaned;
}

// Helper functions
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notifyProgress(
  jobId: string,
  progress: { jobId: string; processed: number; total: number; percentage: number; status: string }
): void {
  const callback = progressCallbacks.get(jobId);
  if (callback) {
    callback(progress);
  }
}
