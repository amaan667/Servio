import { toast } from '@/hooks/use-toast';

/**
 * Centralized QR error handling service
 * Ensures consistent error handling across all QR components
 */

export interface QRError {
  context: string;
  message: string;
  originalError?: unknown;
  timestamp: Date;
}

/**
 * Handle QR-related errors consistently
 */
export function handleQRError(error: unknown, context: string): QRError {
  const qrError: QRError = {
    context,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    originalError: error,
    timestamp: new Date(),
  };

  // Log error for debugging
  console.error(`[QR ${context}] Error:`, error);

  // Show user-friendly error message
  toast({
    title: "QR Code Error",
    description: qrError.message,
    variant: "destructive",
  });

  return qrError;
}

/**
 * Handle QR generation errors specifically
 */
export function handleQRGenerationError(error: unknown, context: string): QRError {
  let message = 'Failed to generate QR code';
  
  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      message = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('invalid')) {
      message = 'Invalid data provided for QR code generation.';
    } else {
      message = error.message;
    }
  }

  const qrError: QRError = {
    context,
    message,
    originalError: error,
    timestamp: new Date(),
  };

  console.error(`[QR Generation ${context}] Error:`, error);

  toast({
    title: "QR Generation Failed",
    description: qrError.message,
    variant: "destructive",
  });

  return qrError;
}

/**
 * Handle QR URL parsing errors
 */
export function handleQRUrlError(error: unknown, context: string): QRError {
  const qrError: QRError = {
    context,
    message: 'Invalid QR code URL format',
    originalError: error,
    timestamp: new Date(),
  };

  console.error(`[QR URL ${context}] Error:`, error);

  toast({
    title: "Invalid QR Code",
    description: "The QR code URL is malformed. Please regenerate the QR code.",
    variant: "destructive",
  });

  return qrError;
}

/**
 * Log QR actions for debugging
 */
export function logQRAction(action: string, data: Record<string, any>): void {
  console.log(`[QR ${action}]`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Validate QR parameters
 */
export function validateQRParams(params: Record<string, any>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.venue) {
    errors.push('Venue ID is required');
  }

  if (!params.table && !params.counter) {
    errors.push('Either table or counter ID is required');
  }

  if (params.table && params.counter) {
    errors.push('Cannot specify both table and counter');
  }

  if (params.source && !['qr_table', 'qr_counter'].includes(params.source)) {
    errors.push('Invalid source parameter');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
