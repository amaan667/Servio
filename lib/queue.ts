/**
 * Job queue for background processing
 * Handles PDF conversion, image processing, and other heavy tasks
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import { convertPDFToImages } from "./pdf-to-images";
import { logger } from "./logger";

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// PDF Processing Queue (server-only)
export const pdfQueue =
  typeof window === "undefined"
    ? new Queue("pdf-processing", {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        },
      })
    : null;

// PDF Processing Worker (server-only)
export const pdfWorker =
  typeof window === "undefined"
    ? new Worker(
        "pdf-processing",
        async (job) => {
          const { pdfBytes, venueId, uploadId } = job.data;

          logger.info("PDF processing job started", {
            jobId: job.id,
            venueId,
            uploadId,
          });

          try {
            // Convert PDF to images
            const images = await convertPDFToImages(pdfBytes);

            logger.info("PDF processing job completed", {
              jobId: job.id,
              venueId,
              uploadId,
              imageCount: images.length,
            });

            return {
              success: true,
              images,
              imageCount: images.length,
            };
          } catch (_error) {
            logger.error("PDF processing job failed", {
              error: _error,
              jobId: job.id,
              venueId,
              uploadId,
            });
            throw _error;
          }
        },
        {
          connection,
          concurrency: 2, // Process 2 PDFs at a time
        }
      )
    : null;

// Queue events for monitoring (server-only)
export const pdfQueueEvents =
  typeof window === "undefined" ? new QueueEvents("pdf-processing", { connection }) : null;

if (pdfQueueEvents) {
  pdfQueueEvents.on("completed", ({ jobId, returnvalue }) => {
  });

  pdfQueueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error("PDF job failed", { error: new Error(failedReason), jobId });
  });
}

// Job status helpers
export const jobHelpers = {
  /**
   * Add PDF processing job
   */
  async addPdfJob(pdfBytes: ArrayBuffer, venueId: string, uploadId?: string) {
    if (!pdfQueue) {
      logger.warn("PDF queue not available");
      return null;
    }

    const job = await pdfQueue.add("convert-pdf", {
      pdfBytes,
      venueId,
      uploadId,
    });

    logger.info("PDF job added", {
      jobId: job.id,
      venueId,
      uploadId,
    });

    return job;
  },

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    if (!pdfQueue) return null;

    const job = await pdfQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;
    const returnvalue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state,
      progress,
      returnvalue,
      failedReason,
      timestamp: job.timestamp,
    };
  },

  /**
   * Cancel job
   */
  async cancelJob(jobId: string) {
    if (!pdfQueue) return false;

    const job = await pdfQueue.getJob(jobId);
    if (!job) return false;

    await job.remove();
    return true;
  },

  /**
   * Get queue stats
   */
  async getQueueStats() {
    if (!pdfQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    const waiting = await pdfQueue.getWaitingCount();
    const active = await pdfQueue.getActiveCount();
    const completed = await pdfQueue.getCompletedCount();
    const failed = await pdfQueue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  },
};
