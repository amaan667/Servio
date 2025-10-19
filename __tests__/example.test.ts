/**
 * Example Test
 * Demonstrates test infrastructure is working
 */

import { describe, it, expect } from 'vitest';

describe('Example Tests', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });

  it('should test array operations', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr.includes(2)).toBe(true);
  });

  it('should test object operations', () => {
    const obj = { name: 'test', value: 123 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(123);
  });

  it('should test async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});

