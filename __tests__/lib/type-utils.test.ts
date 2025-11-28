 
import { describe, it, expect } from 'vitest';
import {
  asType,
  getProperty,
  isDefined,
  isObject,
  isArray,
  safeJsonParse,
  toRecord,
  toArray,
  getErrorMessage,
} from '@/types/type-utils';

describe('Type Utilities', () => {
  describe('asType', () => {
    it('should cast unknown to specified type', () => {
      const value: unknown = { name: 'test' };
      const typed = asType<{ name: string }>(value);
      expect(typed.name).toBe('test');
    });
  });

  describe('getProperty', () => {
    it('should get property from object', () => {
      const obj = { name: 'test', age: 25 };
      expect(getProperty(obj, 'name')).toBe('test');
      expect(getProperty<number>(obj, 'age')).toBe(25);
    });

    it('should return undefined for missing property', () => {
      const obj = { name: 'test' };
      expect(getProperty(obj, 'missing')).toBeUndefined();
    });

    it('should return undefined for non-object', () => {
      expect(getProperty(null, 'name')).toBeUndefined();
      expect(getProperty('string', 'name')).toBeUndefined();
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined('test')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({ /* Empty */ })).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({ /* Empty */ })).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({ /* Empty */ })).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(null)).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"name": "test"}');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for invalid JSON', () => {
      expect(safeJsonParse('invalid json')).toBeNull();
      expect(safeJsonParse('')).toBeNull();
    });
  });

  describe('toRecord', () => {
    it('should convert object to record', () => {
      const obj = { key: 'value' };
      expect(toRecord(obj)).toEqual(obj);
    });

    it('should return empty object for non-objects', () => {
      expect(toRecord(null)).toEqual({ /* Empty */ });
      expect(toRecord('string')).toEqual({ /* Empty */ });
      expect(toRecord([])).toEqual({ /* Empty */ });
    });
  });

  describe('toArray', () => {
    it('should return array as-is', () => {
      const arr = [1, 2, 3];
      expect(toArray(arr)).toEqual(arr);
    });

    it('should return empty array for non-arrays', () => {
      expect(toArray(null)).toEqual([]);
      expect(toArray('string')).toEqual([]);
      expect(toArray({ /* Empty */ })).toEqual([]);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should return string as-is', () => {
      expect(getErrorMessage('Error message')).toBe('Error message');
    });

    it('should extract message property from object', () => {
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
    });

    it('should return default for unknown types', () => {
      expect(getErrorMessage(123)).toBe('Unknown error');
      expect(getErrorMessage(null)).toBe('Unknown error');
    });
  });
});

