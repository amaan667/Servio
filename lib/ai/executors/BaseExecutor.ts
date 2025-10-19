/**
 * Base Executor
 * Common functionality for all AI tool executors
 */

import { createClient } from "@/lib/supabase/server";
import { aiLogger as logger } from '@/lib/logger';
import { AIAssistantError, AIExecutionResult } from "@/types/ai-assistant";
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';

export abstract class BaseExecutor {
  protected supabase: Awaited<ReturnType<typeof createClient>>;
  
  constructor() {
    this.supabase = null as unknown as Awaited<ReturnType<typeof createClient>>;
  }

  protected async initSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
  }

  protected async handleExecution<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<AIExecutionResult<T>> {
    try {
      await this.initSupabase();
      const result = await operation();
      return {
        success: true,
        data: result,
        message: 'Operation completed successfully',
      };
    } catch (error: unknown) {
      logger.error(`[AI ASSISTANT] ${errorMessage}:`, getErrorDetails(error));
      return {
        success: false,
        error: error instanceof Error ? getErrorMessage(error) : 'Unknown error',
        message: errorMessage,
      };
    }
  }

  protected throwError(message: string, code: string, details?: Record<string, unknown>) {
    throw new AIAssistantError(message, code, details);
  }

  protected logDebug(message: string, data?: Record<string, unknown>) {
    logger.debug(`[AI ASSISTANT] ${message}`, data);
  }

  protected logError(message: string, error?: unknown) {
    logger.error(`[AI ASSISTANT] ${message}:`, error);
  }
}

