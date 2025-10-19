/**
 * Type Utilities Tests
 * Tests for error handling and type utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isErrorWithMessage,
  getErrorMessage,
  getErrorStack,
  getErrorName,
} from '@/types/common/errors';

describe('Error Utilities', () => {
  describe('isErrorWithMessage', () => {
    it('should return true for Error objects', () => {
      const error = new Error('Test error');
      expect(isErrorWithMessage(error)).toBe(true);
    });

    it('should return true for objects with message property', () => {
      const error = { message: 'Test error' };
      expect(isErrorWithMessage(error)).toBe(true);
    });

    it('should return false for objects without message', () => {
      const error = { code: 'ERROR' };
      expect(isErrorWithMessage(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isErrorWithMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isErrorWithMessage(undefined)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Test error' };
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should return string as-is', () => {
      expect(getErrorMessage('Test error')).toBe('Test error');
    });

    it('should return default message for unknown types', () => {
      expect(getErrorMessage({ code: 'ERROR' })).toBe('An unknown error occurred');
    });
  });

  describe('getErrorStack', () => {
    it('should extract stack from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorStack(error)).toBeDefined();
    });

    it('should return undefined for objects without stack', () => {
      const error = { message: 'Test error' };
      expect(getErrorStack(error)).toBeUndefined();
    });
  });

  describe('getErrorName', () => {
    it('should extract name from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorName(error)).toBe('Error');
    });

    it('should return default name for objects without name', () => {
      const error = { message: 'Test error' };
      expect(getErrorName(error)).toBe('Error');
    });

    it('should return UnknownError for unknown types', () => {
      expect(getErrorName({ code: 'ERROR' })).toBe('UnknownError');
    });
  });
});

