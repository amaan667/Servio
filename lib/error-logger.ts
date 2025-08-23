export interface ErrorLogData {
  timestamp: string;
  error: string;
  stack?: string;
  context?: Record<string, any>;
  environment?: Record<string, any>;
  userAgent?: string;
  url?: string;
  method?: string;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: ErrorLogData[] = [];

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  logError(error: Error | string, context?: Record<string, any>, request?: Request): void {
    const errorData: ErrorLogData = {
      timestamp: new Date().toISOString(),
      error: typeof error === 'string' ? error : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      environment: this.getEnvironmentInfo(),
      userAgent: request?.headers?.get('user-agent'),
      url: request?.url,
      method: request?.method
    };

    this.logs.push(errorData);
    
    // Console logging for immediate visibility
    console.error('[ERROR-LOGGER]', JSON.stringify(errorData, null, 2));
    
    // Keep only last 100 logs to prevent memory issues
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  private getEnvironmentInfo(): Record<string, any> {
    return {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasGoogleCredentials: !!(process.env.GOOGLE_CREDENTIALS_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      hasGoogleProjectId: !!process.env.GOOGLE_PROJECT_ID,
      hasGcsBucket: !!process.env.GCS_BUCKET_NAME,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    };
  }

  getLogs(): ErrorLogData[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getRecentErrors(count: number = 10): ErrorLogData[] {
    return this.logs.slice(-count);
  }
}

export const errorLogger = ErrorLogger.getInstance();