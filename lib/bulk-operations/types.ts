/**
 * Bulk Operations Types
 *
 * Comprehensive type definitions for bulk operations including
 * batch processing, progress tracking, and operation status.
 */

/**
 * Bulk operation types
 */
export type BulkOperationType =
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete"
  | "bulk_import"
  | "bulk_export";

/**
 * Operation status
 */
export type BulkOperationStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "partial_success";

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Maximum items per batch */
  batchSize: number;
  /** Delay between batches in milliseconds */
  batchDelay: number;
  /** Maximum concurrent operations */
  maxConcurrency: number;
  /** Enable automatic retry on failure */
  retryEnabled: boolean;
  /** Maximum retry attempts per item */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
}

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  batchDelay: 100,
  maxConcurrency: 5,
  retryEnabled: true,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Validation error types
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Value that failed validation */
  value?: unknown;
  /** Row number (for imports) */
  row?: number;
}

export interface ValidationResult<T = Record<string, unknown>> {
  /** Whether the item is valid */
  isValid: boolean;
  /** The validated data */
  data?: T;
  /** Validation errors */
  errors: ValidationError[];
}

/**
 * Progress tracking types
 */
export interface ProgressUpdate {
  /** Current operation ID */
  operationId: string;
  /** Total items to process */
  total: number;
  /** Successfully processed items */
  completed: number;
  /** Failed items */
  failed: number;
  /** Currently processing item index */
  currentIndex: number;
  /** Current operation description */
  currentOperation: string;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Estimated remaining time in milliseconds */
  estimatedRemainingMs?: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Items per second processing rate */
  ratePerSecond: number;
}

export interface ProgressCallback {
  (update: ProgressUpdate): void | Promise<void>;
}

/**
 * Bulk operation item result
 */
export interface BulkOperationItemResult<T = unknown> {
  /** Item identifier */
  id?: string;
  /** Row number (for imports) */
  row?: number;
  /** Whether the operation succeeded */
  success: boolean;
  /** The resulting data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if available */
  errorCode?: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult<T = unknown> {
  /** Operation ID */
  operationId: string;
  /** Operation type */
  type: BulkOperationType;
  /** Entity type */
  entityType: string;
  /** Total items processed */
  total: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Skipped operations */
  skipped: number;
  /** Results for each item */
  results: BulkOperationItemResult<T>[];
  /** Validation errors */
  validationErrors: ValidationError[];
  /** Operation status */
  status: BulkOperationStatus;
  /** Total elapsed time in milliseconds */
  elapsedMs: number;
  /** Whether rollback was performed */
  rollbackPerformed?: boolean;
  /** Warning messages */
  warnings: string[];
}

/**
 * Bulk operation input base
 */
export interface BulkOperationInput {
  /** Venue ID */
  venueId: string;
  /** User ID performing the operation */
  userId: string;
  /** Whether to run in dry-run mode */
  dryRun?: boolean;
  /** Custom batch configuration */
  batchConfig?: Partial<BatchConfig>;
}

/**
 * Bulk create input
 */
export interface BulkCreateInput<T = Record<string, unknown>> extends BulkOperationInput {
  type: "bulk_create";
  /** Items to create */
  items: T[];
  /** Whether to skip validation */
  skipValidation?: boolean;
}

/**
 * Bulk update input
 */
export interface BulkUpdateInput<T = Record<string, unknown>> extends BulkOperationInput {
  type: "bulk_update";
  /** Updates to apply - map of ID to updates */
  updates: Array<{ id: string; data: T }>;
  /** Whether to skip missing items */
  skipMissing?: boolean;
}

/**
 * Bulk delete input
 */
export interface BulkDeleteInput extends BulkOperationInput {
  type: "bulk_delete";
  /** IDs of items to delete */
  ids: string[];
  /** Entity type for deletion */
  entityType?: string;
  /** Whether to skip missing items */
  skipMissing?: boolean;
}

/**
 * Bulk import input
 */
export interface BulkImportInput<T = Record<string, unknown>> extends BulkOperationInput {
  type: "bulk_import";
  /** Import data rows */
  rows: T[];
  /** Items (alias for rows) */
  items?: T[];
  /** Import options */
  options: BulkImportOptions;
}

/**
 * Bulk import options
 */
export interface BulkImportOptions {
  /** Whether to preview first (staged import) */
  previewFirst: boolean;
  /** Maximum preview rows */
  previewRows?: number;
  /** Column mapping */
  columnMapping?: Record<string, string>;
  /** Skip header row */
  skipHeader?: boolean;
  /** Handle duplicates */
  onDuplicate: "error" | "update" | "skip";
}

/**
 * Bulk export input
 */
export interface BulkExportInput extends BulkOperationInput {
  type: "bulk_export";
  /** Entity type to export */
  entityType: string;
  /** Export format */
  format: "csv" | "json" | "xlsx";
  /** Filters to apply */
  filters?: Record<string, unknown>;
  /** Columns to include */
  columns?: string[];
  /** Generate template for import */
  generateTemplate?: boolean;
}

/**
 * Rollback information
 */
export interface RollbackInfo {
  /** Whether rollback is available */
  available: boolean;
  /** Items that were successfully rolled back */
  rolledBack: number;
  /** Items that failed to rollback */
  failedRollback: number;
  /** Rollback errors */
  errors: Array<{ id: string; error: string }>;
}

/**
 * Rate limiting info
 */
export interface RateLimitInfo {
  /** Maximum requests per minute */
  maxRequests: number;
  /** Current request count */
  currentRequests: number;
  /** Remaining requests */
  remainingRequests: number;
  /** Reset time in seconds */
  resetInSeconds: number;
}

/**
 * Job queue item
 */
export interface BulkJob {
  /** Job ID */
  id: string;
  /** Operation type */
  type: BulkOperationType;
  /** Entity type */
  entityType: string;
  /** Venue ID */
  venueId: string;
  /** User ID */
  userId: string;
  /** Status */
  status: BulkOperationStatus;
  /** Input data */
  input: BulkOperationInput;
  /** Progress */
  progress: ProgressUpdate;
  /** Created at */
  createdAt: string;
  /** Started at */
  startedAt?: string;
  /** Completed at */
  completedAt?: string;
  /** Result */
  result?: BulkOperationResult;
}

/**
 * Notification payload
 */
export interface BulkOperationNotification {
  /** Notification type */
  type: "progress" | "completed" | "failed" | "cancelled";
  /** Job ID */
  jobId: string;
  /** Timestamp */
  timestamp: string;
  /** Progress update (if progress type) */
  progress?: ProgressUpdate;
  /** Result (if completed type) */
  result?: BulkOperationResult;
  /** Error message (if failed type) */
  error?: string;
}

/**
 * Retry strategy
 */
export interface RetryStrategy {
  /** Maximum attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Retry on specific error codes */
  retryOnCodes?: string[];
}

/**
 * Default retry strategy
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryOnCodes: ["ECONNREFUSED", "ETIMEDOUT", "PGRST116"],
};

/**
 * Bulk export request (for API routes)
 */
export interface BulkExportRequest {
  /** Venue ID */
  venueId: string;
  /** Entity type to export */
  entityType: string;
  /** Export format */
  format?: "csv" | "json" | "xlsx";
  /** Columns to include */
  columns?: string[];
  /** Filters to apply */
  filters?: Record<string, unknown>;
  /** Generate template for import */
  generateTemplate?: boolean;
  /** Options */
  options?: {
    previewFirst?: boolean;
  };
}

/**
 * Simplified bulk operation result for queue operations
 */
export interface SimpleBulkOperationResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
  totalProcessed: number;
}

/**
 * Extended batch configuration for queue operations
 */
export interface QueueBatchConfig {
  /** Maximum items per batch */
  batchSize: number;
  /** Delay between batches in milliseconds */
  delayMs: number;
  /** Skip missing items on update */
  skipMissingOnUpdate: boolean;
  /** Skip invalid items on delete */
  skipInvalidOnDelete: boolean;
  /** Continue processing on error */
  continueOnError: boolean;
  /** Progress callback */
  progressCallback?: (update: ProgressUpdate) => void;
  /** Rollback on failure */
  rollbackOnFailure: boolean;
}

/**
 * Progress update for queue operations
 */
export interface QueueProgressUpdate {
  /** Job ID */
  jobId: string;
  /** Processed count */
  processed: number;
  /** Total count */
  total: number;
  /** Progress percentage */
  percentage: number;
  /** Current status */
  status: string;
}
