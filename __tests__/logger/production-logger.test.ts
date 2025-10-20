import { afterEach } from 'vitest';
/**
 * Tests for Production Logger
 * Ensures logging works correctly in all environments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductionLogger, LogLevel } from '@/lib/logger/production-logger';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('ProductionLogger', () => {
  let logger: ProductionLogger;
  let consoleSpy: any;

  beforeEach(() => {
    logger = new ProductionLogger('test-service');
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Log Levels', () => {
    it('should log debug messages in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
      logger.debug('Test debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should not log debug messages in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      logger.debug('Test debug message');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Test warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Context Logging', () => {
    it('should include context in log messages', () => {
      const context = { userId: '123', action: 'test' };
      logger.info('Test message', context);
      
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('Test message');
      expect(call).toContain('userId');
    });
  });

  describe('Sentry Integration', () => {
    it('should send errors to Sentry in production', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      const { captureException } = await import('@sentry/nextjs');
      
      logger.error('Test error', { userId: '123' });
      
      expect(captureException).toHaveBeenCalled();
    });

    it('should send warnings to Sentry in production', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      const { captureMessage } = await import('@sentry/nextjs');
      
      logger.warn('Test warning', { userId: '123' });
      
      expect(captureMessage).toHaveBeenCalled();
    });

    it('should not send debug messages to Sentry', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      const { captureException, captureMessage } = await import('@sentry/nextjs');
      
      logger.debug('Test debug');
      
      expect(captureException).not.toHaveBeenCalled();
      expect(captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('Convenience Methods', () => {
    it('should log API requests', () => {
      logger.apiRequest('GET', '/api/test');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log API responses', () => {
      logger.apiResponse('GET', '/api/test', 200, 150);
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log auth events', () => {
      logger.authEvent('login', 'user-123');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log database queries', () => {
      logger.dbQuery('SELECT * FROM users', 50);
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should log cache hits', () => {
      logger.cacheHit('cache-key');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should log cache misses', () => {
      logger.cacheMiss('cache-key');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should log performance metrics', () => {
      logger.performance('page_load', 1200);
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });
});

