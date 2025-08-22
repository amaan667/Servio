/**
 * Next.js Server Startup Script
 * 
 * This script runs before the Next.js server starts to ensure proper error handling
 * and environment validation is in place from the very beginning.
 */

import { setupStartupErrorHandlers, logStartupInfo, validateEnvironmentVariables } from './lib/startup-error-handler';

console.log('🚀 Next.js server startup initialization...');

try {
  // Set up global error handlers first
  setupStartupErrorHandlers();
  
  // Log startup information for debugging
  logStartupInfo();
  
  // Validate all required environment variables
  validateEnvironmentVariables();
  
  console.log('✅ Next.js server initialization completed successfully');
  console.log('🌐 Ready to start Next.js server...');
  
} catch (error) {
  console.error('💥 Next.js server initialization FAILED:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    processId: process.pid
  });
  
  // Exit with error code so Railway can see the failure
  console.error('🛑 Exiting due to initialization failure...');
  process.exit(1);
}