// Tests for usePdfOverlay hook scaling math
import { describe, it, expect } from 'vitest';
import { computePageScale, mapBboxToCss } from '@/hooks/usePdfOverlay';

describe('usePdfOverlay scaling utilities', () => {
  describe('computePageScale', () => {
    it('computes correct scale factors for 1:1 scaling', () => {
      const result = computePageScale(100, 200, 100, 200);
      expect(result.scaleX).toBe(1);
      expect(result.scaleY).toBe(1);
    });

    it('computes correct scale factors for 2x scaling', () => {
      const result = computePageScale(100, 200, 200, 400);
      expect(result.scaleX).toBe(2);
      expect(result.scaleY).toBe(2);
    });

    it('computes correct scale factors for 1.5x scaling', () => {
      const result = computePageScale(100, 200, 150, 300);
      expect(result.scaleX).toBe(1.5);
      expect(result.scaleY).toBe(1.5);
    });

    it('computes correct scale factors for different x and y scaling', () => {
      const result = computePageScale(100, 200, 150, 250);
      expect(result.scaleX).toBe(1.5);
      expect(result.scaleY).toBe(1.25);
    });

    it('handles fractional scaling', () => {
      const result = computePageScale(100, 200, 75, 150);
      expect(result.scaleX).toBe(0.75);
      expect(result.scaleY).toBe(0.75);
    });

    it('handles very small dimensions', () => {
      const result = computePageScale(1, 1, 10, 10);
      expect(result.scaleX).toBe(10);
      expect(result.scaleY).toBe(10);
    });

    it('handles very large dimensions', () => {
      const result = computePageScale(10000, 10000, 5000, 5000);
      expect(result.scaleX).toBe(0.5);
      expect(result.scaleY).toBe(0.5);
    });
  });

  describe('mapBboxToCss', () => {
    it('maps bbox coordinates with 1:1 scaling', () => {
      const bbox = { x: 10, y: 20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 1, 1);

      expect(result.left).toBe(10);
      expect(result.top).toBe(20);
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
    });

    it('maps bbox coordinates with 2x scaling', () => {
      const bbox = { x: 10, y: 20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 2, 2);

      expect(result.left).toBe(20);
      expect(result.top).toBe(40);
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });

    it('maps bbox coordinates with 1.5x scaling', () => {
      const bbox = { x: 10, y: 20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 1.5, 1.5);

      expect(result.left).toBe(15);
      expect(result.top).toBe(30);
      expect(result.width).toBe(150);
      expect(result.height).toBe(75);
    });

    it('maps bbox coordinates with different x and y scaling', () => {
      const bbox = { x: 10, y: 20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 2, 1.5);

      expect(result.left).toBe(20);
      expect(result.top).toBe(30);
      expect(result.width).toBe(200);
      expect(result.height).toBe(75);
    });

    it('maps bbox coordinates with fractional scaling', () => {
      const bbox = { x: 10, y: 20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 0.5, 0.75);

      expect(result.left).toBe(5);
      expect(result.top).toBe(15);
      expect(result.width).toBe(50);
      expect(result.height).toBe(37.5);
    });

    it('handles zero coordinates', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 1.5, 1.5);

      expect(result.left).toBe(0);
      expect(result.top).toBe(0);
      expect(result.width).toBe(150);
      expect(result.height).toBe(75);
    });

    it('handles zero dimensions', () => {
      const bbox = { x: 10, y: 20, w: 0, h: 0 };
      const result = mapBboxToCss(bbox, 1.5, 1.5);

      expect(result.left).toBe(15);
      expect(result.top).toBe(30);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('handles negative coordinates', () => {
      const bbox = { x: -10, y: -20, w: 100, h: 50 };
      const result = mapBboxToCss(bbox, 1.5, 1.5);

      expect(result.left).toBe(-15);
      expect(result.top).toBe(-30);
      expect(result.width).toBe(150);
      expect(result.height).toBe(75);
    });

    it('maintains aspect ratio when scaling uniformly', () => {
      const bbox = { x: 10, y: 10, w: 100, h: 50 }; // 2:1 aspect ratio
      const result = mapBboxToCss(bbox, 2, 2);

      const originalAspect = bbox.w / bbox.h;
      const scaledAspect = result.width / result.height;

      expect(scaledAspect).toBe(originalAspect);
    });

    it('produces pixel-perfect results for common PDF dimensions', () => {
      // Common PDF page size: 8.5" x 11" at 72 DPI = 612 x 792 points
      const pdfWidth = 612;
      const pdfHeight = 792;

      // Render at 1.5x scale
      const renderWidth = 918;
      const renderHeight = 1188;

      const scale = computePageScale(pdfWidth, pdfHeight, renderWidth, renderHeight);

      expect(scale.scaleX).toBe(1.5);
      expect(scale.scaleY).toBe(1.5);

      // Test a menu item at (100, 200) with size (150, 50)
      const item = { x: 100, y: 200, w: 150, h: 50 };
      const css = mapBboxToCss(item, scale.scaleX, scale.scaleY);

      expect(css.left).toBe(150);
      expect(css.top).toBe(300);
      expect(css.width).toBe(225);
      expect(css.height).toBe(75);
    });

    it('handles A4 page dimensions', () => {
      // A4 at 72 DPI = 595 x 842 points
      const pdfWidth = 595;
      const pdfHeight = 842;

      // Render at 2x scale
      const renderWidth = 1190;
      const renderHeight = 1684;

      const scale = computePageScale(pdfWidth, pdfHeight, renderWidth, renderHeight);

      expect(scale.scaleX).toBe(2);
      expect(scale.scaleY).toBe(2);
    });

    it('handles Letter page dimensions', () => {
      // Letter at 72 DPI = 612 x 792 points
      const pdfWidth = 612;
      const pdfHeight = 792;

      // Render at 1.25x scale
      const renderWidth = 765;
      const renderHeight = 990;

      const scale = computePageScale(pdfWidth, pdfHeight, renderWidth, renderHeight);

      expect(scale.scaleX).toBe(1.25);
      expect(scale.scaleY).toBe(1.25);
    });
  });

  describe('Edge cases and precision', () => {
    it('maintains precision with floating point arithmetic', () => {
      const bbox = { x: 33.333, y: 66.666, w: 100.123, h: 200.456 };
      const result = mapBboxToCss(bbox, 1.5, 1.5);

      expect(result.left).toBeCloseTo(49.9995, 4);
      expect(result.top).toBeCloseTo(99.999, 4);
      expect(result.width).toBeCloseTo(150.1845, 4);
      expect(result.height).toBeCloseTo(300.684, 4);
    });

    it('handles very small bboxes', () => {
      const bbox = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
      const result = mapBboxToCss(bbox, 100, 100);

      expect(result.left).toBe(10);
      expect(result.top).toBe(20);
      expect(result.width).toBe(50);
      expect(result.height).toBe(30);
    });

    it('handles very large bboxes', () => {
      const bbox = { x: 10000, y: 20000, w: 50000, h: 30000 };
      const result = mapBboxToCss(bbox, 0.01, 0.01);

      expect(result.left).toBe(100);
      expect(result.top).toBe(200);
      expect(result.width).toBe(500);
      expect(result.height).toBe(300);
    });
  });
});

