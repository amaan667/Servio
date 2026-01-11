/**
 * Job queue for background processing
 * Handles PDF conversion, image processing, and other heavy tasks
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import { convertPDFToImages } from "./pdf-to-images";

// Redis connection for BullMQ
const connection = {

};

// PDF Processing Queue (server-only)
export const pdfQueue =
  typeof window === "undefined"
    ? new Queue("pdf-processing", {
        connection,

          },

            age: 3600, // Keep completed jobs for 1 hour
          },

            age: 86400, // Keep failed jobs for 24 hours
          },
        },

        async (job) => {
          const { pdfBytes, venueId, uploadId } = job.data;

          

          try {
            // Convert PDF to images
            const images = await convertPDFToImages(pdfBytes);

            

            return {

              images,

            };
          } catch (_error) {
            
            throw _error;
          }
        },
        {
          connection,
          concurrency: 2, // Process 2 PDFs at a time
        }
      )

  typeof window === "undefined" ? new QueueEvents("pdf-processing", { connection }) : null;

if (pdfQueueEvents) {
  pdfQueueEvents.on("completed", ({ jobId: _jobId, returnvalue: _returnvalue }) => {
    // Job completed event handled

  pdfQueueEvents.on("failed", ({ jobId, failedReason }) => {
    , jobId });

}

// Job status helpers
export const jobHelpers = {
  /**
   * Add PDF processing job
   */
  async addPdfJob(pdfBytes: ArrayBuffer, venueId: string, uploadId?: string) {
    if (!pdfQueue) {
      
      return null;
    }

    const job = await pdfQueue.add("convert-pdf", {
      pdfBytes,
      venueId,
      uploadId,

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

      state,
      progress,
      returnvalue,
      failedReason,

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

    };
  },
};
