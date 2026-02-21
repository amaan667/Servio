/**
 * Job Queue Infrastructure
 *
 * Three queues for heavy operations that MUST NOT run in request paths:
 *   1. pdf-processing — PDF→image conversion, AI menu extraction
 *   2. email — transactional emails (receipts, invitations, notifications)
 *   3. ai-tasks — KDS ticket creation, GPT vision calls, AI station assignment
 *
 * Workers process jobs with automatic retries and dead-letter handling.
 * If Redis is unavailable, jobs execute inline (dev-only; prod throws).
 */

import { Queue, Worker, type Job } from "bullmq";
import { env } from "@/lib/env";

// ─── Redis connection ───────────────────────────────────────────────
const getConnection = () => ({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}),
});

const connection = getConnection();

const isServer = typeof window === "undefined";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 * 7 }, // Keep failed jobs for 7 days (DLQ)
};

// ─── Queue Definitions ──────────────────────────────────────────────

export const pdfQueue = isServer
  ? new Queue("pdf-processing", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })
  : null;

export const emailQueue = isServer
  ? new Queue("email", { connection, defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 5 } })
  : null;

export const aiQueue = isServer
  ? new Queue("ai-tasks", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })
  : null;

// ─── Worker: PDF Processing ────────────────────────────────────────

export const pdfWorker = isServer
  ? new Worker(
      "pdf-processing",
      async (job: Job) => {
        const { pdfBytes, venueId } = job.data;
        const { convertPDFToImages } = await import("./pdf-to-images");
        const images = await convertPDFToImages(pdfBytes);
        return { success: true, images, imageCount: images.length, venueId };
      },
      { connection, concurrency: 2 }
    )
  : null;

// ─── Worker: Email ──────────────────────────────────────────────────

export const emailWorker = isServer
  ? new Worker(
      "email",
      async (job: Job) => {
        const { to, subject, html, text, from } = job.data;

        const resendKey = env("RESEND_API_KEY");
        if (!resendKey) {
          throw new Error("RESEND_API_KEY not configured");
        }

        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);

        const result = await resend.emails.send({
          from: from || "Servio <no-reply@servio.uk>",
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        });

        return { success: true, messageId: result.data?.id };
      },
      { connection, concurrency: 5 }
    )
  : null;

// ─── Worker: AI Tasks ───────────────────────────────────────────────

export const aiWorker = isServer
  ? new Worker(
      "ai-tasks",
      async (job: Job) => {
        switch (job.name) {
          case "create-kds-tickets": {
            const { orderId, venueId, items, customerName, tableNumber, tableId } = job.data;
            const { createKDSTicketsWithAI } = await import("./orders/kds-tickets-unified");
            const { createAdminClient } = await import("./supabase");
            const supabase = createAdminClient();
            await createKDSTicketsWithAI(supabase, {
              id: orderId,
              venue_id: venueId,
              items,
              customer_name: customerName,
              table_number: tableNumber,
              table_id: tableId,
            });
            return { success: true, orderId };
          }
          default:
            throw new Error(`Unknown AI job type: ${job.name}`);
        }
      },
      { connection, concurrency: 3 }
    )
  : null;

// ─── Enqueue Helpers ────────────────────────────────────────────────

export const jobHelpers = {
  /** Enqueue a PDF processing job */
  async addPdfJob(pdfBytes: ArrayBuffer, venueId: string, uploadId?: string) {
    if (!pdfQueue) return null;
    return pdfQueue.add("convert-pdf", { pdfBytes, venueId, uploadId });
  },

  /** Enqueue an email job */
  async addEmailJob(params: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }) {
    if (!emailQueue) {
      // Dev fallback: send inline
      const { Resend } = await import("resend");
      const resendKey = env("RESEND_API_KEY");
      if (!resendKey) return null;
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: params.from || "Servio <no-reply@servio.uk>",
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return null;
    }
    return emailQueue.add("send-email", params);
  },

  /** Enqueue a KDS ticket creation job */
  async addKDSTicketJob(params: {
    orderId: string;
    venueId: string;
    items: unknown[];
    customerName: string;
    tableNumber: number | null;
    tableId: string | null;
  }) {
    if (!aiQueue) return null;
    return aiQueue.add("create-kds-tickets", params);
  },

  /** Get job status */
  async getJobStatus(queueName: string, jobId: string) {
    const q = queueName === "email" ? emailQueue : queueName === "ai-tasks" ? aiQueue : pdfQueue;
    if (!q) return null;
    const job = await q.getJob(jobId);
    if (!job) return null;
    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
    };
  },

  /** Get stats for all queues */
  async getQueueStats() {
    const stats = async (q: Queue | null, name: string) => {
      if (!q) return { name, waiting: 0, active: 0, completed: 0, failed: 0 };
      return {
        name,
        waiting: await q.getWaitingCount(),
        active: await q.getActiveCount(),
        completed: await q.getCompletedCount(),
        failed: await q.getFailedCount(),
      };
    };
    return {
      pdf: await stats(pdfQueue, "pdf-processing"),
      email: await stats(emailQueue, "email"),
      ai: await stats(aiQueue, "ai-tasks"),
    };
  },
};
